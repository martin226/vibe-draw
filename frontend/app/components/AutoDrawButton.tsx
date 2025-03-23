import { useCallback, useEffect, useState } from 'react'
import { useEditor, useToasts, TLShapeId } from '@tldraw/tldraw'
import { vibe3DCode } from '../lib/vibe3DCode'

export function AutoDrawButton() {
  const [enabled, setEnabled] = useState(false)
  const editor = useEditor()
  const { addToast } = useToasts()
  
  // Toggle auto-drawing feature
  const handleClick = useCallback(() => {
    setEnabled(prev => !prev)
  }, [])
  
  // Create a custom implementation for useAutoModel
  useEffect(() => {
    if (!enabled || !editor) return
    
    // Create an array to store shape IDs and a ref for the timeout
    const drawingShapes: TLShapeId[] = []
    let timeout: NodeJS.Timeout | null = null
    
    // Add initial toast notification
    addToast({
      title: 'Auto 3D Enabled',
      description: 'Draw something and pause for 3 seconds to generate a 3D model',
      icon: 'check',
    })
    
    // Function to generate 3D model when drawing pauses
    const generate3DModel = async () => {
      if (drawingShapes.length === 0) return
      
      try {
        // Select all the shapes we've tracked
        editor.selectNone()
        drawingShapes.forEach(id => {
          const shape = editor.getShape(id)
          if (shape) {
            editor.select(id)
          }
        })
        
        // Show a toast while generating
        addToast({
          id: 'generating-3d',
          title: 'Generating 3D Model',
          description: 'Creating a 3D model from your drawing...',
          icon: 'external-link',
        })
        
        // Call the vibe3DCode function
        try {
            await vibe3DCode(editor)
        } catch (e) {
            console.error(e)
            addToast({
                icon: 'cross-2',
                title: 'Something went wrong',
                description: (e as Error).message.slice(0, 100),
            })
        }
        
        // Success toast
        addToast({
          title: 'Success!',
          description: '3D model created',
          icon: 'check',
        })
        
        // Clear the tracked shapes
        drawingShapes.length = 0
      } catch (error: any) {
        console.error('Error generating 3D model:', error)
        
        // Error toast
        addToast({
          title: 'Error',
          description: error.message || 'Failed to generate 3D model',
          icon: 'cross',
        })
      }
    }
    
    // Listen for drawing events
    const handleChangeEvent = (change: any) => {
      // Handle shape updates
      if (change.changes?.updated) {
        for (const entry of Object.values(change.changes.updated)) {
          const [from, to] = Array.isArray(entry) ? entry : [null, null]
          
          if (
            from && 
            to && 
            'typeName' in from && 
            'typeName' in to && 
            from.typeName === 'shape' && 
            to.typeName === 'shape' && 
            'type' in to && 
            to.type === 'draw' &&
            'id' in to
          ) {
            // Track the shape ID
            const shapeId = to.id as TLShapeId
            if (!drawingShapes.includes(shapeId)) {
              drawingShapes.push(shapeId)
            }
            
            // Reset the timeout
            if (timeout) {
              clearTimeout(timeout)
            }
            
            // Set a new timeout
            timeout = setTimeout(generate3DModel, 3000)
          }
        }
      }
      
      // Handle new shapes
      if (change.changes?.added) {
        for (const record of Object.values(change.changes.added)) {
          if (
            record && 
            typeof record === 'object' && 
            'typeName' in record && 
            record.typeName === 'shape' && 
            'type' in record && 
            record.type === 'draw' &&
            'id' in record
          ) {
            // Track the shape ID
            const shapeId = record.id as TLShapeId
            if (!drawingShapes.includes(shapeId)) {
              drawingShapes.push(shapeId)
            }
            
            // Reset the timeout
            if (timeout) {
              clearTimeout(timeout)
            }
            
            // Set a new timeout
            timeout = setTimeout(generate3DModel, 3000)
          }
        }
      }
      
      // Handle removed shapes (erased or deleted)
      if (change.changes?.removed) {
        let removedShapes = false
        
        for (const record of Object.values(change.changes.removed)) {
          if (
            record && 
            typeof record === 'object' && 
            'typeName' in record && 
            record.typeName === 'shape' && 
            'id' in record
          ) {
            const shapeId = record.id as TLShapeId
            const index = drawingShapes.indexOf(shapeId)
            
            if (index !== -1) {
              // Remove the shape ID from our tracking array
              drawingShapes.splice(index, 1)
              removedShapes = true
            }
          }
        }
        
        // If shapes were removed and we still have some left, reset the timeout
        if (removedShapes && drawingShapes.length > 0) {
          if (timeout) {
            clearTimeout(timeout)
          }
          timeout = setTimeout(generate3DModel, 3000)
        }
      }
      
      // Check for potentially removed shapes (like after undo)
      const stillExists = drawingShapes.filter(id => !!editor.getShape(id))
      
      // If we lost some shapes, update our tracking array
      if (stillExists.length !== drawingShapes.length) {
        // Replace the array contents with only shapes that still exist
        drawingShapes.length = 0
        stillExists.forEach(id => drawingShapes.push(id))
        
        // Reset the timeout if we still have shapes
        if (drawingShapes.length > 0) {
          if (timeout) {
            clearTimeout(timeout)
          }
          timeout = setTimeout(generate3DModel, 3000)
        }
      }
    }
    
    // Register the event listener
    const cleanup = editor.store.listen(handleChangeEvent, { source: 'user', scope: 'all' })
    
    // Return cleanup function
    return () => {
      cleanup()
      if (timeout) {
        clearTimeout(timeout)
      }
      
      addToast({
        title: 'Auto 3D Disabled',
        description: 'Automatic 3D model generation turned off',
        icon: 'cross',
      })
    }
  }, [enabled, editor, addToast])

  // Sync/refresh icon as an SVG
  const SyncIcon = () => (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={enabled ? "rotating" : ""}
      style={{
        animation: enabled ? 'rotate 2s linear infinite' : 'none'
      }}
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
    </svg>
  )

  return (
    <button 
      className="autoDrawButton" 
      onClick={handleClick}
      style={{ 
        backgroundColor: enabled ? '#007bff' : '#6c757d',
        color: 'white',
        marginLeft: '-3px',
        padding: '6px 12px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '18px',
        fontWeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        e.currentTarget.style.backgroundColor = enabled ? '#0069d9' : '#5a6268';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        e.currentTarget.style.backgroundColor = enabled ? '#007bff' : '#6c757d';
      }}
    >
      <SyncIcon />
      <span>Auto 3D {enabled ? '(ON)' : '(OFF)'}</span>
    </button>
  )
} 
