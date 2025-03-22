/* eslint-disable react-hooks/rules-of-hooks */
import { vibe3DCode } from '@/lib/vibe3DCode'
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

export type Model3DPreviewShape = TLBaseShape<
  'model3d',
  {
    threeJsCode: string
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

    // Prepare the HTML with the Three.js code embedded
    const htmlToUse = shape.props.threeJsCode
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
        /* Control panel for interaction */
        .controls-panel {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            border: none;
            padding: 8px;
            border-radius: 4px;
            font-family: sans-serif;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .controls-panel button {
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-family: sans-serif;
            transition: background 0.2s;
        }
        .controls-panel button:hover {
            background: rgba(255,255,255,0.3);
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
    <script src="https://unpkg.com/html2canvas"></script>
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
      // Setup message passing for screenshot
      window.addEventListener('message', function(event) {
          if (event.data.action === 'take-screenshot' && event.data.shapeid === "${shape.id}") {
              html2canvas(document.body, {useCors: true}).then(function(canvas) {
                  const data = canvas.toDataURL('image/png');
                  window.parent.postMessage({screenshot: data, shapeid: "${shape.id}"}, "*");
              });
          }
      }, false);

      // Make the capture button work
      document.getElementById('capture-button').addEventListener('click', function() {
          html2canvas(document.body, {useCors: true}).then(function(canvas) {
              const data = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.download = '3d_model.png';
              link.href = data;
              link.click();
          });
      });

      // Add control handlers
      document.getElementById('toggle-animation-button').addEventListener('click', function() {
          window.__animationEnabled = !window.__animationEnabled;
      });
      
      // Reset view button
      document.getElementById('reset-view-button').addEventListener('click', function() {
          if (window.__modelControls) {
              window.__modelControls.reset();
          }
      });

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
            onClick={async () => {
              for (const selectedShape of shape.props.selectedShapes) {
                this.editor.select(selectedShape);
              }
              this.editor.deleteShape(shape);
              await vibe3DCode(this.editor);
            }}
            onPointerDown={(e) => e.stopPropagation()}
           />
           <Icon 
            icon="plus"
            onClick={async () => {
              for (const selectedShape of shape.props.selectedShapes) {
                this.editor.select(selectedShape);
              }
              this.editor.deleteShape(shape);
              await vibe3DCode(this.editor);
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
