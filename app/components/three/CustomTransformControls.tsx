import { useRef, useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TransformControls as ThreeTransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { useAppStore } from '@/store/appStore'

interface CustomTransformControlsProps {
  object: THREE.Object3D | null
  onDeselect?: () => void
}

const TRANSFORM_MODES = ['translate', 'rotate', 'scale'] as const;
type TransformMode = typeof TRANSFORM_MODES[number];

// Create a simple component that doesn't render anything but adds TransformControls to the scene
export function CustomTransformControls({ object, onDeselect }: CustomTransformControlsProps) {
  const { scene, camera, gl } = useThree();
  const { transformMode, setTransformMode } = useAppStore();
  
  // Maintain a reference to the controls
  const controlsRef = useRef<ThreeTransformControls | null>(null);
  
  // Handle double click event to cycle modes
  const cycleTransformMode = useCallback(() => {
    if (!controlsRef.current) return;
    
    const currentMode = controlsRef.current.mode;
    const currentIndex = TRANSFORM_MODES.indexOf(currentMode as TransformMode);
    const nextIndex = (currentIndex + 1) % TRANSFORM_MODES.length;
    const newMode = TRANSFORM_MODES[nextIndex];
    
    controlsRef.current.setMode(newMode);
    setTransformMode(newMode);
  }, [setTransformMode]);
  
  // Create and manage the transform controls
  useEffect(() => {
    if (!object || !camera) return;
    
    // Clean up any existing controls first
    if (controlsRef.current) {
      controlsRef.current.dispose();
    }
    
    // Create new controls and attach to the object
    const controls = new ThreeTransformControls(camera, gl.domElement);
    controls.size = 0.75;
    controls.attach(object);
    
    // Set the initial mode
    const initialMode = transformMode || 'translate';
    controls.setMode(initialMode);
    
    // Add controls to the scene - they are a normal Object3D
    // Need to cast to Object3D since TypeScript doesn't recognize that TransformControls extends Object3D
    scene.add(controls as unknown as THREE.Object3D);
    controlsRef.current = controls;
    
    // Set up keyboard shortcut
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'q') {
        cycleTransformMode();
      }
    };
    
    // Set up double click handling
    const handleDoubleClick = (event: MouseEvent) => {
      // We want to filter for double clicks only on the controls
      // Since we can't easily test that, we'll leave it as is for now
      cycleTransformMode();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('dblclick', handleDoubleClick);
    
    return () => {
      // Clean up
      if (controls) {
        controls.detach();
        scene.remove(controls as unknown as THREE.Object3D);
        controls.dispose();
      }
      
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [object, camera, gl.domElement, scene, cycleTransformMode, transformMode]);
  
  // No need to return any JSX since we're manually adding to the scene
  return null;
} 