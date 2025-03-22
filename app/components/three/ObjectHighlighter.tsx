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
  const originalMaterials = useRef<Map<THREE.Object3D, THREE.Material | THREE.Material[]>>(new Map())
  
  // Create a single shared highlight material to avoid memory leaks
  const highlightMaterial = useRef<THREE.MeshBasicMaterial>(
    new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    })
  )
  
  // Get UI focus state and selected object from store
  const { isUIFocused, selectedObject } = useAppStore()
  
  // Function to restore original material
  const restoreOriginalMaterial = useCallback(() => {
    try {
      if (hoveredObject) {
        if (hoveredObject instanceof THREE.Mesh) {
          const original = originalMaterials.current.get(hoveredObject)
          if (original) {
            hoveredObject.material = original
            originalMaterials.current.delete(hoveredObject)
          }
        } else if (hoveredObject instanceof THREE.Group) {
          // For groups, restore materials for all mesh children
          hoveredObject.traverse(child => {
            if (child instanceof THREE.Mesh) {
              const original = originalMaterials.current.get(child)
              if (original) {
                child.material = original
                originalMaterials.current.delete(child)
              }
            }
          });
        }
        
        setHoveredObject(null)
      }
    } catch (error) {
      console.error("Error in restoreOriginalMaterial:", error);
      // Reset state to avoid stuck highlights
      setHoveredObject(null);
      originalMaterials.current.clear();
    }
  }, [hoveredObject])
  
  // Update mouse position - this works even with pointer lock
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // If UI is focused, don't update mouse for highlighting
      if (isUIFocused) return
      
      // Check pointer lock state
      isPointerLocked.current = document.pointerLockElement === gl.domElement
      
      if (isPointerLocked.current) {
        // When in pointer lock, use the center of the screen for highlighting
        // This makes it so you can highlight what's in the center of your view
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
        // If we're not in pointer lock mode and clicking on UI, don't process
        if (!isPointerLocked.current && e.target !== gl.domElement) {
          return;
        }
        
        if (hoveredObject && onObjectSelected && !isUIFocused) {
          // If clicking on the already selected object, deselect it
          if (hoveredObject === selectedObject) {
            // Deselect by calling onObjectSelected with null
            onObjectSelected(null);
          } 
          // Otherwise, select it if it's user-created
          else if (hoveredObject.userData?.isUserCreated) {
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
  
  // Reset highlighting when pointer lock changes
  useEffect(() => {
    const handlePointerLockChange = () => {
      try {
        isPointerLocked.current = document.pointerLockElement === gl.domElement
        
        // Reset highlighted object when toggling pointer lock
        if (hoveredObject) {
          restoreOriginalMaterial()
        }
      } catch (error) {
        console.error("Error in handlePointerLockChange:", error);
      }
    }
    
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
    }
  }, [gl, hoveredObject, restoreOriginalMaterial])
  
  // Create a function to store original material and apply highlight material
  const highlightObject = (object: THREE.Object3D) => {
    try {
      if (object !== hoveredObject) {
        // Restore previous highlighted object's material
        restoreOriginalMaterial()
        
        // ONLY highlight the object if it's user-created
        if (object.userData && object.userData.isUserCreated) {
          if (object instanceof THREE.Mesh && object.material) {
            // We need to store the original material before replacing it
            originalMaterials.current.set(object, object.material)
            
            // Apply our shared highlight material (don't clone it)
            object.material = highlightMaterial.current;
            
            setHoveredObject(object)
          } 
          else if (object instanceof THREE.Group) {
            // For groups, we'll highlight all mesh children
            object.traverse(child => {
              if (child instanceof THREE.Mesh && child.material) {
                // Store original materials for all children
                originalMaterials.current.set(child, child.material)
                // Apply highlight material
                child.material = highlightMaterial.current;
              }
            });
            
            // Set the parent group as the hovered object
            setHoveredObject(object)
          }
        }
      }
    } catch (error) {
      console.error("Error in highlightObject:", error);
    }
  }
  
  // Using useFrame to perform raycasting on each frame
  useFrame(() => {
    try {
      // Skip if UI is focused
      if (isUIFocused) {
        if (hoveredObject) {
          restoreOriginalMaterial()
        }
        return
      }
      
      // Update the raycaster
      raycaster.current.setFromCamera(mouse.current, camera)
      
      // Filter for meshes and groups that are user created, excluding any specified objects
      const filterFunction = (obj: THREE.Object3D) => {
        return (obj instanceof THREE.Mesh || obj instanceof THREE.Group) && 
               !excludeObjects.includes(obj) && 
               obj.userData && 
               obj.userData.isUserCreated;
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
      
      // Handle highlighting
      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        highlightObject(intersectedObject);
      } else if (hoveredObject) {
        restoreOriginalMaterial();
      }
    } catch (error) {
      console.error("Error in useFrame:", error);
    }
  })
  
  // Clean up any leftover highlight materials when component unmounts
  useEffect(() => {
    return () => {
      try {
        if (hoveredObject) {
          restoreOriginalMaterial();
        }
      } catch (error) {
        console.error("Error in cleanup:", error);
      }
    };
  }, [hoveredObject, restoreOriginalMaterial]);
  
  return null
} 