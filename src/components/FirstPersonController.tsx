import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import nipplejs from 'nipplejs'
import { PointerLockControls } from '@react-three/drei'
import { useControls } from 'leva'
import { useAppStore } from '../store/appStore'

interface MovementState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

export function FirstPersonController() {
  const { camera, gl } = useThree()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)
  const joystickContainerRef = useRef<HTMLDivElement>(null)
  const joystickInstanceRef = useRef<nipplejs.JoystickManager | null>(null)
  const isTouchDevice = useRef(false)
  
  // Get the UI focus state from the store
  const { isUIFocused, isCodeEditorOpen } = useAppStore()

  const { speed } = useControls('Movement', {
    speed: {
      value: 0.2,
      min: 0.1,
      max: 3,
      step: 0.1,
      label: 'Speed'
    }
  })

  const [movement, setMovement] = useState<MovementState>({
    forward: false,
    backward: false,
    left: false,
    right: false
  })

  const direction = useRef(new Vector3())
  const velocity = useRef(new Vector3())

  useEffect(() => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    
    const canvas = gl.domElement;

    const handleCanvasClick = (e: MouseEvent) => {
      if (e.target === canvas) {
        const isUIElement = isClickingUIElement(e);
        
        if (!isUIElement && !isUIFocused) {
          if (controls.lock) {
            controls.lock();
          }
        }
      }
    };
    
    const isClickingUIElement = (e: MouseEvent): boolean => {
      const target = e.target as HTMLElement;
      const uiSelectors = [
        '.code-editor', 
        '.mesh-creator-button', 
        '.add-mesh-button',
        '.template-selector',
        '.close-button',
        'button', 
        'input', 
        'textarea'
      ];
      
      const isUI = uiSelectors.some(selector => {
        if (target.matches && target.matches(selector)) {
          return true;
        }
        
        return target.closest && target.closest(selector) !== null;
      });
      
      return isUI;
    };
    
    canvas.addEventListener('click', handleCanvasClick);
    
    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [gl, isUIFocused]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle key events if we're focused on the UI or specifically the code editor
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
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Still handle key up events to avoid stuck movement keys
      // But check if we're focused on UI elements
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
  }, [isUIFocused, isCodeEditorOpen])

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
  
  useFrame(() => {
    if (controlsRef.current) {
      direction.current.z = Number(movement.forward) - Number(movement.backward)
      direction.current.x = Number(movement.right) - Number(movement.left)
      direction.current.normalize()
      
      if (movement.forward || movement.backward || movement.left || movement.right) {
        const forward = new Vector3(0, 0, -1)
        forward.applyQuaternion(camera.quaternion)
        forward.normalize()
        
        const right = new Vector3(1, 0, 0)
        right.applyQuaternion(camera.quaternion)
        right.normalize()
        
        velocity.current.set(0, 0, 0)
        
        if (movement.forward) velocity.current.add(forward.multiplyScalar(speed))
        if (movement.backward) velocity.current.sub(forward.multiplyScalar(speed))
        if (movement.right) velocity.current.add(right.multiplyScalar(speed))
        if (movement.left) velocity.current.sub(right.multiplyScalar(speed))
        
        camera.position.add(velocity.current)
      }
    }
  })
  
  useEffect(() => {
    camera.position.set(0, 1.7, 5)
  }, [camera])
  
  return (
    <>
      <PointerLockControls ref={controlsRef} />
      {isTouchDevice.current && (
        <div ref={joystickContainerRef} />
      )}
    </>
  )
} 