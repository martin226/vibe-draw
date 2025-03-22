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
  const { transformMode, setTransformMode } = useAppStore();
  const { updateObject } = useObjectStore();
  const transformControlsRef = useRef<any>(null);
  const [lastClick, setLastClick] = useState<number>(0);
  const { scene } = useThree();
  const [isObjectInScene, setIsObjectInScene] = useState(false);
  const debug = process.env.NODE_ENV === 'development';
  
  // Raycaster setup for double-click detection
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  
  // Validate if object is actually in the scene
  useEffect(() => {
    if (!object) {
      setIsObjectInScene(false);
      return;
    }
    
    // Check if object is in the scene hierarchy
    let isInScene = false;
    const checkObject = (o: THREE.Object3D) => {
      if (o === object) {
        isInScene = true;
        return;
      }
      
      for (const child of o.children) {
        checkObject(child);
        if (isInScene) break;
      }
    };
    
    // Start checking from scene root
    checkObject(scene);
    
    console.log(`Object ${object.uuid} is ${isInScene ? '' : 'NOT '} in scene`);
    setIsObjectInScene(isInScene);
    
    if (!isInScene && object) {
      console.warn(`Selected object ${object.uuid} is not in scene, cannot attach controls`);
      if (onDeselect) onDeselect();
    }
  }, [object, scene, onDeselect]);
  
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
    if (!object) return;
    
    // Get the object's ID from userData or UUID
    const id = object.userData?.id || object.uuid;
    
    // Update the stored object with new transform values
    updateObject(id, {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z]
    });
    
    console.log(`Updated object ${id} in store with new transforms`);
  }, [object, updateObject]);
  
  // Only render if we have a valid object in the scene
  if (!object || !object.parent) {
    console.warn("TransformControls: object is null or not in scene");
    return null;
  }
  
  // Don't render if the object isn't in the scene tree
  if (!isObjectInScene) {
    console.warn("TransformControls: object is not in the scene hierarchy");
    return null;
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
  }
} 