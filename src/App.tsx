import './App.css'
import { Canvas } from '@react-three/fiber'
import { Sky, GizmoHelper, GizmoViewport, Bvh } from '@react-three/drei'
import { InfiniteGrid } from './components/InfiniteGrid'
import { FirstPersonController } from './components/FirstPersonController'
import { Instructions } from './components/Instructions'
import { Perf } from 'r3f-perf'
import { MeshCreator, MeshCreatorUI } from './components/MeshCreator'
import { useAppStore } from './store/appStore'
import { useEffect, useRef } from 'react'
// import { KeyboardState } from './components/KeyboardState'
import { HelpTooltip } from './components/HelpTooltip'
import { TransformInfo } from './components/TransformInfo'
import * as THREE from 'three'

// Component to detect keyboard focus and touch events
const FocusDetector = () => {
  const { setUIFocused } = useAppStore()
  
  useEffect(() => {
    // Function to check if the active element is an input or text area
    const handleFocusChange = () => {
      const activeElement = document.activeElement
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      setUIFocused(isInput)
    }
    
    // Listen for focus events on the document
    document.addEventListener('focusin', handleFocusChange)
    document.addEventListener('focusout', handleFocusChange)
    
    // Initial check
    handleFocusChange()
    
    return () => {
      document.removeEventListener('focusin', handleFocusChange)
      document.removeEventListener('focusout', handleFocusChange)
    }
  }, [setUIFocused])
  
  return null
}

// Example mesh that can be transformed (for testing)
function ExampleCube() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useEffect(() => {
    // Mark this mesh as a user-created object so it can be transformed
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

function App() {
  return (
    <>
      {/* THREE.JS CONTEXT - Only THREE.js objects allowed here */}
      <Canvas
        className="w-full h-full"
      >
        <Perf position="top-left" />
        <ambientLight intensity={Math.PI / 2} />
        <Sky 
          distance={450000} 
          sunPosition={[0, 1, 0]} 
          inclination={0} 
          azimuth={0.25} 
          rayleigh={1} 
        />
        <FirstPersonController />
        <InfiniteGrid />
        <Bvh>
          <mesh position={[0, 2, 0]} userData={{ name: "Center Pole", isUserCreated: false }}>
            <cylinderGeometry args={[0.1, 0.1, 4]} />
            <meshStandardMaterial color="#888888" />
          </mesh>
          <ExampleCube />
        </Bvh>
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="black" />
        </GizmoHelper>
        <MeshCreator />
      </Canvas>
      
      {/* REACT DOM CONTEXT - Only HTML/DOM elements allowed here */}
      <FocusDetector />
      <Instructions />
      <MeshCreatorUI />
      {/* <KeyboardState /> */}
      <HelpTooltip />
      <TransformInfo />
    </>
  )
}

export default App
