import { Editor, createShapeId, getSvgAsImage } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { getModelFromAnthropic } from './getModelFromAnthropic'
import { blobToBase64 } from './blobToBase64'
import { addGridToSvg } from './addGridToSvg'
import { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'

export async function vibe3DCode(editor: Editor, apiKey: string) {
  // Get the selected shapes (we need at least one)
  let selectedShapes = editor.getSelectedShapes()

  if (selectedShapes.length === 0) throw Error('First select something to make real.')

  // Create the preview shape for the 3D model
  const { maxX, midY } = editor.getSelectionPageBounds()!
  const newShapeId = createShapeId()
  editor.createShape<Model3DPreviewShape>({
    id: newShapeId,
    type: 'model3d',
    x: maxX + 60, // to the right of the selection
    y: midY - (540 * 2) / 3 / 2, // half the height of the preview's initial shape
    props: { threeJsCode: '' },
  })

  // Get an SVG based on the selected shapes
  const svg = await editor.getSvg(selectedShapes, {
    scale: 1,
    background: true,
  })

  if (!svg) {
    return
  }

  // Add the grid lines to the SVG
  const grid = { color: 'red', size: 100, labels: true }
  addGridToSvg(svg, grid)

  if (!svg) throw Error(`Could not get the SVG.`)

  // Turn the SVG into a DataUrl
  const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const blob = await getSvgAsImage(svg, IS_SAFARI, {
    type: 'png',
    quality: 0.8,
    scale: 1,
  })
  const dataUrl = await blobToBase64(blob!)

  // Get any previous previews among the selected shapes
  const previousPreviews = selectedShapes.filter((shape) => {
    return shape.type === 'model3d'
  }) as any[]

  // Send everything to Anthropic and get the Three.js code back
  try {
    const json = await getModelFromAnthropic({
      image: dataUrl,
      apiKey,
      text: getSelectionAsText(editor),
      previousPreviews,
      grid,
      theme: editor.user.getUserPreferences().isDarkMode ? 'dark' : 'light',
    })

    if (!json) {
      throw Error('Could not contact Anthropic.')
    }

    if (json?.error) {
      throw Error(`${json.error.message?.slice(0, 128)}...`)
    }

    // Extract the Three.js code from the response
    const message = json.content[0].text
    
    // Extract code from markdown code blocks
    let threeJsCode = ''
    
    // First, try to find JavaScript code block
    const jsPattern = /```javascript\s*\n([\s\S]*?)```/
    const jsMatch = message.match(jsPattern)
    
    if (jsMatch && jsMatch[1]) {
      threeJsCode = jsMatch[1]
    } else {
      // Try to find any code block with or without language specification
      const codePattern = /```(?:\w*\s*)?\n([\s\S]*?)```/
      const codeMatch = message.match(codePattern)
      if (codeMatch && codeMatch[1]) {
        threeJsCode = codeMatch[1]
      } else {
        // If no markdown code blocks found, try to find script tags
        const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/
        const scriptMatch = message.match(scriptPattern)
        if (scriptMatch && scriptMatch[1]) {
          threeJsCode = scriptMatch[1]
        } else {
          // If no script tags, use the entire message but warn
          console.warn("No code block or script tag found in the response. Using full response.")
          threeJsCode = message
        }
      }
    }
    
    // Process the code to adapt to the non-ES modules environment
    threeJsCode = processThreeJsCode(threeJsCode);
    
    // Make sure we have code
    if (threeJsCode.length < 100) {
      console.warn(message)
      throw Error('Could not generate a 3D model from those wireframes.')
    }

    // Update the shape with the new props
    editor.updateShape<Model3DPreviewShape>({
      id: newShapeId,
      type: 'model3d',
      props: {
        threeJsCode,
      },
    })

    console.log(`Response received from Anthropic`)
  } catch (e) {
    // If anything went wrong, delete the shape
    editor.deleteShape(newShapeId)
    throw e
  }
}

// Process ThreeJS code to work with our environment
function processThreeJsCode(code: string): string {
  let processedCode = code;
  
  // Remove all import statements
  // Match both ES6 imports and CommonJS requires
  processedCode = processedCode.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, ''); // Named imports
  processedCode = processedCode.replace(/^import\s+\*\s+as\s+.*?\s+from\s+['"].*?['"];?\s*$/gm, ''); // Namespace imports
  processedCode = processedCode.replace(/^import\s+['"].*?['"];?\s*$/gm, ''); // Side effect imports
  processedCode = processedCode.replace(/^const\s+.*?\s*=\s*require\(['"].*?['"]\);?\s*$/gm, ''); // CommonJS requires
  
  // More specific Three.js import patterns
  processedCode = processedCode.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+{\s*OrbitControls\s*}\s+from\s+['"]three\/addons\/controls\/OrbitControls\.js['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+{\s*[^}]*\s*}\s+from\s+['"]three['"];?\s*/g, ''); // Destructured imports from three
  processedCode = processedCode.replace(/import\s+THREE\s+from\s+['"]three['"];?\s*/g, ''); // CommonJS requires
  
  // Replace THREE.OrbitControls with OrbitControls
  processedCode = processedCode.replace(/THREE\.OrbitControls/g, 'OrbitControls');
  
  return processedCode;
}