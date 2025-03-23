import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useState, useEffect } from 'react'
import { vibe3DCode } from '../lib/vibe3DCode'
import { edit3DCode } from '../lib/edit3DCode'
import { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'

export function Vibe3DCodeButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [is3DModelSelected, setIs3DModelSelected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  
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

  const handleToggleThinking = useCallback((e: React.MouseEvent) => {
    // Stop event propagation to prevent button click
    e.stopPropagation();
    setThinkingEnabled(prev => !prev);
  }, []);

  const handleClick = useCallback(async () => {
    if (isProcessing) return; // Prevent multiple clicks
    
    try {
      setIsProcessing(true);
      
      if (is3DModelSelected) {
        // First get the 3D model shape
        const selectedShapes = editor.getSelectedShapes();
        const model3dShape = selectedShapes.find(shape => shape.type === 'model3d') as Model3DPreviewShape;
        
        if (!model3dShape) {
          throw Error('Could not find the selected 3D model.');
        }
        
        // Use edit3DCode with loading state via custom event
        await edit3DCode(editor, (isEditing) => {
          const elementId = model3dShape.id;
          
          // Dispatch a custom event to communicate with the component
          const event = new CustomEvent('model3d-editing-state-change', { 
            detail: { isEditing, elementId } 
          });
          window.dispatchEvent(event);
        });
      } else {
        // Otherwise, use vibe3DCode to create a new 3D model
        await vibe3DCode(editor, undefined, thinkingEnabled);
      }
    } catch (e) {
      console.error(e)
      addToast({
        icon: 'cross-2',
        title: 'Something went wrong',
        description: (e as Error).message.slice(0, 100),
      })
    } finally {
      setIsProcessing(false);
    }
  }, [editor, addToast, is3DModelSelected, isProcessing, thinkingEnabled]);

  // 3D cube icon as an SVG
  const CubeIcon = () => (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={thinkingEnabled ? "url(#cubeGradient)" : "currentColor"}
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="cubeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff80ff" />
          <stop offset="100%" stopColor="#80ffff" />
        </linearGradient>
      </defs>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )

  // Brain icon for AI
  const BrainIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={thinkingEnabled ? "url(#brainGradient)" : "white"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff80ff" />
          <stop offset="100%" stopColor="#80ffff" />
        </linearGradient>
      </defs>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.04Z"></path>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.04Z"></path>
    </svg>
  )

  // Toggle switch component
  const ToggleSwitch = ({ enabled, onClick }: { enabled: boolean, onClick: (e: React.MouseEvent) => void }) => (
    <div 
      onClick={onClick}
      style={{
        position: 'relative',
        width: '36px',
        height: '18px',
        borderRadius: '10px',
        backgroundColor: enabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginLeft: '5px',
        border: '1px solid rgba(255,255,255,0.3)',
        display: 'flex',
        alignItems: 'center',
        padding: '1px',
      }}
    >
      <div 
        style={{
          position: 'absolute',
          left: enabled ? '18px' : '2px',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}
      />
    </div>
  );

  return (
    <button 
      className="vibe3DCodeButton" 
      onClick={handleClick}
      disabled={isProcessing}
      style={{ 
        backgroundColor: isProcessing ? '#66a6ff' : '#007bff',
        color: 'white',
        marginLeft: '-3px',
        padding: '6px 12px',
        borderRadius: '4px',
        border: 'none',
        cursor: isProcessing ? 'not-allowed' : 'pointer',
        fontSize: '18px',
        fontWeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        transition: 'all 0.2s ease',
        opacity: isProcessing ? 0.8 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isProcessing) {
          e.currentTarget.style.backgroundColor = '#0069d9';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isProcessing) {
          e.currentTarget.style.backgroundColor = '#007bff';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      }}
    >
      {isProcessing ? (
        <>
          <div 
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '50%',
              borderTop: '2px solid white',
              animation: 'spin 1s linear infinite',
            }} 
          />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <span>{is3DModelSelected ? 'Editing...' : 'Creating...'}</span>
        </>
      ) : (
        <>
          <CubeIcon />
          <div style={{
            display: 'flex',
            alignItems: 'center'
          }}>
            <span>
              {is3DModelSelected ? 'Edit 3D' : 'Make 3D'}
            </span>
            {!is3DModelSelected && (
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                marginLeft: '8px',
                borderLeft: '1px solid rgba(255,255,255,0.3)',
                paddingLeft: '8px',
                height: '18px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}>
                  <BrainIcon />
                  {/* <span style={{ 
                    fontSize: '10px', 
                    opacity: 0.9,
                    fontWeight: thinkingEnabled ? 'bold' : 'normal',
                  }}>
                    AI
                  </span> */}
                </div>
                <ToggleSwitch 
                  enabled={thinkingEnabled}
                  onClick={handleToggleThinking}
                />
              </div>
            )}
          </div>
        </>
      )}
    </button>
  )
}
