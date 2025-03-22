import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback } from 'react'
import { vibe3DCode } from '../lib/vibe3DCode'

export function Vibe3DCodeButton() {
  const editor = useEditor()
  const { addToast } = useToasts()

  const handleClick = useCallback(async () => {
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
  }, [editor, addToast])

  return (
    <button 
      className="vibe3DCodeButton" 
      onClick={handleClick}
      style={{ 
        background: 'linear-gradient(45deg, #7B5BD6, #1D8AC5, #17A673)',
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
      <span style={{ fontSize: '16px' }}>🧊</span>
      <span>Make 3D</span>
    </button>
  )
}