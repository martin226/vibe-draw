import { useState, useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Bvh } from '@react-three/drei'
import { CodeEditor } from '@/components/three/CodeEditor'
import { useAppStore, useObjectStore } from '@/store/appStore'
import { CustomTransformControls } from '@/components/three/CustomTransformControls'
import { ObjectHighlighter } from '@/components/three/ObjectHighlighter'

export function MeshCreatorUI() {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const { setUIFocused } = useAppStore()
  const { meshCount, addObject } = useObjectStore()
  
  const toggleEditor = () => {
    setIsEditorOpen(prev => !prev)
  }

  const handleAddMesh = (object: THREE.Mesh | THREE.Group) => {
    // Set properties
    object.userData.isUserCreated = true;
    object.userData.name = `User Object ${meshCount + 1}`;
    
    // Add to store
    addObject(object);
    
    // Show success message
    const successMessage = document.createElement('div')
    successMessage.className = 'mesh-success-message'
    successMessage.textContent = `Object added to scene! (Total: ${meshCount + 1})`
    document.body.appendChild(successMessage)
    
    setTimeout(() => {
      document.body.removeChild(successMessage)
    }, 3000)
  }

  const handleUIClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUIFocused(true);
  };

  return (
    <>
      {/* <div className="mesh-creator-button no-pointer-lock" onClick={(e) => {
        handleUIClick(e);
        toggleEditor();
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Create Object {meshCount > 0 ? `(${meshCount})` : ''}</span>
      </div> */}

      <CodeEditor 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)}
        onAddMesh={handleAddMesh}
      />
    </>
  )
}

export function MeshCreator() {
  const { selectedObject, setSelectedObject } = useAppStore();
  const [selectedInstance, setSelectedInstance] = useState<THREE.Object3D | null>(null);
  const { scene } = useThree();
  
  // Find the actual instance of the selected object in the scene
  useEffect(() => {
    if (!selectedObject) {
      setSelectedInstance(null);
      return;
    }
    
    // Try to find the object in the scene with the same ID
    // Use both UUID and userData.id for matching
    const selectedId = selectedObject.uuid;
    const selectedUserDataId = selectedObject.userData?.id;
    let foundObject: THREE.Object3D | null = null;
    
    console.log(`Looking for selected object: uuid=${selectedId}, userData.id=${selectedUserDataId}`);
    
    // Try first by ID, which is more reliable
    if (selectedUserDataId) {
      scene.traverse(object => {
        console.log(object, object.userData?.id, selectedUserDataId)
        if (object.userData?.id === selectedUserDataId) {
          foundObject = object;
        }
      });
    }
    
    // If not found by ID, try by UUID
    if (!foundObject) {
      scene.traverse(object => {
        if (object.uuid === selectedId) {
          foundObject = object;
        }
      });
    }
    
    // Update the selected instance if found
    if (foundObject) {
      const objectName = (foundObject as THREE.Object3D).userData?.name || 'unnamed';
      console.log(`Found object in scene: ${objectName}`);
      setSelectedInstance(foundObject);
    } else {
      console.warn(`Object not found in scene, clearing selection`);
      // Clear the selection if not found
      setSelectedObject(null);
    }
  }, [selectedObject, scene, setSelectedObject]);
  
  const handleObjectSelected = (object: THREE.Object3D | null) => {
    console.log("Object selected/deselected:", object);
    
    if (object === null) {
      setSelectedObject(null);
      return;
    }
    
    // Look for a parent group first - this ensures we select the entire tree
    // rather than individual components
    let targetObject = object;
    let found = false;
    
    // Traverse up the parent chain to find a user-created group
    let currentObj = object;
    while (currentObj.parent && !(currentObj.parent instanceof THREE.Scene)) {
      if ((currentObj.parent.userData?.isUserCreated || currentObj.parent.userData?.isSerializedFromCode) &&
          currentObj.parent instanceof THREE.Group) {
        targetObject = currentObj.parent;
        found = true;
        console.log(`Using parent group for selection: ${targetObject.userData?.name || 'unnamed'}`);
        break;
      }
      currentObj = currentObj.parent;
    }
    
    // If we didn't find a suitable parent group, check if the clicked object is valid
    if (!found) {
      if (!(targetObject.userData?.isUserCreated || targetObject.userData?.isSerializedFromCode)) {
        console.warn("Only user-created objects can be transformed");
        return;
      }
    }
    
    // If clicking the already selected object, deselect it
    const objectId = targetObject.userData?.id || targetObject.uuid;
    const selectedObjectId = selectedObject?.userData?.id || selectedObject?.uuid;
    
    if (selectedObject && objectId === selectedObjectId) {
      console.log("Clicked already selected object, deselecting");
      setSelectedObject(null);
      return;
    }
    
    console.log(`Selecting object: id=${objectId}, type=${targetObject instanceof THREE.Group ? 'Group' : 'Mesh'}`);
    setSelectedObject(targetObject);
  }
  
  const handleDeselect = () => {
    setSelectedObject(null)
  }
  
  return (
    <>
      <Bvh>
        {/* The actual objects are now rendered by the StoredObjects component */}
      </Bvh>
      
      <ObjectHighlighter 
        onObjectSelected={handleObjectSelected}
      />
      
      {selectedInstance && selectedInstance.userData?.isUserCreated && (
        <CustomTransformControls 
          object={selectedInstance}
          onDeselect={handleDeselect}
        />
      )}
    </>
  )
} 