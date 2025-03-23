import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Euler, Quaternion } from 'three'
import nipplejs from 'nipplejs'
import { useControls } from 'leva'
import { useAppStore } from '@/store/appStore'

interface MovementState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

export function FirstPersonController() {
  const { camera, gl } = useThree()
  const joystickContainerRef = useRef<HTMLDivElement>(null)
  const joystickInstanceRef = useRef<nipplejs.JoystickManager | null>(null)
  const isTouchDevice = useRef(false)
  const isLocked = useRef(false)
  
  const euler = useRef(new Euler(0, 0, 0, 'YXZ'))
  const quaternion = useRef(new Quaternion())
  
  const { isUIFocused, isCodeEditorOpen } = useAppStore()

  const { speed, sensitivity, showOcean } = useControls('Settings', {
    speed: {
      value: 10,
      min: 5,
      max: 30,
      step: 1,
      label: 'Movement Speed'
    },
    sensitivity: {
      value: 0.002,
      min: 0.0005,
      max: 0.01,
      step: 0.0005,
      label: 'Mouse Sensitivity'
    },
    showOcean: {
      value: false,
      label: 'Show Ocean'
    }
  })

  useEffect(() => {
    // @ts-ignore - Adding a custom property to window for global access
    window.__environmentSettings = { showOcean }
  }, [showOcean])

  const [movement, setMovement] = useState<MovementState>({
    forward: false,
    backward: false,
    left: false,
    right: false
  })

  const direction = useRef(new Vector3())
  const velocity = useRef(new Vector3())

  const justFocusedUI = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement;
    
    euler.current.setFromQuaternion(camera.quaternion);
    
    const onCanvasClick = (event: MouseEvent) => {
      if (justFocusedUI.current) {
        justFocusedUI.current = false;
        return;
      }
      
      if (event.target === canvas && !isUIFocused && !isCodeEditorOpen) {
        if (canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      }
    };

    const onPointerLockChange = () => {
      isLocked.current = document.pointerLockElement === canvas;
    };
    
    const onMouseMove = (event: MouseEvent) => {
      if (!isLocked.current) return;
      
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;
      
      euler.current.y -= movementX * sensitivity;
      euler.current.x = Math.max(
        -Math.PI / 2 + 0.01, 
        Math.min(Math.PI / 2 - 0.01, euler.current.x - movementY * sensitivity)
      );
      
      quaternion.current.setFromEuler(euler.current);
      camera.quaternion.copy(quaternion.current);
    };
    
    const onUIFocus = () => {
      if (isLocked.current && document.exitPointerLock) {
        justFocusedUI.current = true;
        document.exitPointerLock();
      }
    };
    
    canvas.addEventListener('click', onCanvasClick);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    
    const inputs = document.querySelectorAll('input, textarea, button, [tabindex]');
    inputs.forEach(el => el.addEventListener('focus', onUIFocus));
    
    return () => {
      canvas.removeEventListener('click', onCanvasClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      
      inputs.forEach(el => el.removeEventListener('focus', onUIFocus));
      
      if (document.pointerLockElement === canvas && document.exitPointerLock) {
        document.exitPointerLock();
      }
    };
  }, [gl, camera, isUIFocused, isCodeEditorOpen, sensitivity]);

  useEffect(() => {
    if (isUIFocused && isLocked.current && document.exitPointerLock) {
      justFocusedUI.current = true;
      document.exitPointerLock();
    }
  }, [isUIFocused, isCodeEditorOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isUIFocused || isCodeEditorOpen || (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.code) {
        case 'KeyW':
          setMovement(prev => ({ ...prev, forward: true }))
          break
        case 'KeyS':
          setMovement(prev => ({ ...prev, backward: true }))
          break
        case 'KeyA':
          setMovement(prev => ({ ...prev, left: true }))
          break
        case 'KeyD':
          setMovement(prev => ({ ...prev, right: true }))
          break
        case 'Escape':
          if (document.pointerLockElement === gl.domElement && document.exitPointerLock) {
            document.exitPointerLock();
          }
          break
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isUIFocused || isCodeEditorOpen || (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.code) {
        case 'KeyW':
          setMovement(prev => ({ ...prev, forward: false }))
          break
        case 'KeyS':
          setMovement(prev => ({ ...prev, backward: false }))
          break
        case 'KeyA':
          setMovement(prev => ({ ...prev, left: false }))
          break
        case 'KeyD':
          setMovement(prev => ({ ...prev, right: false }))
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isUIFocused, isCodeEditorOpen, gl.domElement])

  useEffect(() => {
    camera.position.set(0, 1.7, 5)
  }, [camera])
  
  // Create joystick outside the Canvas component to avoid rendering HTML inside Three.js
  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    
    if (isTouchDevice.current) {
      // Create a container for the joystick
      const joystickContainer = document.createElement('div')
      joystickContainer.style.position = 'absolute'
      joystickContainer.style.bottom = '100px' // Position higher from bottom
      joystickContainer.style.left = '100px' // Position further from left
      joystickContainer.style.width = '120px' // Larger touch target
      joystickContainer.style.height = '120px' // Larger touch target
      joystickContainer.style.zIndex = '1000'
      
      // Add visual indicator for the joystick container
      joystickContainer.style.background = 'rgba(40, 40, 40, 0.7)' // Dark background with more opacity
      joystickContainer.style.borderRadius = '50%' // Make it circular
      joystickContainer.style.border = '2px solid rgba(100, 100, 100, 0.8)' // Darker border
      
      // Add a label to explain how to use
      const label = document.createElement('div')
      label.innerText = 'Move'
      label.style.position = 'absolute'
      label.style.bottom = '170px' // Position above the joystick
      label.style.left = '100px'
      label.style.width = '120px'
      label.style.textAlign = 'center'
      label.style.color = '#FFFFFF' // Explicit white color
      label.style.fontSize = '14px'
      label.style.fontWeight = 'bold'
      label.style.textShadow = '2px 2px 3px black' // Stronger shadow for better visibility
      document.body.appendChild(label)
      
      document.body.appendChild(joystickContainer)
      
      const joystick = nipplejs.create({
        zone: joystickContainer,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: '#444444',
        size: 100,
        lockX: false,
        lockY: false,
        dynamicPage: true
      })
      
      // Make the joystick more responsive
      joystick.on('move', (_, data) => {
        // Lower threshold for increased sensitivity (0.2 instead of 0.3)
        const forward = data.vector.y > 0.2
        const backward = data.vector.y < -0.2
        const left = data.vector.x < -0.2
        const right = data.vector.x > 0.2
        
        // Update movement based on joystick position
        setMovement({ forward, backward, left, right })
      })
      
      joystick.on('end', () => {
        setMovement({ forward: false, backward: false, left: false, right: false })
      })
      
      joystickInstanceRef.current = joystick
      
      // Add a rotation joystick for camera control on touch devices
      const rotationJoystickContainer = document.createElement('div')
      rotationJoystickContainer.style.position = 'absolute'
      rotationJoystickContainer.style.bottom = '100px'
      rotationJoystickContainer.style.right = '100px' // Position on the right side
      rotationJoystickContainer.style.width = '120px'
      rotationJoystickContainer.style.height = '120px'
      rotationJoystickContainer.style.zIndex = '1000'
      rotationJoystickContainer.style.background = 'rgba(40, 40, 40, 0.7)' // Dark background with more opacity
      rotationJoystickContainer.style.borderRadius = '50%'
      rotationJoystickContainer.style.border = '2px solid rgba(100, 100, 100, 0.8)' // Darker border
      
      // Add a label for the rotation joystick
      const rotationLabel = document.createElement('div')
      rotationLabel.innerText = 'Look'
      rotationLabel.style.position = 'absolute'
      rotationLabel.style.bottom = '170px'
      rotationLabel.style.right = '100px'
      rotationLabel.style.width = '120px'
      rotationLabel.style.textAlign = 'center'
      rotationLabel.style.color = '#FFFFFF' // Explicit white color
      rotationLabel.style.fontSize = '14px'
      rotationLabel.style.fontWeight = 'bold'
      rotationLabel.style.textShadow = '2px 2px 3px black' // Stronger shadow for better visibility
      document.body.appendChild(rotationLabel)
      
      document.body.appendChild(rotationJoystickContainer)
      
      const rotationJoystick = nipplejs.create({
        zone: rotationJoystickContainer,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: '#444444',
        size: 100
      })
      
      // Handle camera rotation with the second joystick
      rotationJoystick.on('move', (_, data) => {
        // Rotate the camera based on joystick position
        const rotationSpeed = 0.02 // Reduced from 0.05 to make it less sensitive
        
        euler.current.y -= data.vector.x * rotationSpeed
        
        // Invert Y-axis: multiply by -1 to invert (note the sign change)
        const pitchLimit = Math.PI / 3 // Limit vertical rotation
        euler.current.x = Math.max(
          -pitchLimit,
          Math.min(pitchLimit, euler.current.x + data.vector.y * rotationSpeed)
        )
        
        quaternion.current.setFromEuler(euler.current)
        camera.quaternion.copy(quaternion.current)
      })
      
      return () => {
        joystick.destroy()
        document.body.removeChild(joystickContainer)
        document.body.removeChild(label)
        
        rotationJoystick.destroy()
        document.body.removeChild(rotationJoystickContainer)
        document.body.removeChild(rotationLabel)
      }
    }
  }, [camera.quaternion])
  
  useFrame((_, delta) => {
    direction.current.z = Number(movement.forward) - Number(movement.backward)
    direction.current.x = Number(movement.right) - Number(movement.left)
    direction.current.normalize()
    
    if (movement.forward || movement.backward || movement.left || movement.right) {
      const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      forward.normalize()
      
      const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      right.normalize()
      
      velocity.current.set(0, 0, 0)
      
      const frameSpeed = speed * delta;
      
      if (movement.forward) velocity.current.add(forward.multiplyScalar(frameSpeed))
      if (movement.backward) velocity.current.sub(forward.multiplyScalar(frameSpeed))
      if (movement.right) velocity.current.add(right.multiplyScalar(frameSpeed))
      if (movement.left) velocity.current.sub(right.multiplyScalar(frameSpeed))
      
      camera.position.add(velocity.current)
    }
  })
  
  // Return null instead of a div element which causes errors in R3F
  return null
} 