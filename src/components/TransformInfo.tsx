import { useAppStore } from '../store/appStore'

export function TransformInfo() {
  const { selectedObject, transformMode } = useAppStore()
  
  if (!selectedObject) return null
  
  return (
    <div className="transform-info">
      <div>
        <strong>Object:</strong> {selectedObject.userData.name || 'Mesh'}
      </div>
      <div>
        <strong>Mode:</strong> <span className="mode">{transformMode}</span>
      </div>
      <div>
        <small>Double-click to change mode</small><br/>
        <small>Escape to deselect</small>
      </div>
    </div>
  )
} 