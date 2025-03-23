import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useState, useEffect } from 'react'
import { vibe3DCode } from '../lib/vibe3DCode'
import { edit3DCode } from '../lib/edit3DCode'

export function Vibe3DCodeButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [is3DModelSelected, setIs3DModelSelected] = useState(false)
  
  // Update state whenever selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selectedShapes = editor.getSelectedShapes()
      const has3DModel = selectedShapes.some(shape => shape.type === 'model3d')
      setIs3DModelSelected(has3DModel)
    }
    
    // Check initially
    handleSelectionChange()
    
    // Subscribe to selection changes
    editor.addListener('change', handleSelectionChange)
    
    // Cleanup
    return () => {
      editor.removeListener('change', handleSelectionChange)
    }
  }, [editor])

  const handleClick = useCallback(async () => {
    try {
      if (is3DModelSelected) {
        // If there's a 3D model in the selection, use edit3DCode
        await edit3DCode(editor)
      } else {
        // Otherwise, use vibe3DCode to create a new 3D model
        await vibe3DCode(editor)
      }
    } catch (e) {
      console.error(e)
      addToast({
        icon: 'cross-2',
        title: 'Something went wrong',
        description: (e as Error).message.slice(0, 100),
      })
    }
  }, [editor, addToast, is3DModelSelected])

  // 3D cube icon as an SVG
  const CubeIcon = () => (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )

  return (
    <button 
      className="vibe3DCodeButton" 
      onClick={handleClick}
      style={{ 
        backgroundColor: '#007bff',
        color: 'white',
        marginLeft: '8px',
        padding: '6px 12px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#0069d9';
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#007bff';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      }}
    >
      <CubeIcon />
      <span>{is3DModelSelected ? 'Edit 3D' : 'Make 3D'}</span>
    </button>
  )
}
