import { create } from 'zustand'
import * as THREE from 'three'

type TransformMode = 'translate' | 'rotate' | 'scale';

interface AppState {
  // UI interaction state
  isUIFocused: boolean
  isCodeEditorOpen: boolean
  meshCount: number
  selectedObject: THREE.Object3D | null
  transformMode: TransformMode
  
  // Actions
  setUIFocused: (focused: boolean) => void
  setCodeEditorOpen: (open: boolean) => void
  incrementMeshCount: () => void
  setSelectedObject: (object: THREE.Object3D | null) => void
  setTransformMode: (mode: TransformMode) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isUIFocused: false,
  isCodeEditorOpen: false,
  meshCount: 0,
  selectedObject: null,
  transformMode: 'translate',
  
  // Actions
  setUIFocused: (focused) => set({ isUIFocused: focused }),
  setCodeEditorOpen: (open) => set({ isCodeEditorOpen: open }),
  incrementMeshCount: () => set((state) => ({ meshCount: state.meshCount + 1 })),
  setSelectedObject: (object) => set({ selectedObject: object }),
  setTransformMode: (mode) => set({ transformMode: mode })
})) 