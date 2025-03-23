import { useRef, useState, useEffect, useCallback } from 'react'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore, useObjectStore } from '@/store/appStore'
import { useThree } from '@react-three/fiber'

interface CustomTransformControlsProps {
  object: THREE.Object3D | null
  onDeselect?: () => void
}

export function CustomTransformControls({ object, onDeselect }: CustomTransformControlsProps) {
  const { transformMode, setTransformMode, isDeleting } = useAppStore();
  const { updateObject } = useObjectStore();
  const transformControlsRef = useRef<any>(null);
  const [lastClick, setLastClick] = useState<number>(0);
  const { scene } = useThree();
  const [isObjectInScene, setIsObjectInScene] = useState(false);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const debug = process.env.NODE_ENV === 'development';
  
  // Raycaster setup for double-click detection
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  
  // When object changes, update the ref to prevent stale closures
  useEffect(() => {
    objectRef.current = object;
  }, [object]);
  
  // Validate if object is actually in the scene - use a separate effect to prevent infinite loops
  useEffect(() => {
    // Skip if no object or if object is already stored in ref (to prevent loops)
    if (!object) {
      setIsObjectInScene(false);
      return;
    }
    
    // Check if object is in the scene hierarchy - only needed once when object changes
    const checkObjectInScene = () => {
      let isInScene = false;
      
      // First check direct parent relationship
      if (object.parent) {
        // Now trace up to make sure it connects to scene
        let currentParent: THREE.Object3D | null = object.parent;
        while (currentParent) {
          if (currentParent === scene) {
            isInScene = true;
            break;
          }
          currentParent = currentParent.parent;
        }
      }
      
      if (!isInScene) {
        console.warn(`Selected object ${object.uuid} is not in scene, cannot attach controls`);
        if (onDeselect) onDeselect();
      } else {
        setIsObjectInScene(true);
      }
    };
    
    // Only check on mount or when object changes
    checkObjectInScene();
  }, [object, onDeselect, scene]);
  
  // Set a global flag to indicate that TransformControls is handling the event
  const handlePointerDown = (event: any) => {
    console.log("Pointer down on TransformControls");
    window.__transformControlsActive = true;
    
    // Stop propagation
    if (event.stopPropagation) {
      event.stopPropagation();
    }
  };
  
  const handleMouseUp = (event: any) => {
    console.log("Mouse up event on TransformControls");
    
    // Mark event as handled by transform controls
    window.__transformControlsActive = true;
    
    // Stop propagation to prevent the event from reaching the object
    if (event.stopPropagation) {
      event.stopPropagation();
    }
    
    // Prevent default behavior
    if (event.preventDefault) {
      event.preventDefault();
    }
    
    const now = Date.now();
    console.log("Time since last click:", now - lastClick, "ms");
    
    if (now - lastClick < 500) {
      console.log("Quick click detected, toggling mode");
      toggleMode();
    }
    
    setLastClick(now);
    
    // Reset the flag after a short delay
    setTimeout(() => {
      window.__transformControlsActive = false;
    }, 100);
  };
  
  const toggleMode = useCallback(() => {
    if (!transformControlsRef.current) return;
    
    const modes = ['translate', 'rotate', 'scale'];
    const currentIndex = modes.indexOf(transformMode || 'translate');
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex] as 'translate' | 'rotate' | 'scale';
    
    console.log("Toggling from", transformMode, "to", nextMode);
    setTransformMode(nextMode);
  }, [transformMode, setTransformMode]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'q') {
        console.log("Keyboard shortcut: toggling transform mode");
        toggleMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transformMode, toggleMode]);
  
  // Handle changes to object position/rotation/scale
  const handleObjectChange = useCallback(() => {
    const currentObject = objectRef.current;
    if (!currentObject) return;
    
    // Skip updates during deletion
    if (isDeleting) return;
    
    // Get the object's ID from userData or UUID
    const id = currentObject.userData?.id || currentObject.uuid;
    
    // Debounce updates to avoid too many state changes
    if (window.__lastTransformUpdate && Date.now() - window.__lastTransformUpdate < 50) {
      return;
    }
    
    window.__lastTransformUpdate = Date.now();
    
    // Update the stored object with new transform values 
    updateObject(id, {
      position: [currentObject.position.x, currentObject.position.y, currentObject.position.z],
      rotation: [currentObject.rotation.x, currentObject.rotation.y, currentObject.rotation.z],
      scale: [currentObject.scale.x, currentObject.scale.y, currentObject.scale.z]
    });
    
    console.log(`Updated object ${id} in store with new transforms`);
  }, [updateObject, isDeleting]);
  
  // Only render if we have a valid object in the scene
  if (!object || !object.parent) {
    return null;
  }
  
  // Don't render if the object isn't in the scene tree
  if (!isObjectInScene) {
    return null;
  }
  
  // Don't render during deletion
  if (isDeleting) {
    return null;
  }
  
  // Add the double click handler to the object for mode toggling
  if (object && !object.userData.doubleClickHandler) {
    object.userData.doubleClickHandler = toggleMode;
  }
  
  return (
    <TransformControls
      ref={transformControlsRef}
      object={object}
      mode={transformMode}
      size={0.75}
      onPointerDown={handlePointerDown}
      onMouseUp={handleMouseUp}
      onPointerUp={handleMouseUp}
      onChange={handleObjectChange}
    />
  );
}

// Extend the Window interface to include our custom flag
declare global {
  interface Window {
    __pendingObject?: THREE.Mesh | THREE.Group;
    __transformControlsActive?: boolean;
    __environmentSettings?: {
      showOcean?: boolean;
    };
    __shiftKeyPressed?: boolean;
    __lastTransformUpdate?: number;
  }
} 