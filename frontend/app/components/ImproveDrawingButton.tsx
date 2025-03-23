import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback } from 'react'
import { improveDrawing } from '../lib/improveDrawing'

export function ImproveDrawingButton() {
  const editor = useEditor()
  const { addToast } = useToasts()

  const handleClick = useCallback(async () => {
    try {
      await improveDrawing(editor)
    } catch (e) {
      console.error(e)
      addToast({
        icon: 'cross-2',
        title: 'Something went wrong',
        description: (e as Error).message.slice(0, 100),
      })
    }
  }, [editor, addToast])

  return (
    <button 
      className="improveDrawingButton" 
      onClick={handleClick}
      style={{ 
        background: 'linear-gradient(45deg, #FF6B6B, #FF8E53, #FFD166)',
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
      <span>Improve Drawing</span>
    </button>
  )
}
