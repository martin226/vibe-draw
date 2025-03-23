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
      style={{ 
        backgroundColor: '#7B5BD6',
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
        e.currentTarget.style.backgroundColor = '#6545B8';
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#7B5BD6';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      }}
    >
      <MagicWandIcon />
      <span>Improve Drawing</span>
    </button>
  )
}
