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

  // Get the API key from the input field
  const getApiKey = useCallback(() => {
    const input = document.getElementById('anthropic_key') as HTMLInputElement
    return input?.value ?? ''
  }, [])
  
  // Create a custom implementation for useAutoModel
  useEffect(() => {
    if (!enabled || !editor) return
    
    const apiKey = getApiKey()
    if (!apiKey) {
      addToast({
        title: 'API Key Missing',
        description: 'Please enter your Anthropic API key to use the auto 3D feature',
        icon: 'cross',
      })
      setEnabled(false)
      return
    }
    
    // Create an array to store shape IDs and a ref for the timeout
    const drawingShapes: TLShapeId[] = []
    let timeout: NodeJS.Timeout | null = null
    
    // Add initial toast notification
    addToast({
      title: 'Auto 3D Enabled',
      description: 'Draw something and pause for 2 seconds to generate a 3D model',
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
        await vibe3DCode(editor, apiKey)
        
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
  }, [enabled, editor, getApiKey, addToast])

  return (
    <button 
      className="vibe3DCodeButton" 
      onClick={handleClick}
      style={{ 
        background: enabled ? 'linear-gradient(45deg, #7B5BD6, #1D8AC5, #17A673)' : '#666',
        marginLeft: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        fontWeight: 'bold',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 14px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        height: '36px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
      }}
    >
      <span style={{ fontSize: '16px' }}>🔄</span>
      <span>Auto 3D {enabled ? '(ON)' : '(OFF)'}</span>
    </button>
  )
} 