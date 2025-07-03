# Vibe Draw - Complete API Documentation

## Project Overview

Vibe Draw is a revolutionary 3D modeling application that transforms rough 2D sketches into stunning 3D worlds. It combines the simplicity of drawing with the power of AI to make 3D modeling accessible to everyone.

### Architecture

**Frontend**: Next.js/React application with Three.js for 3D rendering, TLDraw for 2D canvas, and Zustand for state management.

**Backend**: FastAPI server with Celery for asynchronous AI tasks, Redis for real-time updates, and integration with multiple AI services (Claude, Gemini, Cerebras, Trellis).

---

## Backend API Reference

### Base URLs
- Development: `http://localhost:8000`
- API Base: `/api`

### Authentication
API keys are configured via environment variables on the backend. No authentication required for API calls from the frontend.

---

## Core API Endpoints

### 1. Task Management APIs

#### Queue Task
**POST** `/api/queue/{type}`

Queue an asynchronous AI task for processing.

**Path Parameters:**
- `type` (string): Task type
  - `3d`: Generate 3D model using Claude
  - `edit`: Edit existing Three.js code using Claude  
  - `image`: Generate images using Gemini
  - `llama`: Process with Cerebras LLaMA (reserved)

**Request Body:**
```typescript
interface StreamRequest {
  prompt: string                    // Text prompt for AI
  threejs_code?: string            // Three.js code to edit (for edit type)
  system_prompt?: string           // Custom system prompt
  max_tokens?: number              // Max tokens (default: 4096)
  temperature?: float              // Sampling temperature (default: 0.7)
  additional_params?: object       // Extra parameters
  task_id?: string                 // Custom task ID (auto-generated if omitted)
  number_of_images?: number        // Number of images (1-4, for image type)
  aspect_ratio?: string            // Image aspect ratio (for image type)
  negative_prompt?: string         // Negative prompt (for image type)
  image_base64?: string            // Base64 encoded image for multimodal input
}
```

**Response:**
```typescript
interface TaskResponse {
  task_id: string                  // Task ID for tracking
  status: string                   // "pending"
  message: string                  // "Task submitted successfully"
}
```

**Example:**
```javascript
// Generate 3D model from sketch
const response = await fetch('/api/queue/3d', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "Create a red sports car",
    image_base64: "data:image/png;base64,iVBOR..."
  })
});
const { task_id } = await response.json();
```

#### Get Task Status
**GET** `/api/task/{task_id}`

Get the status and result of a queued task.

**Path Parameters:**
- `task_id` (string): The task ID to check

**Response:**
```typescript
interface TaskStatusResponse {
  task_id: string
  status: "pending" | "completed" | "failed"
  result?: ClaudeResponse | GeminiImageResponse
}

interface ClaudeResponse {
  status: string
  content?: string                 // Generated Three.js code
  model?: string                   // Model used
  error?: string                   // Error message if failed
  error_type?: string             // Error type
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  task_id?: string
}

interface GeminiImageResponse {
  status: string
  model?: string
  images?: Array<{
    image_id: string
    image_base64: string
    saved_path: string
    width: number
    height: number
  }>
  text?: string
  error?: string
  task_id?: string
}
```

#### Subscribe to Task Events (SSE)
**GET** `/api/subscribe/{task_id}`

Stream real-time events from a task using Server-Sent Events.

**Path Parameters:**
- `task_id` (string): The task ID to monitor

**Event Types:**
- `start`: Task has started processing
- `complete`: Task completed successfully
- `error`: Task failed with an error

**Example:**
```javascript
const eventSource = new EventSource(`/api/subscribe/${task_id}`);

eventSource.addEventListener('complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Generated code:', data.content);
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Error:', data.error);
  eventSource.close();
});
```

### 2. Direct Processing APIs

#### Parse Code with Cerebras
**POST** `/api/cerebras/parse`

Directly parse code using Cerebras LLaMA model without SSE streaming.

**Request Body:** Plain text containing the code to parse

**Content-Type:** `text/plain`

**Response:**
```typescript
interface CerebrasResponse {
  status: "success" | "error"
  content: string                  // Parsed code
  model: string                    // Model used
  usage: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}
```

**Example:**
```javascript
const response = await fetch('/api/cerebras/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: threeJsCodeToOptimize
});
const result = await response.json();
```

### 3. Trellis 3D Generation APIs

#### Create Trellis Task
**POST** `/api/trellis/task`

Create a 3D model generation task using the Trellis API.

**Request Body:**
```typescript
interface TrellisRequest {
  model: string                    // "Qubico/trellis"
  task_type: string               // "image-to-3d"
  input: {
    image: string                  // Base64 encoded image
    seed?: number                  // Random seed (default: 0)
    ss_sampling_steps?: number     // Sampling steps (10-50, default: 50)
    slat_sampling_steps?: number   // SLAT sampling steps (10-50, default: 50)
    ss_guidance_strength?: float   // Guidance strength (0-10, default: 7.5)
    slat_guidance_strength?: float // SLAT guidance (0-10, default: 3)
  }
  config?: {
    webhook_config?: {
      endpoint?: string
      secret?: string
    }
  }
}
```

**Response:**
```typescript
interface TrellisResponse {
  id: string                       // Task ID
  status: string                   // Task status
  // Additional fields based on API response
}
```

#### Monitor Trellis Task (WebSocket)
**WebSocket** `/api/trellis/task/ws/{task_id}`

Monitor a Trellis task via WebSocket for real-time updates.

**Path Parameters:**
- `task_id` (string): Trellis task ID

**Message Format:**
```typescript
interface TrellisUpdate {
  status: "processing" | "completed" | "failed" | "error"
  message: string
  data?: string                    // GLTF model URL when completed
  full_response?: object          // Complete API response
}
```

**Example:**
```javascript
const ws = new WebSocket(`ws://localhost:8000/api/trellis/task/ws/${taskId}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.status === 'completed') {
    console.log('3D model ready:', data.data); // GLTF URL
    ws.close();
  }
};
```

---

## Frontend Component Reference

### 1. Main Application Components

#### App Component
**File:** `frontend/app/page.tsx`

Main application component that orchestrates the 2D/3D interface.

**Props:** None

**Features:**
- Tab switching between 2D Canvas and 3D World
- TLDraw integration for 2D sketching
- Three.js canvas for 3D rendering
- Action buttons for AI generation

**Usage:**
```tsx
import App from './page';

export default function HomePage() {
  return <App />;
}
```

#### ThreeJSCanvas
**File:** `frontend/app/components/three/canvas.tsx`

Main 3D rendering canvas component using React Three Fiber.

**Props:**
```typescript
interface ThreeJSCanvasProps {
  visible?: boolean                // Whether canvas is visible (default: true)
}
```

**Features:**
- First-person camera controls
- Object selection and manipulation
- Scene export to GLTF
- Dynamic lighting and environment
- Performance monitoring (optional)

**Usage:**
```tsx
import ThreeJSCanvas from './components/three/canvas';

<ThreeJSCanvas visible={activeTab === 'threejs'} />
```

### 2. 3D Components

#### FirstPersonController
**File:** `frontend/app/components/three/FirstPersonController.tsx`

Provides first-person navigation controls for the 3D scene.

**Features:**
- WASD keyboard movement
- Mouse look controls with pointer lock
- Touch device support with dual joysticks
- Configurable movement speed and sensitivity
- UI focus detection to prevent conflicts

**Configuration:**
```typescript
// Available via Leva controls panel
interface ControllerSettings {
  speed: number                    // Movement speed (5-30, default: 10)
  sensitivity: number              // Mouse sensitivity (0.0005-0.01, default: 0.002)
  showOcean: boolean              // Toggle ocean environment
}
```

#### StoredObjects
**File:** `frontend/app/components/three/StoredObjects.tsx`

Manages and renders user-created 3D objects in the scene.

**Features:**
- Automatic object restoration from store
- Maintains object references to prevent garbage collection
- Supports Mesh, Group, and generic Object3D types
- Dynamic object creation from stored data

**Data Structure:**
```typescript
interface StoredObject {
  id: string
  type: 'mesh' | 'group' | 'object'
  name: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  userData: Record<string, any>
  geometry?: {
    type: string
    parameters: Record<string, any>
  }
  material?: {
    type: string
    color: string
    parameters: Record<string, any>
  }
  children?: StoredObject[]
}
```

#### CustomTransformControls
**File:** `frontend/app/components/three/CustomTransformControls.tsx`

Provides interactive transformation controls for selected objects.

**Features:**
- Translate, rotate, and scale modes
- Visual gizmos for manipulation
- Real-time object updates
- Integration with object store

#### ObjectHighlighter
**File:** `frontend/app/components/three/ObjectHighlighter.tsx`

Handles object selection, highlighting, and deletion in the 3D scene.

**Features:**
- Click-to-select objects
- Visual highlighting of selected objects
- Delete key support for object removal
- Raycasting for precise selection

#### MeshCreator
**File:** `frontend/app/components/three/MeshCreator.tsx`

Handles dynamic creation of 3D objects from code.

**Features:**
- Execute Three.js code safely
- Add generated objects to scene
- Error handling and validation
- Integration with object store

### 3. UI Action Components

#### Vibe3DCodeButton
**File:** `frontend/app/components/Vibe3DCodeButton.tsx`

Main button for generating and editing 3D models from 2D sketches.

**Features:**
- AI toggle (Claude vs Trellis API)
- Edit mode for existing 3D models
- Loading states with progress indication
- Integration with TLDraw selection

**State Management:**
```typescript
interface ButtonState {
  isProcessing: boolean
  is3DModelSelected: boolean
  thinkingEnabled: boolean         // AI mode toggle
}
```

**Usage:**
```tsx
import { Vibe3DCodeButton } from './components/Vibe3DCodeButton';

// In TLDraw shareZone
<Vibe3DCodeButton />
```

#### ImproveDrawingButton
**File:** `frontend/app/components/ImproveDrawingButton.tsx`

Button for enhancing 2D drawings using AI image generation.

**Features:**
- Generates improved versions of sketches
- Creates new image assets in TLDraw
- Real-time progress updates via SSE

#### AutoDrawButton
**File:** `frontend/app/components/AutoDrawButton.tsx`

Automatic drawing generation button.

**Features:**
- AI-powered drawing creation
- Integration with drawing canvas
- Customizable generation parameters

#### TestAddCodeButton
**File:** `frontend/app/components/TestAddCodeButton.tsx`

Development button for testing code addition functionality.

**Props:**
```typescript
interface TestAddCodeButtonProps {
  activeTab: 'tldraw' | 'threejs'
  setActiveTab: (tab: 'tldraw' | 'threejs') => void
}
```

### 4. Custom TLDraw Shapes

#### Model3DPreviewShape
**File:** `frontend/app/PreviewShape/Model3DPreviewShape.tsx`

Custom TLDraw shape for displaying 3D model previews.

**Props:**
```typescript
interface Model3DPreviewShapeProps {
  threeJsCode: string             // Generated Three.js code
  selectedShapes: TLShape[]       // Original selected shapes
  gltfUrl?: string               // GLTF model URL (for Trellis models)
  isGltf?: boolean               // Flag indicating GLTF model
}
```

**Features:**
- Interactive 3D preview within TLDraw
- Code execution and rendering
- Support for both code-based and GLTF models
- Add to 3D world functionality

---

## State Management Reference

### 1. App Store (UI State)
**File:** `frontend/app/store/appStore.ts`

Manages UI interaction state (not persisted).

```typescript
interface AppUIState {
  // State
  isUIFocused: boolean             // Whether UI elements have focus
  isCodeEditorOpen: boolean        // Code editor visibility
  selectedObject: THREE.Object3D | null  // Currently selected 3D object
  transformMode: TransformMode     // 'translate' | 'rotate' | 'scale'
  isDeleting: boolean             // Object deletion in progress

  // Actions
  setUIFocused: (focused: boolean) => void
  setCodeEditorOpen: (open: boolean) => void
  setSelectedObject: (object: THREE.Object3D | null) => void
  setTransformMode: (mode: TransformMode) => void
  setIsDeleting: (isDeleting: boolean) => void
}
```

**Usage:**
```typescript
import { useAppStore } from '@/store/appStore';

function MyComponent() {
  const { selectedObject, setSelectedObject } = useAppStore();
  
  const handleSelect = (object: THREE.Object3D) => {
    setSelectedObject(object);
  };
}
```

### 2. Tab Store
**File:** `frontend/app/store/appStore.ts`

Manages tab navigation state.

```typescript
interface TabStoreState {
  activeTab: 'tldraw' | 'threejs'
  setActiveTab: (tab: 'tldraw' | 'threejs') => void
}
```

**Usage:**
```typescript
import { useTabStore } from '@/store/appStore';

function TabSwitcher() {
  const { activeTab, setActiveTab } = useTabStore();
  
  return (
    <button onClick={() => setActiveTab('threejs')}>
      3D World
    </button>
  );
}
```

### 3. Object Store
**File:** `frontend/app/store/appStore.ts`

Manages 3D objects and their lifecycle.

```typescript
interface ObjectStoreState {
  // State
  objects: StoredObject[]          // Stored object data
  meshCount: number               // Object counter

  // Actions
  incrementMeshCount: () => void
  addObject: (object: THREE.Object3D) => void
  updateObject: (id: string, updates: Partial<StoredObject>) => void
  removeObject: (id: string) => void
  clearObjects: () => void
  addObjectFromCode: (code: string) => THREE.Object3D | null
  addObjectWithGltf: (url: string) => Promise<THREE.Object3D | null>
}
```

**Usage:**
```typescript
import { useObjectStore } from '@/store/appStore';

function ObjectManager() {
  const { objects, addObject, removeObject } = useObjectStore();
  
  const createCube = () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.userData.isUserCreated = true;
    addObject(cube);
  };
}
```

---

## Utility Functions Reference

### 1. 3D Generation
**File:** `frontend/app/lib/vibe3DCode.tsx`

#### vibe3DCode()
Converts 2D sketches to 3D models using AI.

```typescript
async function vibe3DCode(
  editor: Editor,                  // TLDraw editor instance
  shapeId?: TLShapeId | null,     // Optional target shape ID
  thinkingMode?: boolean          // Use Trellis API (true) or Claude (false)
): Promise<void>
```

**Features:**
- Extracts SVG from selected TLDraw shapes
- Converts to base64 image for AI processing
- Supports both Claude (code generation) and Trellis (GLTF generation) modes
- Real-time progress updates via SSE/WebSocket
- Automatic preview shape creation

**Example:**
```typescript
import { vibe3DCode } from '@/lib/vibe3DCode';

// Generate 3D model from selected shapes
await vibe3DCode(editor, null, true); // Use Trellis API
```

### 2. Drawing Enhancement
**File:** `frontend/app/lib/improveDrawing.tsx`

#### improveDrawing()
Enhances 2D drawings using AI image generation.

```typescript
async function improveDrawing(editor: Editor): Promise<TLShapeId>
```

**Features:**
- Processes selected TLDraw shapes
- Generates enhanced images via Gemini API
- Creates new image assets in TLDraw
- Automatic positioning relative to selection

**Example:**
```typescript
import { improveDrawing } from '@/lib/improveDrawing';

// Enhance selected drawing
const newImageId = await improveDrawing(editor);
```

### 3. Code Editing
**File:** `frontend/app/lib/edit3DCode.tsx`

#### edit3DCode()
Edits existing Three.js code using AI.

```typescript
async function edit3DCode(
  editor: Editor,                  // TLDraw editor instance
  setLoadingState?: (loading: boolean) => void  // Optional loading callback
): Promise<void>
```

**Features:**
- Extracts code from selected 3D model shapes
- Processes edit requests via Claude API
- Updates existing preview shapes with new code
- Supports both text and image-based editing

### 4. Utility Helpers

#### blobToBase64()
**File:** `frontend/app/lib/blobToBase64.ts`

Converts Blob objects to base64 strings.

```typescript
function blobToBase64(blob: Blob): Promise<string>
```

#### getSelectionAsText()
**File:** `frontend/app/lib/getSelectionAsText.ts`

Extracts text content from TLDraw shape selections.

```typescript
function getSelectionAsText(editor: Editor): string
```

#### downloadDataUrlAsFile()
**File:** `frontend/app/lib/downloadDataUrlAsFile.ts`

Downloads data URLs as files.

```typescript
function downloadDataUrlAsFile(dataUrl: string, filename: string): void
```

#### addGridToSvg()
**File:** `frontend/app/lib/addGridToSvg.ts`

Adds grid overlays to SVG elements.

```typescript
function addGridToSvg(svg: SVGElement, gridSize?: number): SVGElement
```

---

## Backend Task System Reference

### 1. Claude Tasks
**File:** `backend/app/tasks/claude_tasks.py`

#### ClaudePromptTask
Generates 3D models from images using Claude 3.7.

**Parameters:**
```python
def run(
    task_id: str,
    image_base64: str,
    prompt: str = "",
    system_prompt: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    additional_params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]
```

#### ClaudeEditTask
Edits existing Three.js code using Claude 3.7.

**Parameters:**
```python
def run(
    task_id: str,
    threejs_code: str,
    image_base64: str = "",
    prompt: str = "",
    system_prompt: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    additional_params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]
```

### 2. Gemini Tasks  
**File:** `backend/app/tasks/gemini_tasks.py`

#### GeminiPromptTask
Processes prompts with Gemini 2.0 Flash.

#### GeminiImageGenerationTask
Generates images from sketches using Gemini.

**Features:**
- Converts rough sketches to polished images
- Supports multiple output formats
- Configurable generation parameters
- Debug image saving

### 3. Cerebras Tasks
**File:** `backend/app/tasks/cerebras_tasks.py`

#### CerebrasTask
Processes code optimization using LLaMA models.

**Features:**
- Code parsing and optimization
- Three.js code extraction
- Fast, direct processing without streaming

---

## Configuration Reference

### Backend Environment Variables

```bash
# AI Service API Keys
ANTHROPIC_API_KEY=your_claude_api_key
GOOGLE_API_KEY=your_gemini_api_key
CEREBRAS_API_KEY=your_cerebras_api_key
TRELLIS_API_KEY=your_trellis_api_key

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379
CELERY_RESULT_BACKEND=redis://localhost:6379

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
```

### Frontend Environment Variables

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Development settings
NODE_ENV=development
```

---

## Usage Examples

### Example 1: Basic 3D Model Generation

```typescript
import { useEditor } from '@tldraw/tldraw';
import { vibe3DCode } from '@/lib/vibe3DCode';

function Generate3DButton() {
  const editor = useEditor();
  
  const generate = async () => {
    try {
      // User must have shapes selected in TLDraw
      await vibe3DCode(editor, null, false); // Use Claude
      console.log('3D model generated successfully');
    } catch (error) {
      console.error('Generation failed:', error.message);
    }
  };
  
  return <button onClick={generate}>Generate 3D</button>;
}
```

### Example 2: Direct API Usage

```typescript
// Generate 3D model via direct API call
async function generateModel(imageBase64: string, prompt: string) {
  // 1. Queue the task
  const response = await fetch('/api/queue/3d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: imageBase64,
      prompt: prompt
    })
  });
  
  const { task_id } = await response.json();
  
  // 2. Monitor progress via SSE
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`/api/subscribe/${task_id}`);
    
    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      resolve(data.content); // Three.js code
      eventSource.close();
    });
    
    eventSource.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      reject(new Error(data.error));
      eventSource.close();
    });
  });
}
```

### Example 3: Custom 3D Object Creation

```typescript
import { useObjectStore } from '@/store/appStore';
import * as THREE from 'three';

function CustomObjectCreator() {
  const { addObject } = useObjectStore();
  
  const createCustomObject = () => {
    // Create a complex 3D object
    const group = new THREE.Group();
    
    // Add a cube
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 0, 0);
    
    // Add a sphere
    const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(2, 0, 0);
    
    group.add(cube);
    group.add(sphere);
    
    // Set metadata
    group.userData = {
      isUserCreated: true,
      name: 'Custom Object Group'
    };
    
    // Add to object store (will appear in 3D scene)
    addObject(group);
  };
  
  return <button onClick={createCustomObject}>Create Custom Object</button>;
}
```

### Example 4: GLTF Model Loading

```typescript
import { useObjectStore } from '@/store/appStore';

function GLTFLoader() {
  const { addObjectWithGltf } = useObjectStore();
  
  const loadModel = async () => {
    try {
      const gltfUrl = 'https://example.com/model.glb';
      const object = await addObjectWithGltf(gltfUrl);
      
      if (object) {
        console.log('GLTF model loaded successfully:', object);
      } else {
        console.error('Failed to load GLTF model');
      }
    } catch (error) {
      console.error('Error loading GLTF:', error);
    }
  };
  
  return <button onClick={loadModel}>Load GLTF Model</button>;
}
```

### Example 5: Scene Export

```typescript
function SceneExporter() {
  const exportScene = () => {
    // Access the global scene reference
    const scene = (window as any).__threeScene;
    if (!scene) return;
    
    // Create export scene with only user objects
    const exportScene = new THREE.Scene();
    
    scene.traverse((object: THREE.Object3D) => {
      if (object.userData?.isUserCreated === true) {
        const clonedObject = object.clone();
        exportScene.add(clonedObject);
      }
    });
    
    // Export as GLTF
    const exporter = new GLTFExporter();
    exporter.parse(
      exportScene,
      (gltf: any) => {
        const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'scene.gltf';
        link.click();
      },
      (error: any) => console.error('Export failed:', error),
      { binary: false }
    );
  };
  
  return <button onClick={exportScene}>Export Scene</button>;
}
```

---

## Error Handling

### Common Error Patterns

```typescript
// API Error Handling
try {
  const response = await fetch('/api/queue/3d', { /* ... */ });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`API Error: ${errorData.detail || response.statusText}`);
  }
  
  const result = await response.json();
} catch (error) {
  if (error instanceof TypeError) {
    // Network or fetch error
    console.error('Network error:', error.message);
  } else {
    // API or application error
    console.error('Application error:', error.message);
  }
}

// SSE Error Handling
const eventSource = new EventSource('/api/subscribe/task_123');

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  eventSource.close();
};

eventSource.addEventListener('error', (event) => {
  try {
    const data = JSON.parse(event.data);
    console.error('Task error:', data.error);
  } catch (e) {
    console.error('Unknown SSE error');
  }
  eventSource.close();
});
```

### Error Recovery Strategies

```typescript
// Automatic retry for failed requests
async function apiRequestWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts`);
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
}
```

---

## Performance Considerations

### Memory Management

- Object references are stored globally to prevent garbage collection
- Use `clearObjects()` to clean up when needed  
- GLTF models include material optimization for better rendering

### Optimization Tips

```typescript
// Efficient object updates
const { updateObject } = useObjectStore();

// Batch updates when possible
const updates = {
  position: [x, y, z] as [number, number, number],
  rotation: [rx, ry, rz] as [number, number, number]
};
updateObject(objectId, updates);

// Avoid frequent object recreation
// Use transform controls for real-time manipulation
```

### WebGL Context Management

```typescript
// Canvas configuration for optimal performance
<Canvas
  gl={{
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
    antialias: true,
    failIfMajorPerformanceCaveat: false,
  }}
>
```

---

## Development Guidelines

### Adding New AI Tasks

1. Create task class in `backend/app/tasks/`
2. Extend `AsyncAITask` and `GenericPromptTask`
3. Register with Celery app
4. Add route in `routes.py`
5. Update frontend integration

### Custom 3D Components

1. Create component in `frontend/app/components/three/`
2. Use React Three Fiber hooks (`useThree`, `useFrame`)
3. Integrate with object store if needed
4. Add proper cleanup in `useEffect`

### TLDraw Shape Extensions

1. Create shape util in `frontend/app/PreviewShape/`
2. Define shape props and rendering
3. Add to `shapeUtils` array in main app
4. Implement custom behaviors and interactions

---

This documentation provides comprehensive coverage of all public APIs, functions, and components in the Vibe Draw application. Each section includes practical examples and usage patterns to help developers integrate with and extend the system effectively.