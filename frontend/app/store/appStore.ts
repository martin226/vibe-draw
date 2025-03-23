import { create } from 'zustand'
import * as THREE from 'three'

// Declare global window interface for our object references
declare global {
  interface Window {
    __objectReferences?: Map<string, any>
  }
}

// --------------------------------
// Shared types
// --------------------------------
export type TransformMode = 'translate' | 'rotate' | 'scale';

// Define a simplified object structure for storage
export interface StoredObject {
  id: string;
  type: 'mesh' | 'group' | 'object';
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  userData: Record<string, any>;
  // For a mesh, define its geometry and material
  geometry?: {
    type: string;
    parameters: Record<string, any>;
  };
  material?: {
    type: string;
    color: string;
    parameters: Record<string, any>;
  };
  // For a group, define its children
  children?: StoredObject[];
}

// --------------------------------
// UI State Store (not persisted)
// --------------------------------
interface AppUIState {
  // UI interaction state
  isUIFocused: boolean
  isCodeEditorOpen: boolean
  selectedObject: THREE.Object3D | null
  transformMode: TransformMode
  isDeleting: boolean
  
  // Actions
  setUIFocused: (focused: boolean) => void
  setCodeEditorOpen: (open: boolean) => void
  setSelectedObject: (object: THREE.Object3D | null) => void
  setTransformMode: (mode: TransformMode) => void
  setIsDeleting: (isDeleting: boolean) => void
}

export const useAppStore = create<AppUIState>((set) => ({
  // Initial state
  isUIFocused: false,
  isCodeEditorOpen: false,
  selectedObject: null,
  transformMode: 'translate',
  isDeleting: false,
  
  // Actions
  setUIFocused: (focused) => set({ isUIFocused: focused }),
  setCodeEditorOpen: (open) => set({ isCodeEditorOpen: open }),
  setSelectedObject: (object) => set((state) => {
    // Prevent selection changes during deletion
    if (state.isDeleting) return state;
    return { selectedObject: object };
  }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setIsDeleting: (isDeleting) => set({ isDeleting })
}))

// --------------------------------
// Tab State Store
// --------------------------------
interface TabStoreState {
  activeTab: 'tldraw' | 'threejs'
  setActiveTab: (tab: 'tldraw' | 'threejs') => void
}

export const useTabStore = create<TabStoreState>((set) => ({
  activeTab: 'tldraw',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

// --------------------------------
// Object Store (no longer persisted)
// --------------------------------
interface ObjectStoreState {
  // Storage
  objects: StoredObject[]
  meshCount: number
  
  // Actions
  incrementMeshCount: () => void
  addObject: (object: THREE.Object3D) => void
  updateObject: (id: string, updates: Partial<StoredObject>) => void
  removeObject: (id: string) => void
  clearObjects: () => void
  addObjectFromCode: (code: string) => THREE.Object3D | null
  addObjectWithGltf: (url: string) => Promise<THREE.Object3D | null>
}

// Helper to convert a THREE.Object3D to a StoredObject
const threeObjectToStoredObject = (object: THREE.Object3D): StoredObject => {
  console.log(`Storing object: ${object.uuid}, type: ${object.type}`);
  
  // Use the UUID consistently - critical for object identity
  const id = object.uuid;
  const name = object.userData?.name || `Object ${id.substring(0, 8)}`;
  const position: [number, number, number] = [object.position.x, object.position.y, object.position.z];
  const rotation: [number, number, number] = [object.rotation.x, object.rotation.y, object.rotation.z];
  const scale: [number, number, number] = [object.scale.x, object.scale.y, object.scale.z];
  
  // Ensure the userData.id is set consistently
  object.userData.id = id;
  object.userData.isSerializedFromCode = true;
  
  // Store as global reference to prevent garbage collection
  if (!window.__objectReferences) {
    window.__objectReferences = new Map();
  }
  window.__objectReferences.set(id, object);
  
  if (object instanceof THREE.Mesh) {
    console.log(`Storing mesh: ${id}, geometry: ${object.geometry.type}`);
    // Get original geometry and material to preserve as much data as possible
    const geo = object.geometry;
    const mat = object.material as THREE.Material;
    
    // Store references to prevent garbage collection
    window.__objectReferences.set(`${id}_geometry`, geo);
    window.__objectReferences.set(`${id}_material`, mat);
    
    return {
      id,
      type: 'mesh',
      name,
      position,
      rotation,
      scale,
      userData: { ...object.userData },
      geometry: {
        type: geo.type,
        parameters: {
          // We store the ID to look it up later
          objectId: id
        },
      },
      material: {
        type: mat.type,
        color: mat instanceof THREE.MeshStandardMaterial ? 
               mat.color?.getHexString() || 'ffffff' : 'ffffff',
        parameters: {
          // We store the ID to look it up later
          objectId: id
        },
      },
    };
  } else if (object instanceof THREE.Group) {
    console.log(`Storing group: ${id}, children: ${object.children.length}`);
    // Process children
    const children: StoredObject[] = [];
    object.children.forEach(child => {
      if (child instanceof THREE.Object3D) {
        children.push(threeObjectToStoredObject(child));
      }
    });
    
    return {
      id,
      type: 'group',
      name,
      position,
      rotation,
      scale,
      userData: { ...object.userData },
      children,
    };
  }
  
  // Handle generic THREE.Object3D objects
  console.log(`Storing generic object3D: ${id}`);
  
  // Process children if any
  const children: StoredObject[] = [];
  if (object.children.length > 0) {
    object.children.forEach(child => {
      if (child instanceof THREE.Object3D) {
        children.push(threeObjectToStoredObject(child));
      }
    });
  }
  
  return {
    id,
    type: 'object',
    name,
    position,
    rotation,
    scale,
    userData: { ...object.userData },
    children: children.length > 0 ? children : undefined
  };
};

// Helper function to prepare materials for proper rendering
const prepareMaterial = (material: THREE.Material) => {
  // Common fixes for materials
  if (material) {
    // Ensure the material is using appropriate side setting (GLTF often uses backside only)
    material.side = THREE.DoubleSide;
    
    // Ensure color is properly set for common material types
    if (material instanceof THREE.MeshStandardMaterial) {
      // Make sure color has a proper value and not black by default
      if (!material.color || material.color.getHex() === 0x000000) {
        material.color.set(0xcccccc); // Set a light gray as fallback
      }
      // Increase emission for better visibility
      if (material.emissive && material.emissive.getHex() === 0) {
        material.emissive.set(0x111111);
      }
      // Make sure materials reflect light properly
      material.metalness = material.metalness || 0.3;
      material.roughness = material.roughness || 0.7;
    } else if (material instanceof THREE.MeshBasicMaterial) {
      // For basic materials, ensure color is not black
      if (!material.color || material.color.getHex() === 0x000000) {
        material.color.set(0xcccccc);
      }
    } else if (material instanceof THREE.MeshPhongMaterial || 
               material instanceof THREE.MeshLambertMaterial) {
      // Ensure the material color isn't black
      if (!material.color || material.color.getHex() === 0x000000) {
        material.color.set(0xcccccc);
      }
    }
    
    // Ensure textures are properly set up if present
    if ('map' in material && material.map) {
      // Use proper casting for TypeScript
      (material.map as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    }
    
    // Update the material to apply changes
    material.needsUpdate = true;
  }
};

export const useObjectStore = create<ObjectStoreState>()((set, get) => ({
  // Initial state
  objects: [],
  meshCount: 0,
  
  // Actions
  incrementMeshCount: () => set((state) => ({ meshCount: state.meshCount + 1 })),
  
  addObject: (object: THREE.Object3D) => {
    const storedObject = threeObjectToStoredObject(object);
    set((state) => ({
      objects: [...state.objects, storedObject],
      meshCount: state.meshCount + 1,
    }));
  },
  
  updateObject: (id: string, updates: Partial<StoredObject>) => {
    set((state) => ({
      objects: state.objects.map(obj => 
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    }));
  },
  
  removeObject: (id: string) => {
    // Get current state
    const appState = useAppStore.getState();
    const { selectedObject, setSelectedObject } = appState;
    
    // Update the objects array first
    set((state) => ({
      objects: state.objects.filter(obj => obj.id !== id),
    }));
    
    // If we're removing the selected object, clear the selection
    // Use direct state setting instead of the setter function
    if (selectedObject && (selectedObject.uuid === id || selectedObject.userData?.id === id)) {
      // Use direct setState to avoid setter function which may have additional logic
      useAppStore.setState({ selectedObject: null });
      
      // Wait a tick before clearing the deletion flag to ensure all updates have propagated
      setTimeout(() => {
        useAppStore.setState({ isDeleting: false });
      }, 10);
    } else {
      // Not deleting the selected object, so just turn off deleting flag
      setTimeout(() => {
        useAppStore.setState({ isDeleting: false });
      }, 10);
    }
  },
  
  clearObjects: () => {
    set({ objects: [], meshCount: 0 });
    useAppStore.getState().setSelectedObject(null);
  },
  
  addObjectFromCode: (code: string) => {
    try {
      // Create a function from the code string
      const createObjectFunction = new Function('THREE', code);
      
      // Execute the function with THREE library as parameter
      const object = createObjectFunction(THREE) as THREE.Object3D;
      
      // Check that the object is a valid THREE.Object3D type (Mesh, Group, or generic Object3D)
      if (!(object instanceof THREE.Object3D)) {
        console.log("object:", object);
        console.error('The code must return a THREE.Object3D, THREE.Mesh, or THREE.Group object');
        return null;
      }
      
      // Log the specific type for debugging
      if (object instanceof THREE.Mesh) {
        console.log('Adding Mesh from code');
      } else if (object instanceof THREE.Group) {
        console.log('Adding Group from code');
      } else if (object instanceof THREE.Object3D) {
        console.log('Adding generic Object3D from code');
      }
      
      // Set properties
      object.userData.isUserCreated = true;
      object.userData.name = `User Object ${get().meshCount + 1}`;
      
      // Add to store - threeObjectToStoredObject will handle the specific type
      get().addObject(object);
      
      return object;
    } catch (err) {
      console.error('Error executing code:', err);
      return null;
    }
  },
  
  addObjectWithGltf: async (url: string) => {
    try {
      // Dynamically import GLTFLoader
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf) => {
            const model = gltf.scene;
            
            if (!(model instanceof THREE.Object3D)) {
              console.error('The GLTF file did not return a valid THREE.Object3D');
              resolve(null);
              return;
            }
            
            // Fix materials - traverse the model and ensure materials are properly configured
            model.traverse((object) => {
              if (object instanceof THREE.Mesh) {
                // Enable shadows
                object.castShadow = true;
                object.receiveShadow = true;
                
                // Fix materials
                if (object.material) {
                  // If it's a single material
                  if (!Array.isArray(object.material)) {
                    prepareMaterial(object.material);
                  } else {
                    // If it's an array of materials
                    object.material.forEach(mat => prepareMaterial(mat));
                  }
                }
              }
            });
            
            // Set properties
            model.userData.isUserCreated = true;
            model.userData.name = `GLTF Model ${get().meshCount + 1}`;
            
            // Position the model slightly above the ground to prevent clipping
            model.position.set(0, 1, 0);
            
            // Add to store
            get().addObject(model);
            console.log('Added GLTF model to scene:', model);
            
            resolve(model);
          },
          // Progress callback
          (xhr) => {
            console.log(`${(xhr.loaded / xhr.total * 100)}% loaded`);
          },
          // Error callback
          (error) => {
            console.error('Error loading GLTF model:', error);
            reject(error);
          }
        );
      });
    } catch (err) {
      console.error('Error importing or loading GLTF model:', err);
      return null;
    }
  }
})) 