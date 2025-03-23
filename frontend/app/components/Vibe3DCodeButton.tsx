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

  return (
    <button 
      className="vibe3DCodeButton" 
      onClick={handleClick}
      style={{ 
        background: 'linear-gradient(45deg, #7B5BD6, #1D8AC5, #17A673)',
        boxShadow: "none",
        marginLeft: '8px',
        fontWeight: 400,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontSize: 18,
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      }}
    >
      <span>{is3DModelSelected ? 'Edit 3D' : 'Make 3D'}</span>
    </button>
  )
}
