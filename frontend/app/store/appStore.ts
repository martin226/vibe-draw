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
  }
})) 