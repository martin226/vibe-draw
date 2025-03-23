import { useRef, useEffect } from 'react'
import { extend, useFrame, useThree } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'

// Extend R3F with Water so we can use it in JSX
extend({ Water })

export function Ocean() {
  const waterRef = useRef<any>(null)
  const { scene } = useThree()
  
  // Sun position state for both sky and water
  const sunPosition = useRef(new THREE.Vector3(0, 1, 0))
  
  // Fixed parameters for better water appearance
  const elevation = 20
  const azimuth = 180
  const distortionScale = 3.7
  const waterColor = '#0066cc' // More vibrant blue
  
  // Update sun position based on fixed elevation and azimuth
  useEffect(() => {
    const phi = THREE.MathUtils.degToRad(90 - elevation)
    const theta = THREE.MathUtils.degToRad(azimuth)
    
    sunPosition.current.setFromSphericalCoords(1, phi, theta)
    
    if (waterRef.current) {
      waterRef.current.material.uniforms.sunDirection.value.copy(sunPosition.current).normalize()
    }
  }, [])
  
  // Add subtle animation to the water
  useFrame((_, delta) => {
    if (waterRef.current) {
      waterRef.current.material.uniforms.time.value += delta * 0.5
    }
  })
  
  // Create water geometry and config
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000, 1, 1)
  const waterConfig = {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      }
    ),
    sunDirection: sunPosition.current.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: new THREE.Color(waterColor),
    distortionScale: distortionScale,
    size: 1.0,
    fog: scene.fog !== undefined,
  }
  
  return (
    <>
      {/* Sky component with sun position synced to water */}
      <Sky 
        distance={10000}
        sunPosition={sunPosition.current}
        turbidity={10}
        rayleigh={2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      
      {/* Water component */}
      <primitive
        ref={waterRef}
        object={new Water(waterGeometry, waterConfig)}
        rotation-x={-Math.PI / 2}
        position={[0, -1, 0]}
      />
    </>
  )
}

export default Ocean; 