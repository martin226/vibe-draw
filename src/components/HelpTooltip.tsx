import { useAppStore } from '../store/appStore'

export function HelpTooltip() {
  const { selectedObject } = useAppStore()
  
  // Only show help tooltip when no object is selected
  if (selectedObject) return null
  
  return (
    <div className="help-tooltip">
      <div className="help-header">
        <strong>Controls Guide</strong>
      </div>
      <div>
        <strong>Create Meshes</strong>: Click the Create Mesh button
      </div>
      <div>
        <strong>Hover</strong> over user-created objects to highlight them
      </div>
      <div>
        <strong>Click</strong> on highlighted object to select and transform
      </div>
      <div>
        <strong>Double-click</strong> to cycle transform modes
      </div>
      <div>
        <strong>Escape</strong> to deselect object
      </div>
      <div className="help-note">
        Only user-created objects can be modified
      </div>
    </div>
  )
} 