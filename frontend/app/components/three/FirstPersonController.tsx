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

  const { speed, sensitivity, showOcean } = useControls('Environment & Movement', {
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
        canvas.requestPointerLock();
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
      if (isLocked.current) {
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
      
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl, camera, isUIFocused, isCodeEditorOpen, sensitivity]);

  useEffect(() => {
    if (isUIFocused && isLocked.current) {
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
          if (document.pointerLockElement === gl.domElement) {
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
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    
    if (isTouchDevice.current && joystickContainerRef.current) {
      const joystickContainer = document.createElement('div')
      joystickContainer.style.position = 'absolute'
      joystickContainer.style.bottom = '50px'
      joystickContainer.style.left = '50px'
      joystickContainer.style.width = '100px'
      joystickContainer.style.height = '100px'
      joystickContainer.style.zIndex = '1000'
      document.body.appendChild(joystickContainer)
      
      const joystick = nipplejs.create({
        zone: joystickContainer,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 100
      })
      
      joystick.on('move', (_, data) => {
        const forward = data.vector.y > 0.3
        const backward = data.vector.y < -0.3
        const left = data.vector.x < -0.3
        const right = data.vector.x > 0.3
        
        setMovement({ forward, backward, left, right })
      })
      
      joystick.on('end', () => {
        setMovement({ forward: false, backward: false, left: false, right: false })
      })
      
      joystickInstanceRef.current = joystick
      
      return () => {
        joystick.destroy()
        document.body.removeChild(joystickContainer)
      }
    }
  }, [])
  
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
  
  useEffect(() => {
    camera.position.set(0, 1.7, 5)
  }, [camera])
  
  return (
    <>
      {isTouchDevice.current && (
        <div ref={joystickContainerRef} />
      )}
    </>
  )
} 