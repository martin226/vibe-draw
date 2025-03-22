import { useState, useCallback, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAppStore } from '@/store/appStore'

interface CustomTransformControlsProps {
  object: THREE.Object3D | null
  onDeselect?: () => void
}

const TRANSFORM_MODES = ['translate', 'rotate', 'scale'] as const;
type TransformMode = typeof TRANSFORM_MODES[number];

export function CustomTransformControls({ object, onDeselect }: CustomTransformControlsProps) {
  const [mode, setMode] = useState<TransformMode>('translate');
  const { camera } = useThree();
  const { setTransformMode } = useAppStore();
  
  // Function to cycle between transform modes
  const cycleTransformMode = useCallback(() => {
    const currentIndex = TRANSFORM_MODES.indexOf(mode);
    const nextIndex = (currentIndex + 1) % TRANSFORM_MODES.length;
    const newMode = TRANSFORM_MODES[nextIndex];
    setMode(newMode);
    setTransformMode(newMode);
  }, [mode, setTransformMode]);
  
  // Setup keyboard event for mode cycling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'q') {
        cycleTransformMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cycleTransformMode]);
  
  // Double click handler to cycle modes
  const handleDoubleClick = useCallback(() => {
    cycleTransformMode();
  }, [cycleTransformMode]);
  
  if (!object) return null;
  
  return (
    <TransformControls
      object={object}
      mode={mode}
      size={0.75}
      camera={camera}
      onDoubleClick={handleDoubleClick}
    />
  );
} 