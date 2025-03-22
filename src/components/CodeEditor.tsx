import { useState, useEffect } from 'react'
import * as THREE from 'three'
import { useAppStore } from '../store/appStore'

interface CodeEditorProps {
  isOpen: boolean
  onClose: () => void
  onAddMesh: (mesh: THREE.Mesh) => void
}

const EXAMPLE_TEMPLATES = {
  cube: `// Create a cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const mesh = new THREE.Mesh(geometry, material);

mesh.position.set(0, 0.5, 0);

return mesh;`,

  sphere: `// Create a sphere
const geometry = new THREE.SphereGeometry(0.5, 32, 32);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const mesh = new THREE.Mesh(geometry, material);

mesh.position.set(0, 0.5, 0);

return mesh;`,

  torus: `// Create a torus (donut)
const geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 32);
const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const mesh = new THREE.Mesh(geometry, material);

mesh.position.set(0, 0.5, 0);
mesh.rotation.set(Math.PI/2, 0, 0);

return mesh;`,

  custom: `// Create a custom shape using BufferGeometry
const geometry = new THREE.BufferGeometry();
// Create a simple triangle
const vertices = new Float32Array([
  -0.5, -0.5, 0,   // v1
   0.5, -0.5, 0,   // v2
   0.0,  0.5, 0    // v3
]);
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const material = new THREE.MeshBasicMaterial({ 
  color: 0xffff00,
  side: THREE.DoubleSide
});
const mesh = new THREE.Mesh(geometry, material);

mesh.position.set(0, 0.5, 0);

return mesh;`
};

export function CodeEditor({ isOpen, onClose, onAddMesh }: CodeEditorProps) {
  const [code, setCode] = useState(EXAMPLE_TEMPLATES.cube);
  const [error, setError] = useState<string | null>(null);
  const { setUIFocused, setCodeEditorOpen } = useAppStore();
  
  // Update the global state when the editor opens/closes
  useEffect(() => {
    setCodeEditorOpen(isOpen);
    
    // When the editor closes, make sure we reset the UI focus state
    if (!isOpen) {
      setUIFocused(false);
    }
  }, [isOpen, setCodeEditorOpen, setUIFocused]);
  
  if (!isOpen) return null;

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
    setError(null);
  };

  const handleTemplateChange = (template: keyof typeof EXAMPLE_TEMPLATES) => {
    setCode(EXAMPLE_TEMPLATES[template]);
    setError(null);
  };

  const handleSubmit = () => {
    try {
      // Create a function from the code string
      const createMeshFunction = new Function('THREE', code);
      
      // Execute the function with THREE library as parameter
      const mesh = createMeshFunction(THREE);
      
      if (!(mesh instanceof THREE.Mesh)) {
        throw new Error('The code must return a THREE.Mesh object');
      }
      
      // Add the mesh to the scene
      onAddMesh(mesh);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };
  
  const preventPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't prevent default as it can interfere with normal input behavior
    // e.preventDefault();
  };
  
  // Handlers for focus/blur events
  const handleFocus = () => {
    setUIFocused(true);
  };
  
  const handleBlur = () => {
    setUIFocused(false);
  };

  return (
    <div 
      className="code-editor no-pointer-lock" 
      onClick={preventPropagation}
      onMouseDown={preventPropagation}
      onMouseUp={preventPropagation}
    >
      <div className="code-editor-header">
        <h3>Three.js Code Editor</h3>
        <button onClick={(e) => {
          preventPropagation(e);
          onClose();
        }} className="close-button">×</button>
      </div>
      
      <div className="template-selector">
        <button onClick={(e) => {
          preventPropagation(e);
          handleTemplateChange('cube');
        }}>Cube</button>
        <button onClick={(e) => {
          preventPropagation(e);
          handleTemplateChange('sphere');
        }}>Sphere</button>
        <button onClick={(e) => {
          preventPropagation(e);
          handleTemplateChange('torus');
        }}>Torus</button>
        <button onClick={(e) => {
          preventPropagation(e);
          handleTemplateChange('custom');
        }}>Custom</button>
      </div>
      
      <textarea 
        value={code}
        onChange={handleCodeChange}
        onClick={preventPropagation}
        onMouseDown={preventPropagation}
        onMouseUp={preventPropagation}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="code-textarea"
        placeholder="Write your Three.js code here..."
      />
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      <div className="code-editor-footer">
        <button onClick={(e) => {
          preventPropagation(e);
          handleSubmit();
        }} className="add-mesh-button">
          Add Mesh to Scene
        </button>
      </div>
    </div>
  );
} 