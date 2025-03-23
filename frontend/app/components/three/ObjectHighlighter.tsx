import { useState, useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAppStore, useObjectStore } from '@/store/appStore'

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
  const { isUIFocused, selectedObject, setIsDeleting } = useAppStore()
  
  // Get object store methods
  const { removeObject } = useObjectStore()
  
  // Store original materials for selected objects
  const originalMaterials = useRef(new Map<THREE.Object3D, THREE.Material | THREE.Material[]>())
  
  // Store original materials for hovered objects
  const hoveredMaterials = useRef(new Map<THREE.Object3D, THREE.Material | THREE.Material[]>())
  
  // Apply tint to selected object
  useEffect(() => {
    // Function to apply tint to a mesh
    const applyTint = (object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        // Store original material if not already stored
        if (!originalMaterials.current.has(object)) {
          originalMaterials.current.set(object, object.material);
        }
        
        const material = object.material;
        
        // If material is an array, clone and tint each material
        if (Array.isArray(material)) {
          object.material = material.map(mat => {
            const clonedMat = mat.clone();
            // Add a slight blue tint to indicate selection
            if ('color' in clonedMat) {
              clonedMat.color.multiplyScalar(0.8).add(new THREE.Color(0, 0.2, 0.5));
            }
            return clonedMat;
          });
        } else {
          // Clone material and add a blue tint
          const clonedMaterial = material.clone();
          if ('color' in clonedMaterial) {
            clonedMaterial.color.multiplyScalar(0.8).add(new THREE.Color(0, 0.2, 0.5));
          }
          object.material = clonedMaterial;
        }
      }
      
      // Process children recursively
      object.children.forEach(child => applyTint(child));
    };
    
    // Function to restore original materials
    const restoreOriginalMaterial = (object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        const originalMaterial = originalMaterials.current.get(object);
        if (originalMaterial) {
          object.material = originalMaterial;
          originalMaterials.current.delete(object);
        }
      }
      
      // Process children recursively
      object.children.forEach(child => restoreOriginalMaterial(child));
    };
    
    // Apply tint to newly selected object, restore previous
    if (selectedObject) {
      applyTint(selectedObject);
    }
    
    // Restore materials for all stored objects that aren't the selected object
    originalMaterials.current.forEach((_, obj) => {
      if (obj !== selectedObject) {
        restoreOriginalMaterial(obj);
      }
    });
    
    // Cleanup when component unmounts
    return () => {
      originalMaterials.current.forEach((_, obj) => {
        restoreOriginalMaterial(obj);
      });
    };
  }, [selectedObject]);
  
  // Apply hover tint effect
  useEffect(() => {
    // CHANGE 1: Don't show hover tint if any object is selected
    if (!hoveredObject || selectedObject) {
      // Clear any previous hover effects
      hoveredMaterials.current.forEach((originalMaterial, obj) => {
        if (obj instanceof THREE.Mesh && 
            !originalMaterials.current.has(obj)) {
          obj.material = originalMaterial;
          hoveredMaterials.current.delete(obj);
        }
      });
      return;
    }
    
    // Apply hover tint to the hovered object
    const applyHoverTint = (object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh && 
          !originalMaterials.current.has(object)) { // Don't apply hover to selected objects
        // Store original material if not already stored
        if (!hoveredMaterials.current.has(object)) {
          hoveredMaterials.current.set(object, object.material);
        }
        
        const material = object.material;
        
        // If material is an array, clone and tint each material
        if (Array.isArray(material)) {
          object.material = material.map(mat => {
            const clonedMat = mat.clone();
            // Add a slight yellow tint for hover
            if ('color' in clonedMat) {
              clonedMat.color.multiplyScalar(0.9).add(new THREE.Color(0.3, 0.3, 0));
            }
            return clonedMat;
          });
        } else {
          // Clone material and add a yellow tint
          const clonedMaterial = material.clone();
          if ('color' in clonedMaterial) {
            clonedMaterial.color.multiplyScalar(0.9).add(new THREE.Color(0.3, 0.3, 0));
          }
          object.material = clonedMaterial;
        }
      }
      
      // Process children recursively
      object.children.forEach(child => applyHoverTint(child));
    };
    
    // Restore hover materials for objects that are no longer hovered
    hoveredMaterials.current.forEach((originalMaterial, obj) => {
      if (obj !== hoveredObject && 
          !originalMaterials.current.has(obj) && // Don't restore if it's the selected object
          obj instanceof THREE.Mesh) {
        obj.material = originalMaterial;
        hoveredMaterials.current.delete(obj);
      }
    });
    
    // Improved hover tinting for Shift key
    const isShiftKeyPressed = window.__shiftKeyPressed === true;
    let targetObject = hoveredObject;
    
    // Handle hover tinting based on Shift key state
    if (isShiftKeyPressed) {
      // Only proceed if the hovered object actually has children
      if (hoveredObject.children && hoveredObject.children.length > 0) {
        // STRICT FILTER: Only consider DIRECT children that are user-created
        const directChildren = hoveredObject.children.filter(child => 
          (child.userData?.isUserCreated || child.userData?.isSerializedFromCode) &&
          (child instanceof THREE.Group || child instanceof THREE.Mesh || child instanceof THREE.Object3D)
        );
        
        if (directChildren.length > 0) {
          // Use raycasting to determine which direct child to highlight
          const childRaycaster = new THREE.Raycaster();
          childRaycaster.setFromCamera(mouse.current, camera);
          
          // Only raycast against direct children of the hovered object
          const childIntersects = childRaycaster.intersectObjects(directChildren, true);
          
          if (childIntersects.length > 0) {
            // Find the first intersected object that's a direct child or a descendant of a direct child
            let intersectedDirectChild = null;
            
            for (const intersect of childIntersects) {
              const hitObject = intersect.object;
              
              // Check if this is a direct child
              if (directChildren.includes(hitObject)) {
                intersectedDirectChild = hitObject;
                break;
              }
              
              // If not a direct child, find which direct child is an ancestor
              for (const directChild of directChildren) {
                if (isDescendantOf(hitObject, directChild)) {
                  intersectedDirectChild = directChild;
                  break;
                }
              }
              
              if (intersectedDirectChild) break;
            }
            
            if (intersectedDirectChild) {
              // We found a direct child that was hit by the ray
              targetObject = intersectedDirectChild;
            } else {
              // Fallback: First try to find a Group among direct children
              const directGroupChild = directChildren.find(c => c instanceof THREE.Group);
              
              if (directGroupChild) {
                targetObject = directGroupChild;
              } else {
                // Otherwise just pick the first direct child
                targetObject = directChildren[0];
              }
            }
          } else {
            // Fallback if raycasting didn't hit anything
            const directGroupChild = directChildren.find(c => c instanceof THREE.Group);
            
            if (directGroupChild) {
              targetObject = directGroupChild;
            } else {
              targetObject = directChildren[0];
            }
          }
        }
      }
      // If no suitable direct children, keep the hovered object as target
    } else {
      // Normal behavior - highlight top-level group
      let currentObj = hoveredObject;
      while (currentObj.parent && !(currentObj.parent instanceof THREE.Scene)) {
        if ((currentObj.parent.userData?.isUserCreated || currentObj.parent.userData?.isSerializedFromCode) &&
            currentObj.parent instanceof THREE.Group) {
          targetObject = currentObj.parent;
        }
        currentObj = currentObj.parent;
      }
    }
    
    // Apply hover tint to the target object
    applyHoverTint(targetObject);
    
    // Cleanup on unmount
    return () => {
      hoveredMaterials.current.forEach((originalMaterial, obj) => {
        if (obj instanceof THREE.Mesh && !originalMaterials.current.has(obj)) {
          obj.material = originalMaterial;
        }
      });
      hoveredMaterials.current.clear();
    };
  }, [hoveredObject, selectedObject]);
  
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
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        window.__shiftKeyPressed = false;
      }
    };
    
    // Clear shift key state when window loses focus
    const handleBlur = () => {
      window.__shiftKeyPressed = false;
    };
    
    // Handle keyboard events (delete, shift key)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift key handling
      if (e.key === 'Shift') {
        window.__shiftKeyPressed = true;
        return;
      }
      
      // Deleting the selected object with backspace or delete
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedObject && !isUIFocused) {
        e.preventDefault(); // Prevent browser navigation
        e.stopPropagation(); // Stop other handlers
        console.log("Deleting selected object:", selectedObject.userData?.name);
        
        try {
          // Mark that we're in a deletion process
          setIsDeleting(true);
          
          // Get the object's ID for removal from store
          const objectId = selectedObject.userData?.id || selectedObject.uuid;
          const objectToRemove = selectedObject; // Keep a reference to the object
          
          // First clean up any material references to prevent memory leaks
          const cleanupObject = (obj: THREE.Object3D) => {
            if (obj instanceof THREE.Mesh) {
              // Clean up from original materials map
              if (originalMaterials.current.has(obj)) {
                originalMaterials.current.delete(obj);
              }
              
              // Clean up from hovered materials map
              if (hoveredMaterials.current.has(obj)) {
                hoveredMaterials.current.delete(obj);
              }
              
              // Dispose of geometry and materials to prevent memory leaks
              if (obj.geometry) {
                obj.geometry.dispose();
              }
              
              if (obj.material) {
                if (Array.isArray(obj.material)) {
                  obj.material.forEach(mat => mat.dispose());
                } else {
                  obj.material.dispose();
                }
              }
            }
            
            // Process children
            [...obj.children].forEach(child => {
              cleanupObject(child);
            });
          };
          
          // Clean up resources
          cleanupObject(objectToRemove);
          
          // Clear the selection before removing the object
          // Use direct state setting to avoid circular update issues
          useAppStore.setState({ selectedObject: null });
          
          // Break the update cycle by waiting a tick
          setTimeout(() => {
            try {
              // Remove from parent (scene) - do this inside timeout to break loop
              if (objectToRemove.parent) {
                objectToRemove.parent.remove(objectToRemove);
                
                // Remove any global references
                if (window.__objectReferences) {
                  window.__objectReferences.delete(objectId);
                  window.__objectReferences.delete(`${objectId}_geometry`);
                  window.__objectReferences.delete(`${objectId}_material`);
                }
              }
              
              // Clear hover state if needed
              if (hoveredObject === objectToRemove) {
                setHoveredObject(null);
              }
              
              // Remove from object store to prevent recreation
              // The store will handle resetting isDeleting
              removeObject(objectId);
            } catch (innerError) {
              console.error("Error in delete timeout callback:", innerError);
              // Make sure we reset the deleting flag
              useAppStore.setState({ isDeleting: false });
            }
          }, 0);
        } catch (error) {
          console.error("Error deleting object:", error);
          // Make sure we reset the deleting flag
          useAppStore.setState({ isDeleting: false });
        }
      }
    };
    
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
          console.log("ObjectHighlighter: click on object", hoveredObject.userData?.name || 'unnamed', "uuid:", hoveredObject.uuid);
          
          // Improved Shift+Click behavior for selecting direct children
          const isShiftKeyPressed = window.__shiftKeyPressed === true;
          if (isShiftKeyPressed) {
            let targetObject = hoveredObject;
            
            // Log the parent object's structure for debugging
            console.log("Hovered object:", hoveredObject.userData?.name || 'unnamed', 
                        "type:", hoveredObject instanceof THREE.Group ? 'Group' : 
                               hoveredObject instanceof THREE.Mesh ? 'Mesh' : 'Object3D',
                        "uuid:", hoveredObject.uuid);
            
            // ONLY proceed if the hovered object actually has children (like a Group)
            if (hoveredObject.children && hoveredObject.children.length > 0) {
              console.log("Direct children count:", hoveredObject.children.length);
              
              // STRICT FILTER: Only consider DIRECT children and ensure they're user-created
              const directChildren = hoveredObject.children.filter(child => 
                (child.userData?.isUserCreated || child.userData?.isSerializedFromCode) &&
                (child instanceof THREE.Group || child instanceof THREE.Mesh || child instanceof THREE.Object3D)
              );
              
              if (directChildren.length > 0) {
                console.log("User-created direct children:", directChildren.map(c => ({
                  name: c.userData?.name || 'unnamed',
                  type: c instanceof THREE.Group ? 'Group' : c instanceof THREE.Mesh ? 'Mesh' : 'Object3D'
                })));
                
                // NEW: Use raycasting to determine which direct child to select
                // Raycasting against just the direct children
                const childRaycaster = new THREE.Raycaster();
                childRaycaster.setFromCamera(mouse.current, camera);
                
                // Only raycast against direct children of the hovered object
                const childIntersects = childRaycaster.intersectObjects(directChildren, true);
                
                if (childIntersects.length > 0) {
                  // Find the first intersected object that's a direct child or a descendant of a direct child
                  let intersectedDirectChild = null;
                  
                  for (const intersect of childIntersects) {
                    const hitObject = intersect.object;
                    
                    // Check if this is a direct child
                    if (directChildren.includes(hitObject)) {
                      intersectedDirectChild = hitObject;
                      break;
                    }
                    
                    // If not a direct child, find which direct child is an ancestor
                    for (const directChild of directChildren) {
                      if (isDescendantOf(hitObject, directChild)) {
                        intersectedDirectChild = directChild;
                        break;
                      }
                    }
                    
                    if (intersectedDirectChild) break;
                  }
                  
                  if (intersectedDirectChild) {
                    // We found a direct child that was hit by the ray
                    targetObject = intersectedDirectChild;
                    console.log("Raycast hit direct child:", targetObject.userData?.name || 'unnamed');
                  } else {
                    // Fallback: First try to find a Group among direct children
                    const directGroupChild = directChildren.find(c => c instanceof THREE.Group);
                    
                    if (directGroupChild) {
                      targetObject = directGroupChild;
                      console.log("Fallback to direct GROUP child:", targetObject.userData?.name || 'unnamed');
                    } else {
                      // Otherwise just pick the first direct child
                      targetObject = directChildren[0];
                      console.log("Fallback to first direct child:", targetObject.userData?.name || 'unnamed');
                    }
                  }
                } else {
                  // Fallback if raycasting didn't hit anything
                  const directGroupChild = directChildren.find(c => c instanceof THREE.Group);
                  
                  if (directGroupChild) {
                    targetObject = directGroupChild;
                    console.log("No raycast hit, using first GROUP child");
                  } else {
                    targetObject = directChildren[0];
                    console.log("No raycast hit, using first child");
                  }
                }
              } else {
                console.log("No suitable direct children found, keeping hovered object");
              }
            } else {
              console.log("Hovered object has no children, keeping it as target");
            }
            
            // Double-check we have a valid object to select
            if (targetObject && (targetObject.userData?.isUserCreated || targetObject.userData?.isSerializedFromCode)) {
              console.log("Final shift+click selection:", targetObject.userData?.name || 'unnamed', "uuid:", targetObject.uuid);
              onObjectSelected(targetObject);
            } else {
              console.warn("No valid object to select");
            }
            return;
          }
          
          // STANDARD BEHAVIOR: Look for a parent group first (unchanged)
          let targetObject = hoveredObject;
          let found = false;
          
          // Traverse up the parent chain to find a user-created group
          let currentObj = hoveredObject;
          while (currentObj.parent && !(currentObj.parent instanceof THREE.Scene)) {
            if ((currentObj.parent.userData?.isUserCreated || currentObj.parent.userData?.isSerializedFromCode) &&
                currentObj.parent instanceof THREE.Group) {
              targetObject = currentObj.parent;
              found = true;
              console.log(`Using parent group for selection: ${targetObject.userData?.name || 'unnamed'}`);
              break;
            }
            currentObj = currentObj.parent;
          }
          
          // If we didn't find a suitable parent group, check if the clicked object is valid
          if (!found) {
            if (!(targetObject.userData?.isUserCreated || targetObject.userData?.isSerializedFromCode)) {
              console.warn("Only user-created objects can be transformed");
              return;
            }
          }
          
          // If clicking the already selected object, deselect it
          const objectId = targetObject.userData?.id || targetObject.uuid;
          const selectedObjectId = selectedObject?.userData?.id || selectedObject?.uuid;
          
          if (selectedObject && objectId === selectedObjectId) {
            console.log("Clicked already selected object, deselecting");
            onObjectSelected(null);
            return;
          }
          
          console.log(`Selecting object: id=${objectId}, type=${targetObject instanceof THREE.Group ? 'Group' : 'Mesh'}`);
          // Only set if it's different to avoid unnecessary updates
          if (!selectedObject || objectId !== selectedObjectId) {
            onObjectSelected(targetObject);
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
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('dblclick', handleDoubleClick)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [gl, hoveredObject, onObjectSelected, isUIFocused, selectedObject, removeObject, setIsDeleting])
  
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
        
        // Find top-level user-created parent to use as hovered object
        // This ensures we always start with the highest level group
        let topLevelObject = intersectedObject;
        let currentObj = intersectedObject;
        
        while (currentObj.parent && !(currentObj.parent instanceof THREE.Scene)) {
          if ((currentObj.parent.userData?.isUserCreated || currentObj.parent.userData?.isSerializedFromCode) &&
              (currentObj.parent instanceof THREE.Group || currentObj.parent instanceof THREE.Object3D)) {
            topLevelObject = currentObj.parent;
          }
          currentObj = currentObj.parent;
        }
        
        if (hoveredObject !== topLevelObject) {
          setHoveredObject(topLevelObject);
          // Add debug output to see what's being selected as the hovered object
          console.log("Set hovered object:", topLevelObject.userData?.name || 'unnamed', 
                      "type:", topLevelObject instanceof THREE.Group ? 'Group' : 
                            topLevelObject instanceof THREE.Mesh ? 'Mesh' : 'Object3D');
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

// CHANGE 6: Update the Window interface to include __shiftKeyPressed instead of __altKeyPressed
declare global {
  interface Window {
    __pendingObject?: THREE.Mesh | THREE.Group;
    __transformControlsActive?: boolean;
    __environmentSettings?: {
      showOcean?: boolean;
    };
    __shiftKeyPressed?: boolean;
    __lastTransformUpdate?: number;
    __objectReferences?: Map<string, any>;
  }
} 

// Helper function to check if an object is a descendant of another
function isDescendantOf(object: THREE.Object3D, potentialAncestor: THREE.Object3D): boolean {
  let parent = object.parent;
  while (parent) {
    if (parent === potentialAncestor) return true;
    parent = parent.parent;
  }
  return false;
} 