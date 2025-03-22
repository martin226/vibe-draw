import { useState, useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAppStore } from '@/store/appStore'

interface ObjectHighlighterProps {
  onObjectSelected?: (object: THREE.Object3D | null) => void
  excludeObjects?: THREE.Object3D[]
}

export function ObjectHighlighter({ onObjectSelected, excludeObjects = [] }: ObjectHighlighterProps) {
  const { scene, gl, camera } = useThree()
  const [hoveredObject, setHoveredObject] = useState<THREE.Object3D | null>(null)
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2(0, 0))
  const isPointerLocked = useRef(false)
  
  // Get UI focus state and selected object from store
  const { isUIFocused, selectedObject } = useAppStore()
  
  // Update mouse position - this works even with pointer lock
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // If UI is focused, don't update mouse for selection
      if (isUIFocused) return
      
      // Check pointer lock state
      isPointerLocked.current = document.pointerLockElement === gl.domElement
      
      if (isPointerLocked.current) {
        // When in pointer lock, use the center of the screen for selection
        // This makes it so you can select what's in the center of your view
        mouse.current.x = 0
        mouse.current.y = 0
      } else {
        // When not in pointer lock, use regular mouse coordinates
        mouse.current.x = (e.clientX / gl.domElement.clientWidth) * 2 - 1
        mouse.current.y = -(e.clientY / gl.domElement.clientHeight) * 2 + 1
      }
    }
    
    // Track clicks for selection
    const handleClick = (e: MouseEvent) => {
      try {
        // Check if TransformControls is handling this event
        if (window.__transformControlsActive) {
          console.log("ObjectHighlighter: Skipping click because TransformControls is active");
          return;
        }
        
        // If we're not in pointer lock mode and clicking on UI, don't process
        if (!isPointerLocked.current && e.target !== gl.domElement) {
          return;
        }
        
        if (hoveredObject && onObjectSelected && !isUIFocused) {
          console.log("ObjectHighlighter: click on object", hoveredObject.userData?.name);
          
          // Always send the hoveredObject to the parent component
          // Let the parent component decide if it should select or deselect
          if (hoveredObject.userData?.isUserCreated || hoveredObject.userData?.isSerializedFromCode) {
            onObjectSelected(hoveredObject);
          }
        }
      } catch (error) {
        console.error("Error in handleClick:", error);
      }
    }
    
    // Track double clicks for transform control mode cycling
    const handleDoubleClick = () => {
      try {
        // Check if TransformControls is handling this event
        if (window.__transformControlsActive) {
          console.log("ObjectHighlighter: Skipping double-click because TransformControls is active");
          return;
        }
        
        // Only process if we have a hovered object with a double click handler
        if (hoveredObject && !isUIFocused) {
          // Double-click should only work on selected objects
          if (hoveredObject === selectedObject && hoveredObject.userData?.doubleClickHandler) {
            // Call the double click handler attached by the CustomTransformControls
            hoveredObject.userData.doubleClickHandler();
          }
        }
      } catch (error) {
        console.error("Error in handleDoubleClick:", error);
      }
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    window.addEventListener('dblclick', handleDoubleClick)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [gl, hoveredObject, onObjectSelected, isUIFocused, selectedObject])
  
  // Reset when pointer lock changes
  useEffect(() => {
    const handlePointerLockChange = () => {
      try {
        isPointerLocked.current = document.pointerLockElement === gl.domElement
      } catch (error) {
        console.error("Error in handlePointerLockChange:", error);
      }
    }
    
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
    }
  }, [gl])
  
  // Using useFrame to perform raycasting on each frame
  useFrame(() => {
    try {
      // Skip if UI is focused
      if (isUIFocused) {
        setHoveredObject(null);
        return;
      }
      
      // Update the raycaster
      raycaster.current.setFromCamera(mouse.current, camera)
      
      // Filter for meshes and groups that are user created, excluding any specified objects
      const filterFunction = (obj: THREE.Object3D) => {
        return (obj instanceof THREE.Mesh || obj instanceof THREE.Group) && 
               !excludeObjects.includes(obj) && 
               obj.userData && 
               (obj.userData.isUserCreated || obj.userData.isSerializedFromCode);
      }
      
      // Find intersected objects - BVH accelerated through Drei's Bvh component
      // When objects are wrapped in <Bvh>, this raycasting becomes much faster
      const intersects = raycaster.current.intersectObjects(scene.children, true)
        .filter(intersect => {
          // First, if the intersected object is directly usable, use it
          const intersectedObj = intersect.object;
          
          if (filterFunction(intersectedObj)) {
            return true;
          }
          
          // Otherwise, try to find an appropriate parent
          // This handles the case where a child of a group is intersected
          let currentParent = intersectedObj.parent;
          while (currentParent) {
            if (filterFunction(currentParent)) {
              // Important: we replace the object in the intersection data
              // with the parent group to ensure we operate on the correct object
              intersect.object = currentParent;
              return true;
            }
            currentParent = currentParent.parent;
          }
          
          return false;
        });
      
      // Handle object under cursor
      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        if (hoveredObject !== intersectedObject) {
          setHoveredObject(intersectedObject);
        }
      } else if (hoveredObject) {
        setHoveredObject(null);
      }
    } catch (error) {
      console.error("Error in useFrame:", error);
    }
  })
  
  return null
} 