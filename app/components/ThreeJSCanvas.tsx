'use client'

import { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Basic camera controls
function CameraControls() {
  const { camera, gl } = useThree()
  
  useEffect(() => {
    const target = new THREE.Vector3(0, 0, 0)
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!event.buttons) return
      
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1
      
      const distance = camera.position.length()
      camera.position.x = Math.sin(x * Math.PI) * distance
      camera.position.z = Math.cos(x * Math.PI) * distance
      camera.position.y = y * 2 + 1
      
      camera.lookAt(target)
    }
    
    gl.domElement.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      gl.domElement.removeEventListener('mousemove', handleMouseMove)
    }
  }, [camera, gl])
  
  return null
}

// Rotating cube component
function RotatingCube() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame(() => {
    if (!meshRef.current) return
    
    meshRef.current.rotation.x += 0.01
    meshRef.current.rotation.y += 0.01
  })
  
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshNormalMaterial />
    </mesh>
  )
}

// Scene component
function Scene() {
  return (
    <>
      <color attach="background" args={['#111']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      
      <RotatingCube />
      
      {/* Simple floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>
      
      <CameraControls />
    </>
  )
}

export function ThreeJSCanvas({ visible = true }: { visible?: boolean }) {
  return (
    <div 
      className="w-full h-full"
      style={{ 
        display: visible ? 'block' : 'none' 
      }}
    >
      <Canvas
        className="w-full h-full"
        camera={{ position: [0, 1, 5], fov: 50 }}
        gl={{ 
          antialias: true,
          alpha: true
        }}
      >
        <Scene />
      </Canvas>
    </div>
  )
} 