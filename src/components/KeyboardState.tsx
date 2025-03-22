import { useAppStore } from '../store/appStore'

export function KeyboardState() {
  const { isUIFocused, isCodeEditorOpen } = useAppStore()
  
  return (
    <div className="keyboard-state">
      <div className={`state-indicator ${isUIFocused ? 'inactive' : 'active'}`}>
        <span>Keyboard Controls: {isUIFocused ? 'Disabled' : 'Enabled'}</span>
      </div>
      {isCodeEditorOpen && (
        <div className="state-note">
          <span>Editor is open: Typing goes to editor</span>
        </div>
      )}
    </div>
  )
} 