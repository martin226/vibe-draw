import { useState, useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Bvh } from '@react-three/drei'
import { useAppStore } from '@/store/appStore'
import { CustomTransformControls } from '@/components/three/CustomTransformControls'
import { ObjectHighlighter } from '@/components/three/ObjectHighlighter'

export function MeshCreator() {
  const { selectedObject, setSelectedObject, isDeleting } = useAppStore();
  const [selectedInstance, setSelectedInstance] = useState<THREE.Object3D | null>(null);
  const { scene } = useThree();
  
  // Find the actual instance of the selected object in the scene
  useEffect(() => {
    if (!selectedObject) {
      setSelectedInstance(null);
      return;
    }
    
    // Skip the effect during deletion operations
    if (isDeleting) {
      return;
    }
    
    // Skip the effect if we already have the right instance
    if (selectedInstance && 
        (selectedInstance.uuid === selectedObject.uuid || 
         selectedInstance.userData?.id === selectedObject.userData?.id)) {
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
      
      // Check if the object is actually still in the scene hierarchy
      let isInScene = false;
      let currentParent: THREE.Object3D | null = (foundObject as THREE.Object3D).parent;
      while (currentParent && !isInScene) {
        if (currentParent === scene) {
          isInScene = true;
        }
        currentParent = currentParent.parent;
      }
      
      if (!isInScene) {
        console.warn(`Object ${objectName} (${selectedId}) was found but not in scene hierarchy`);
        // Clear the selection since object is not actually in scene
        setSelectedObject(null);
        setSelectedInstance(null);
        return;
      }
      
      // Ensure the object has the doubleClickHandler set
      // Cast to THREE.Object3D to fix TypeScript error
      const objWithProps = foundObject as THREE.Object3D & {
        userData: { 
          doubleClickHandler?: () => void,
          [key: string]: any
        }
      };
      
      if (!objWithProps.userData.doubleClickHandler) {
        objWithProps.userData.doubleClickHandler = () => {
          const { transformMode, setTransformMode } = useAppStore.getState();
          const modes = ['translate', 'rotate', 'scale'];
          const currentIndex = modes.indexOf(transformMode || 'translate');
          const nextIndex = (currentIndex + 1) % modes.length;
          const nextMode = modes[nextIndex] as 'translate' | 'rotate' | 'scale';
          setTransformMode(nextMode);
        };
      }
      
      setSelectedInstance(foundObject);
    } else {
      console.warn(`Object not found in scene, clearing selection`);
      // Clear the selection if not found
      setSelectedObject(null);
      setSelectedInstance(null);
    }
  }, [selectedObject, scene, setSelectedObject, isDeleting]);
  
  const handleObjectSelected = (object: THREE.Object3D | null) => {
    console.log("Object selected/deselected:", object);
    
    // Skip selection changes during deletion
    if (isDeleting) {
      console.log("Skipping selection during deletion");
      return;
    }
    
    if (object === null) {
      // Only update if we actually have a selection to clear
      if (selectedObject !== null) {
        setSelectedObject(null);
      }
      return;
    }
    
    // Check if the shift key is pressed - if so, we'll select one layer down from the object
    // rather than traversing up to find a parent group
    const isShiftKeyPressed = window.__shiftKeyPressed === true;
    
    if (isShiftKeyPressed) {
      // When Shift key is pressed, we're looking for children one level down from the object
      // This is handled in ObjectHighlighter, which will pass us the appropriate child
      
      console.log("Shift key pressed, selecting:", object.userData?.name || 'unnamed');
      
      if (object.userData?.isUserCreated || object.userData?.isSerializedFromCode) {
        // If clicking the already selected object, deselect it
        const objectId = object.userData?.id || object.uuid;
        const selectedObjectId = selectedObject?.userData?.id || selectedObject?.uuid;
        
        if (selectedObject && objectId === selectedObjectId) {
          console.log("Deselecting object");
          setSelectedObject(null);
          return;
        }
        
        // Only set if it's a different object
        if (!selectedObject || objectId !== selectedObjectId) {
          setSelectedObject(object);
        }
      }
      return;
    }
    
    // Normal behavior - look for a parent group first
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
    // Only set if it's different to avoid unnecessary updates
    if (!selectedObject || objectId !== selectedObjectId) {
      setSelectedObject(targetObject);
    }
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
      
      {selectedInstance && 
        (selectedInstance.userData?.isUserCreated || selectedInstance.userData?.isSerializedFromCode) && (
        <CustomTransformControls 
          object={selectedInstance}
          onDeselect={handleDeselect}
        />
      )}
    </>
  )
} 