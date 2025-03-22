import './App.css'
import { Canvas } from '@react-three/fiber'
import { Sky, GizmoHelper, GizmoViewport, Bvh } from '@react-three/drei'
import { InfiniteGrid } from '@/components/three/InfiniteGrid'
import { FirstPersonController } from '@/components/three/FirstPersonController'
import { Perf } from 'r3f-perf'
import { MeshCreator, MeshCreatorUI } from '@/components/three/MeshCreator'
import { useAppStore } from '@/store/appStore'
import { useEffect, useRef } from 'react'
import { Crosshair } from '@/components/three/Crosshair'
import * as THREE from 'three'

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

export default function ThreeJSCanvas({
  visible = true
}: {
  visible?: boolean
}) {
  return (
    <>
      <Canvas
        style={{
          display: visible ? 'block' : 'none',
        }}
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
          <ExampleGroup />
        </Bvh>
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="black" />
        </GizmoHelper>
        <MeshCreator />
      </Canvas>
      
      <FocusDetector />
      <MeshCreatorUI />
      <Crosshair />
    </>
  )
}