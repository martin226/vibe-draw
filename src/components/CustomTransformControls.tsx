import { useState, useRef, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAppStore } from '../store/appStore'

interface CustomTransformControlsProps {
  object: THREE.Object3D | null
  onDeselect?: () => void
}

// Transform mode cycling order
const TRANSFORM_MODES = ['translate', 'rotate', 'scale'] as const;
type TransformMode = typeof TRANSFORM_MODES[number];

// NO UI components inside the 3D context!
export function CustomTransformControls({ object, onDeselect }: CustomTransformControlsProps) {
  const [mode, setMode] = useState<TransformMode>('translate');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  
  // Update global mode state in store
  const { setTransformMode } = useAppStore();
  
  // Keep the global state updated with the current mode
  useEffect(() => {
    setTransformMode(mode);
  }, [mode, setTransformMode]);
  
  // Handle double click to cycle between modes
  useEffect(() => {
    if (!object) return;
    
    // Create a handler for double clicks
    const handleDoubleClick = () => {
      // Cycle to the next mode
      const currentIndex = TRANSFORM_MODES.indexOf(mode);
      const nextIndex = (currentIndex + 1) % TRANSFORM_MODES.length;
      setMode(TRANSFORM_MODES[nextIndex]);
    };
    
    // Attach the double-click listener to the object
    if (object.userData) {
      object.userData.doubleClickHandler = handleDoubleClick;
    }
    
    return () => {
      // Clean up the handler when component unmounts or object changes
      if (object.userData) {
        delete object.userData.doubleClickHandler;
      }
    };
  }, [object, mode]);
  
  // Listen for 'Escape' key to deselect object
  useEffect(() => {
    if (!object) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onDeselect) {
        onDeselect();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [object, onDeselect]);
  
  // Make transform controls aware of dragging state to prevent camera movement during transform
  useEffect(() => {
    if (!controlsRef.current) return;
    
    const controls = controlsRef.current;
    
    const handleMouseDown = () => {
      // When transforming an object, disable the pointer lock controls
      gl.domElement.style.cursor = 'grabbing';
    };
    
    const handleMouseUp = () => {
      // When done transforming, restore normal behavior
      gl.domElement.style.cursor = 'auto';
    };
    
    controls.addEventListener('mouseDown', handleMouseDown);
    controls.addEventListener('mouseUp', handleMouseUp);
    
    return () => {
      controls.removeEventListener('mouseDown', handleMouseDown);
      controls.removeEventListener('mouseUp', handleMouseUp);
    };
  }, [gl]);
  
  // If no object is selected, don't render the controls
  if (!object) return null;
  
  return (
    <TransformControls 
      ref={controlsRef}
      object={object} 
      mode={mode} 
      size={0.75}
      camera={camera}
    />
  );
} 