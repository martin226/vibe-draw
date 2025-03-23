"use client"

import './App.css'
import { Canvas } from '@react-three/fiber'
import { Sky, GizmoHelper, GizmoViewport, Bvh } from '@react-three/drei'
import { InfiniteGrid } from '@/components/three/InfiniteGrid'
import { FirstPersonController } from '@/components/three/FirstPersonController'
import { Perf } from 'r3f-perf'
import { MeshCreator } from '@/components/three/MeshCreator'
import { useAppStore } from '@/store/appStore'
import { useEffect, useRef, useState } from 'react'
import { Crosshair } from '@/components/three/Crosshair'
import * as THREE from 'three'
import { StoredObjects } from '@/components/three/StoredObjects'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { useThree } from '@react-three/fiber'
import { Ocean } from '@/components/three/Ocean'

const FocusDetector = () => {
  const { setUIFocused } = useAppStore()
  
  useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = document.activeElement
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      setUIFocused(isInput)
    }
    
    document.addEventListener('focusin', handleFocusChange)
    document.addEventListener('focusout', handleFocusChange)
    
    handleFocusChange()
    
    return () => {
      document.removeEventListener('focusin', handleFocusChange)
      document.removeEventListener('focusout', handleFocusChange)
    }
  }, [setUIFocused])
  
  return null
}

// Component to manage ocean visibility and grid visibility
function OceanAndGridManager() {
  const [showOcean, setShowOcean] = useState(false)
  
  useEffect(() => {
    // Check for environment settings on each render
    const checkSettings = () => {
      // @ts-ignore - Accessing custom window property
      const settings = window.__environmentSettings
      if (settings && typeof settings.showOcean === 'boolean') {
        setShowOcean(settings.showOcean)
      }
    }
    
    // Initial check
    checkSettings()
    
    // Set up interval to check periodically for changes
    const intervalId = setInterval(checkSettings, 500)
    
    return () => clearInterval(intervalId)
  }, [])
  
  return (
    <>
      {/* Show Ocean only when enabled */}
      {showOcean ? <Ocean /> : <InfiniteGrid />}
    </>
  )
}

function ExampleCube() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData = {
        isUserCreated: true,
        name: "Example Cube"
      }
    }
  }, [])
  
  return (
    <mesh 
      ref={meshRef}
      position={[2, 1, 0]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}

function ExampleGroup() {
  const groupRef = useRef<THREE.Group>(null)
  
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData = {
        isUserCreated: true,
        name: "Example Group"
      }
    }
  }, [])
  
  return (
    <group 
      ref={groupRef}
      position={[-2, 1, 0]}
    >
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="cyan" />
      </mesh>
      <mesh position={[0.7, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="yellow" />
      </mesh>
      <mesh position={[0.35, 0.7, 0]} rotation={[0, 0, Math.PI/4]}>
        <boxGeometry args={[0.3, 0.3, 0.8]} />
        <meshStandardMaterial color="lime" />
      </mesh>
    </group>
  )
}

// Component to handle scene export
function SceneExporter() {
  const { scene } = useThree()
  
  // Store scene reference in a global variable for external access
  useEffect(() => {
    // @ts-ignore - We're adding a custom property to window
    window.__threeScene = scene
  }, [scene])
  
  return null
}

export default function ThreeJSCanvas({
  visible = true
}: {
  visible?: boolean
}) {
  const exportScene = () => {
    // @ts-ignore - Access the scene from the global variable
    const scene = window.__threeScene
    if (!scene) return

    console.log('Original scene:', scene);
    
    // Create a temporary scene with only user-created objects
    const exportScene = new THREE.Scene();
    
    // Clone only user-created objects
    scene.traverse((object: THREE.Object3D) => {
      if (object.userData && object.userData.isUserCreated === true) {
        console.log('Found user object to export:', object.userData.name || 'Unnamed object');
        const clonedObject = object.clone();
        exportScene.add(clonedObject);
      }
    });
    
    // Check if we found any user objects
    if (exportScene.children.length === 0) {
      console.warn('No user-created objects found to export');
      alert('No user-created objects found to export. Try creating some objects first.');
      return;
    }
    
    console.log('Export scene with filtered objects:', exportScene);
    
    const exporter = new GLTFExporter();
    exporter.parse(
      exportScene,
      (gltf: any) => {
        console.log('GLTF export successful:', gltf);
        const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'scene.gltf';
        link.click();
      },
      (error: ErrorEvent) => {
        console.error('An error happened during export:', error);
        alert('Failed to export scene: ' + error.message);
      },
      { binary: false }
    );
  }
  
  return (
    <>
      <Canvas
        style={{
          display: visible ? 'block' : 'none',
        }}
        gl={{
          // Preserve the WebGL context to prevent it from being killed
          // when there are too many WebGL instances
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
          // Keep the priority high for this WebGL context
          antialias: true, 
          // Attempt to make this context more important than others
          failIfMajorPerformanceCaveat: false,
        }}
      >
        {visible && <Perf position="top-left" />}
        <ambientLight intensity={Math.PI / 2} />
        <Sky 
          distance={450000} 
          sunPosition={[0, 1, 0]} 
          inclination={0} 
          azimuth={0.25} 
          rayleigh={1} 
        />
        {visible && <FirstPersonController />}
        {visible && <OceanAndGridManager />}
        <Bvh>
          {/* Center pole removed */}
          {/* <ExampleCube />
          <ExampleGroup /> */}
          <StoredObjects />
        </Bvh>
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="black" />
        </GizmoHelper>
        {visible && <MeshCreator />}
        {visible && <SceneExporter />}
      </Canvas>
      
      {visible && (
        <>
          <FocusDetector />
          <Crosshair />
          {/* Button to export scene as gltf */}
          <button 
            onClick={exportScene}
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              padding: '8px 16px',
              background: '#4a5568',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              zIndex: 100
            }}
          >
            Export GLTF
          </button>
        </>
      )}
    </>
  )
}