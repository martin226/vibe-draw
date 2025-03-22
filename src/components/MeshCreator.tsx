import { useState, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Bvh } from '@react-three/drei'
import { CodeEditor } from './CodeEditor'
import { useAppStore } from '../store/appStore'
import { CustomTransformControls } from './CustomTransformControls'
import { ObjectHighlighter } from './ObjectHighlighter'

// We no longer need the context as we're using Zustand for state management
export function MeshCreatorUI() {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const { meshCount, incrementMeshCount, setUIFocused } = useAppStore()
  
  const toggleEditor = () => {
    setIsEditorOpen(prev => !prev)
  }

  const handleAddMesh = (mesh: THREE.Mesh) => {
    // Update the mesh count using the Zustand store
    incrementMeshCount()
    
    // Store the mesh in a global variable to pass to the Three.js component
    window.__pendingMesh = mesh;
    
    // Add custom properties to identify this as a user-created mesh
    mesh.userData.isUserCreated = true;
    mesh.userData.name = `User Mesh ${meshCount + 1}`;
    
    // Display success message
    const successMessage = document.createElement('div')
    successMessage.className = 'mesh-success-message'
    successMessage.textContent = `Mesh added to scene! (Total: ${meshCount + 1})`
    document.body.appendChild(successMessage)
    
    // Remove the message after 3 seconds
    setTimeout(() => {
      document.body.removeChild(successMessage)
    }, 3000)
  }

  const handleUIClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Set UI focused state when interacting with UI
    setUIFocused(true);
  };

  return (
    <>
      <div className="mesh-creator-button no-pointer-lock" onClick={(e) => {
        handleUIClick(e);
        toggleEditor();
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Create Mesh {meshCount > 0 ? `(${meshCount})` : ''}</span>
      </div>

      <CodeEditor 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)}
        onAddMesh={handleAddMesh}
      />
    </>
  )
}

declare global {
  interface Window {
    __pendingMesh?: THREE.Mesh;
  }
}

export function MeshCreator() {
  const { scene } = useThree()
  const customMeshes = useRef<THREE.Mesh[]>([])
  const { selectedObject, setSelectedObject } = useAppStore()
  
  // Handler for when an object is selected via the ObjectHighlighter
  const handleObjectSelected = (object: THREE.Object3D) => {
    // ONLY allow selection if the object is user-created (this is a double-check)
    if (!object.userData?.isUserCreated) {
      console.warn("Only user-created objects can be transformed");
      return;
    }
    
    // Give any unnamed object a default name
    if (!object.userData.name) {
      object.userData.name = `User Mesh`;
    }
    
    // Set as selected object
    setSelectedObject(object);
  }
  
  // Handler to deselect the current object
  const handleDeselect = () => {
    setSelectedObject(null)
  }
  
  // Dynamic container for user-created meshes
  const DynamicMeshes = () => {
    useFrame(() => {
      if (window.__pendingMesh) {
        const mesh = window.__pendingMesh
        
        // Ensure it's marked as user-created (double-check)
        if (!mesh.userData) mesh.userData = {};
        mesh.userData.isUserCreated = true;
        
        // Add the mesh to the scene
        scene.add(mesh)
        
        // Store a reference to it for potential later use
        customMeshes.current.push(mesh)
        
        // Clear the global variable
        window.__pendingMesh = undefined
      }
    })
    
    return null
  }
  
  return (
    <>
      {/* Wrap dynamic content with Bvh for optimized raycasting */}
      <Bvh>
        <DynamicMeshes />
      </Bvh>
      
      {/* Object highlighting system - ONLY for user-created objects */}
      <ObjectHighlighter 
        onObjectSelected={handleObjectSelected}
        excludeObjects={selectedObject ? [selectedObject] : []}
      />
      
      {/* Transform controls for the selected object - ONLY THREE.JS OBJECTS HERE */}
      {selectedObject && selectedObject.userData?.isUserCreated && (
        <CustomTransformControls 
          object={selectedObject}
          onDeselect={handleDeselect}
        />
      )}
    </>
  )
} 