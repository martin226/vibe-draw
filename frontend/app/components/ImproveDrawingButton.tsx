import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useState } from 'react'
import { improveDrawing } from '../lib/improveDrawing'

export function ImproveDrawingButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [isImproving, setIsImproving] = useState(false)

  const handleClick = useCallback(async () => {
    try {
      // Get the selected shapes to track them during improvement
      const selectedShapes = editor.getSelectedShapes()
      if (selectedShapes.length === 0) {
        addToast({
          icon: 'cross-2',
          title: 'Select something first',
          description: 'Please select a shape to improve',
        })
        return
      }

      // Filter out non-drawable shapes if needed
      const drawableShapes = selectedShapes.filter((shape) => shape.type !== 'model3d')
      
      if (drawableShapes.length === 0) {
        addToast({
          icon: 'cross-2',
          title: 'No drawable shapes',
          description: 'Select shapes that can be improved (not 3D models)',
        })
        return
      }

      // Start loading state
      setIsImproving(true)
      
      // Call actual improve drawing function
      await improveDrawing(editor)
      
    } catch (e) {
      console.error('Error in improve drawing workflow:', e)
      addToast({
        icon: 'cross-2',
        title: 'Something went wrong',
        description: (e as Error).message.slice(0, 100),
      })
    } finally {
      // Reset state
      setIsImproving(false)
    }
  }, [editor, addToast])

  // Magic wand icon as an SVG
  const MagicWandIcon = () => (
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
      <line x1="4" y1="20" x2="20" y2="4" />
      <line x1="15" y1="4" x2="20" y2="4" />
      <line x1="20" y1="9" x2="20" y2="4" />
      <line x1="4" y1="20" x2="9" y2="20" />
      <line x1="4" y1="20" x2="4" y2="15" />
    </svg>
  )

  return (
    <button 
      className="improveDrawingButton" 
      onClick={handleClick}
      disabled={isImproving}
      style={{ 
        backgroundColor: isImproving ? '#9a86d5' : '#7B5BD6',
        color: 'white',
        marginLeft: '-3px',
        padding: '6px 12px',
        borderRadius: '4px',
        border: 'none',
        cursor: isImproving ? 'not-allowed' : 'pointer',
        fontSize: '18px',
        fontWeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        transition: 'all 0.2s ease',
        opacity: isImproving ? 0.8 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isImproving) {
          e.currentTarget.style.backgroundColor = '#6545B8';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isImproving) {
          e.currentTarget.style.backgroundColor = '#7B5BD6';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      }}
    >
      {isImproving ? (
        <>
          <div className="loading-spinner" style={{
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '50%',
            borderTop: '2px solid white',
            animation: 'spin 1s linear infinite',
          }} />
          <span>Improving...</span>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </>
      ) : (
        <>
          <MagicWandIcon />
          <span>Improve Drawing</span>
        </>
      )}
    </button>
  )
}
