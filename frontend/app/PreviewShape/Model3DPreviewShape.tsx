/* eslint-disable react-hooks/rules-of-hooks */
import { vibe3DCode } from '@/lib/vibe3DCode'
import { useObjectStore, useTabStore } from '@/store/appStore'
import {
  BaseBoxShapeUtil,
  DefaultSpinner,
  HTMLContainer,
  Icon,
  SvgExportContext,
  TLBaseShape,
  TLShape,
  toDomPrecision,
  useIsEditing,
  useToasts,
} from '@tldraw/tldraw'
import { useState, useEffect } from 'react'

export type Model3DPreviewShape = TLBaseShape<
  'model3d',
  {
    threeJsCode: string
    objectCode: string
    gltfUrl: string
    isGltf: boolean
    w: number
    h: number
    selectedShapes: TLShape[]
  }
>

export class Model3DPreviewShapeUtil extends BaseBoxShapeUtil<Model3DPreviewShape> {
  static override type = 'model3d' as const

  getDefaultProps(): Model3DPreviewShape['props'] {
    return {
      threeJsCode: '',
      objectCode: '',
      gltfUrl: '',
      isGltf: false,
      w: (960 * 2) / 3,
      h: (540 * 2) / 3,
      selectedShapes: [],
    }
  }

  override canEdit = () => true
  override isAspectRatioLocked = () => false
  override canResize = () => true
  override canBind = () => false
  override canUnmount = () => false

  override component(shape: Model3DPreviewShape) {
    const isEditing = useIsEditing(shape.id)
    const toast = useToasts()
    const { addObjectFromCode, addObjectWithGltf } = useObjectStore()
    const { activeTab, setActiveTab } = useTabStore()
    const [isRegenerating, setIsRegenerating] = useState(false)
    const [isEditingModel, setIsEditingModel] = useState(false)

    // Listen for custom editing state change events
    useEffect(() => {
      const handleEditingStateChange = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail && customEvent.detail.elementId === shape.id) {
          setIsEditingModel(customEvent.detail.isEditing);
        }
      };

      window.addEventListener('model3d-editing-state-change', handleEditingStateChange);

      return () => {
        window.removeEventListener('model3d-editing-state-change', handleEditingStateChange);
      };
    }, [shape.id]);

    // Listen for add-gltf-object events
    useEffect(() => {
      const handleAddGltfObject = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail && customEvent.detail.url) {
          // Check if this event is for this specific shape
          if (customEvent.detail.shapeId && customEvent.detail.shapeId !== shape.id) {
            return; // Skip if this event is for a different shape
          }
          
          if (activeTab !== 'threejs') {
            setActiveTab('threejs');
            // Wait for tab switch to complete before adding object
            setTimeout(() => {
              addObjectWithGltf(customEvent.detail.url);
            }, 100);
          } else {
            // Already on threejs tab, add object directly
            addObjectWithGltf(customEvent.detail.url);
          }
        }
      };

      window.addEventListener('add-gltf-object', handleAddGltfObject);

      return () => {
        window.removeEventListener('add-gltf-object', handleAddGltfObject);
      };
    }, [activeTab, setActiveTab, addObjectWithGltf, shape.id]);

    // Prepare the HTML with the Three.js code embedded
    const htmlToUse = shape.props.isGltf && shape.props.gltfUrl 
      ? `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>3D Model Preview</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
            width: 100%; 
            height: 100%;
            background-color: transparent;
        }
        canvas { 
            display: block; 
            width: 100% !important; 
            height: 100% !important;
        }
        /* Help tooltip */
        .help-tooltip {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: sans-serif;
            font-size: 12px;
            opacity: 0.7;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="help-tooltip">
        <p>Left-click + drag: Rotate</p>
        <p>Right-click + drag: Pan</p>
        <p>Scroll: Zoom</p>
    </div>
    <script type="module">
    import * as THREE from "https://esm.sh/three";
    import { OrbitControls } from "https://esm.sh/three/examples/jsm/controls/OrbitControls.js";
    import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";
    
    // Set up scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Set up camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);
    
    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Enhanced lighting setup
    // Ambient light for global illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Main directional light (sun-like)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(10, 10, 10);
    // mainLight.castShadow = true;
    // Improve shadow quality
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);
    
    // Secondary fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0xffffee, 0.8);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);
    
    // Rim light to highlight edges
    const rimLight = new THREE.DirectionalLight(0xeeeeff, 0.6);
    rimLight.position.set(0, -10, -15);
    scene.add(rimLight);
    
    // Soft light from below for better dimension
    const bottomLight = new THREE.DirectionalLight(0xeeeeff, 0.4);
    bottomLight.position.set(0, -10, 0);
    scene.add(bottomLight);
    
    // Add hemisphere light for more natural outdoor-like lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    
    // Environment lighting for reflections (if model has reflective materials)
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    // Add a circular ground plate
    const groundRadius = 10;
    const groundGeometry = new THREE.CircleGeometry(groundRadius, 72);
    // Rotate the ground plate to be horizontal (it's vertical by default)
    groundGeometry.rotateX(-Math.PI / 2);
    
    // Create a nice material for the ground
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    
    const groundPlate = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlate.receiveShadow = true;
    groundPlate.position.y = -2; // Slightly below origin to avoid z-fighting
    scene.add(groundPlate);
    
    // Load GLTF model
    const loader = new GLTFLoader();
    loader.load('${shape.props.gltfUrl}', (gltf) => {
      const model = gltf.scene;
      
      // Center model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Reset model position to center
      model.position.x = -center.x;
      model.position.y = -center.y;
      model.position.z = -center.z;
      
      // Scale model to fit view
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 3 / maxDim;
        model.scale.set(scale, scale, scale);
      }
      
      // Add spotlight directly aimed at the model for better visibility
      const spotLight = new THREE.SpotLight(0xffffff, 1.5);
      spotLight.position.set(0, 10, 0);
      spotLight.angle = Math.PI / 4;
      spotLight.penumbra = 0.1;
      spotLight.decay = 0;
      spotLight.distance = 50;
      spotLight.castShadow = true;
      spotLight.shadow.bias = -0.0001;
      spotLight.shadow.mapSize.width = 1024;
      spotLight.shadow.mapSize.height = 1024;
      scene.add(spotLight);
      
      // Target the spotlight at the model's center
      spotLight.target = model;
      scene.add(spotLight.target);
      
      // Enhance model materials for better visibility
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          if (node.material) {
            // For each material in the model, increase brightness
            const modifyMaterial = (material) => {
              // Increase the overall brightness
              if (material.color) {
                // Store original color for reference
                if (!material.userData) material.userData = {};
                material.userData.originalColor = material.color.clone();
                
                // Brighten the color (multiply RGB values to make it brighter)
                const brightenFactor = 10;  // Adjust as needed
                material.color.r = Math.min(material.color.r * brightenFactor, 1);
                material.color.g = Math.min(material.color.g * brightenFactor, 1);
                material.color.b = Math.min(material.color.b * brightenFactor, 1);
              }
              
              // Add slight emissive glow to make model stand out
              if (material.emissive) {
                material.emissiveIntensity = 0.4;
                material.emissive = new THREE.Color(0x333333);
              }
              
              // Increase material contrast
              if (material.roughness !== undefined) {
                material.roughness = Math.max(material.roughness * 0.8, 0.1);
              }
              
              // Enhance specularity for more visual pop
              if (material.metalness !== undefined) {
                material.metalness = Math.min(material.metalness + 0.1, 1.0);
              }
            };
            
            // Apply to individual material or material array
            if (Array.isArray(node.material)) {
              node.material.forEach(modifyMaterial);
            } else {
              modifyMaterial(node.material);
            }
          }
        }
      });
      
      scene.add(model);
      
      // Add a subtle outline effect to make the model stand out
      const edgeGlow = new THREE.Group();
      const edgeLight1 = new THREE.PointLight(0xffffcc, 0.6, 10);
      edgeLight1.position.set(2, 2, 2);
      const edgeLight2 = new THREE.PointLight(0xccffff, 0.6, 10);
      edgeLight2.position.set(-2, 1, -2);
      edgeGlow.add(edgeLight1, edgeLight2);
      scene.add(edgeGlow);
    }, 
    // Progress callback
    (xhr) => {
      console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    // Error callback
    (error) => {
      console.error('Error loading GLTF model:', error);
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    
    animate();
    
    // Prevent zooming issues
    document.body.addEventListener('wheel', e => { 
        if (!e.ctrlKey) return; 
        e.preventDefault(); 
        return 
    }, { passive: false });
    </script>
</body>
</html>`
      : shape.props.threeJsCode
        ? `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>3D Model Preview</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
            width: 100%; 
            height: 100%;
            background-color: transparent;
        }
        canvas { 
            display: block; 
            width: 100% !important; 
            height: 100% !important;
        }
        /* Help tooltip */
        .help-tooltip {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: sans-serif;
            font-size: 12px;
            opacity: 0.7;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="help-tooltip">
        <p>Left-click + drag: Rotate</p>
        <p>Right-click + drag: Pan</p>
        <p>Scroll: Zoom</p>
    </div>
    <script type="module">
    import * as THREE from "https://esm.sh/three";
    import { OrbitControls } from "https://esm.sh/three/examples/jsm/controls/OrbitControls.js";
    ${shape.props.threeJsCode}
      // Prevent zooming issues
      document.body.addEventListener('wheel', e => { 
          if (!e.ctrlKey) return; 
          e.preventDefault(); 
          return 
      }, { passive: false });
    </script>
</body>
</html>`
      : ''

    return (
      <HTMLContainer className="tl-embed-container" id={shape.id}>
        {htmlToUse ? (
          <>
            <iframe
              id={`iframe-1-${shape.id}`}
              srcDoc={htmlToUse}
              width={toDomPrecision(shape.props.w)}
              height={toDomPrecision(shape.props.h)}
              draggable={false}
              style={{
                pointerEvents: isEditing ? 'auto' : 'none',
                border: '1px solid var(--color-panel-contrast)',
                borderRadius: 'var(--radius-2)',
                backgroundColor: 'rgba(0,0,0,0.1)',
              }}
            />
            {(isRegenerating || isEditingModel) && (
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  borderRadius: 'var(--radius-2)',
                  zIndex: 100,
                }}
              >
                <DefaultSpinner />
                <div style={{ marginTop: 10, fontSize: 14 }}>
                  {isRegenerating ? 'Regenerating 3D model...' : 'Editing 3D model...'}
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'var(--color-muted-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-muted-1)',
            }}
          >
            <DefaultSpinner />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            top: 15,
            right: -40,
            height: 40,
            width: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'left',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'all',
            paddingLeft: 5,
            paddingTop: 5,
            gap: 5
          }}
        >
          <Icon
            icon="duplicate"
            onTouchStart={() => {
              if (navigator && navigator.clipboard) {
                navigator.clipboard.writeText(shape.props.threeJsCode)
                toast.addToast({
                  icon: 'duplicate',
                  title: 'Model code copied to clipboard',
                })
              }
            }}
            onClick={() => {
              if (navigator && navigator.clipboard) {
                navigator.clipboard.writeText(shape.props.threeJsCode)
                toast.addToast({
                  icon: 'duplicate',
                  title: 'Model code copied to clipboard',
                })
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <Icon 
            icon="redo"
            onTouchStart={async () => {
              setIsRegenerating(true);
              this.editor.setSelectedShapes(shape.props.selectedShapes);
              await vibe3DCode(this.editor, shape.id);
              setIsRegenerating(false);
              // Exit editing mode after regenerating the 3D preview
              this.editor.selectNone();
            }}
            onClick={async () => {
              setIsRegenerating(true);
              this.editor.setSelectedShapes(shape.props.selectedShapes);
              await vibe3DCode(this.editor, shape.id);
              setIsRegenerating(false);
              // Exit editing mode after regenerating the 3D preview
              this.editor.selectNone();
            }}
            onPointerDown={(e) => e.stopPropagation()}
           />
           <Icon 
            icon="plus"
            onTouchStart={async () => {
              if (shape.props.isGltf && shape.props.gltfUrl) {
                // Handle GLTF model
                if (activeTab !== 'threejs') {
                  setActiveTab('threejs');
                  // Wait for tab switch to complete before adding object
                  setTimeout(() => {
                    const result = addObjectWithGltf(shape.props.gltfUrl);
                    if (!result) {
                      toast.addToast({
                        icon: 'warning-triangle',
                        title: 'Failed to add 3D model.',
                      });
                    }
                  }, 100); // Short delay to ensure tab context is ready
                } else {
                  // Already on threejs tab, add object directly
                  const result = addObjectWithGltf(shape.props.gltfUrl);
                  if (!result) {
                    toast.addToast({
                      icon: 'warning-triangle',
                      title: 'Failed to add 3D model.',
                    });
                  }
                }
              } else if (shape.props.threeJsCode) {
                // Handle ThreeJS code
                const res = await fetch("http://localhost:8000/api/cerebras/parse", {
                  method: "POST",
                  body: shape.props.threeJsCode
                });
                const actualCode = await res.json();
                console.log(actualCode);
                const objectCode = actualCode.content;
                
                if (activeTab !== 'threejs') {
                  setActiveTab('threejs');
                  // Wait for tab switch to complete before adding object
                  setTimeout(() => {
                    const result = addObjectFromCode(objectCode);
                    if (!result) {
                      toast.addToast({
                        icon: 'warning-triangle',
                        title: 'Failed to add object.',
                      });
                    }
                  }, 100); // Short delay to ensure tab context is ready
                } else {
                  // Already on threejs tab, add object directly
                  const result = addObjectFromCode(objectCode);
                  if (!result) {
                    toast.addToast({
                      icon: 'warning-triangle',
                      title: 'Failed to add object.',
                    });
                  }
                }
              }
            }}
            onClick={async () => {
              if (shape.props.isGltf && shape.props.gltfUrl) {
                // Handle GLTF model
                if (activeTab !== 'threejs') {
                  setActiveTab('threejs');
                  // Wait for tab switch to complete before adding object
                  setTimeout(() => {
                    const result = addObjectWithGltf(shape.props.gltfUrl);
                    if (!result) {
                      toast.addToast({
                        icon: 'warning-triangle',
                        title: 'Failed to add 3D model.',
                      });
                    }
                  }, 100); // Short delay to ensure tab context is ready
                } else {
                  // Already on threejs tab, add object directly
                  const result = addObjectWithGltf(shape.props.gltfUrl);
                  if (!result) {
                    toast.addToast({
                      icon: 'warning-triangle',
                      title: 'Failed to add 3D model.',
                    });
                  }
                }
              } else if (shape.props.threeJsCode) {
                // Handle ThreeJS code
                const res = await fetch("http://localhost:8000/api/cerebras/parse", {
                  method: "POST",
                  body: shape.props.threeJsCode
                });
                const actualCode = await res.json();
                console.log(actualCode);
                const objectCode = actualCode.content;
                
                if (activeTab !== 'threejs') {
                  setActiveTab('threejs');
                  // Wait for tab switch to complete before adding object
                  setTimeout(() => {
                    const result = addObjectFromCode(objectCode);
                    if (!result) {
                      toast.addToast({
                        icon: 'warning-triangle',
                        title: 'Failed to add object.',
                      });
                    }
                  }, 100); // Short delay to ensure tab context is ready
                } else {
                  // Already on threejs tab, add object directly
                  const result = addObjectFromCode(objectCode);
                  if (!result) {
                    toast.addToast({
                      icon: 'warning-triangle',
                      title: 'Failed to add object.',
                    });
                  }
                }
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
           />
        </div>
        {htmlToUse && (
          <div
            style={{
              textAlign: 'center',
              position: 'absolute',
              bottom: isEditing ? -40 : 0,
              padding: 4,
              fontFamily: 'inherit',
              fontSize: 12,
              left: 0,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                background: 'var(--color-panel)',
                padding: '4px 12px',
                borderRadius: 99,
                border: '1px solid var(--color-muted-1)',
              }}
            >
              {isEditing ? 'Click the canvas to exit' : 'Double click to interact with 3D model'}
            </span>
          </div>
        )}
      </HTMLContainer>
    )
  }

  override toSvg(
    shape: Model3DPreviewShape,
    _ctx: SvgExportContext
  ): SVGElement | Promise<SVGElement> {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    
    return new Promise((resolve, _) => {
      if (window === undefined) return resolve(g)
      
      const windowListener = (event: MessageEvent) => {
        if (event.data.screenshot && event.data?.shapeid === shape.id) {
          const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
          image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', event.data.screenshot)
          image.setAttribute('width', shape.props.w.toString())
          image.setAttribute('height', shape.props.h.toString())
          g.appendChild(image)
          window.removeEventListener('message', windowListener)
          clearTimeout(timeOut)
          resolve(g)
        }
      }
      
      const timeOut = setTimeout(() => {
        resolve(g)
        window.removeEventListener('message', windowListener)
      }, 2000)
      
      window.addEventListener('message', windowListener)
      
      // Request a screenshot from the iframe
      const firstLevelIframe = document.getElementById(`iframe-1-${shape.id}`) as HTMLIFrameElement
      if (firstLevelIframe) {
        firstLevelIframe.contentWindow!.postMessage(
          { action: 'take-screenshot', shapeid: shape.id },
          '*'
        )
      } else {
        console.log('first level iframe not found or not accessible')
      }
    })
  }

  indicator(shape: Model3DPreviewShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
