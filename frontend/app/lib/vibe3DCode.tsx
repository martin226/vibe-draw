<<<<<<< Updated upstream
import { Editor, createShapeId, getSvgAsImage } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { getModelFromAnthropic } from './getModelFromAnthropic'
import { blobToBase64 } from './blobToBase64'
// import { addGridToSvg } from './addGridToSvg'
import { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'

export async function vibe3DCode(editor: Editor) {
  const input = document.getElementById('anthropic_key') as HTMLInputElement
  const apiKey = input?.value ?? null
  if (!apiKey) throw Error('Make sure the input includes your API Key!')

  // Get the selected shapes (we need at least one)
  const selectedShapes = editor.getSelectedShapes()

  if (selectedShapes.length === 0) throw Error('First select something to make real.')

  // Create the preview shape for the 3D model
  const { maxX, midY } = editor.getSelectionPageBounds()!
  const newShapeId = createShapeId()
  editor.createShape<Model3DPreviewShape>({
    id: newShapeId,
    type: 'model3d',
    x: maxX + 60, // to the right of the selection
    y: midY - (540 * 2) / 3 / 2, // half the height of the preview's initial shape
    props: { threeJsCode: '', objectCode: '', selectedShapes: selectedShapes },
  })

  const selectedShapesWithoutModel3d = selectedShapes.filter((shape) => shape.type !== 'model3d')

  // Get an SVG based on the selected shapes
  const svg = await editor.getSvg(selectedShapesWithoutModel3d, {
    scale: 1,
    background: true,
  })

  if (!svg) {
    return
  }

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

function processThreeJsCode(code: string): string {
  let processedCode = code;
  
  processedCode = processedCode.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^import\s+\*\s+as\s+.*?\s+from\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^import\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^const\s+.*?\s*=\s*require\(['"].*?['"]\);?\s*$/gm, '');
  
  processedCode = processedCode.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+{\s*OrbitControls\s*}\s+from\s+['"]three\/addons\/controls\/OrbitControls\.js['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+{\s*[^}]*\s*}\s+from\s+['"]three['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+THREE\s+from\s+['"]three['"];?\s*/g, '');
  
  processedCode = processedCode.replace(/THREE\.OrbitControls/g, 'OrbitControls');
  
  return processedCode;
=======
import { Editor, createShapeId, getSvgAsImage } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { blobToBase64 } from './blobToBase64'
import { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'

export async function vibe3DCode(editor: Editor) {
  // Get the selected shapes (we need at least one)
  const selectedShapes = editor.getSelectedShapes()

  if (selectedShapes.length === 0) throw Error('First select something to make real.')

  // Create the preview shape for the 3D model
  const { maxX, midY } = editor.getSelectionPageBounds()!
  const newShapeId = createShapeId()
  editor.createShape<Model3DPreviewShape>({
    id: newShapeId,
    type: 'model3d',
    x: maxX + 60, // to the right of the selection
    y: midY - (540 * 2) / 3 / 2, // half the height of the preview's initial shape
    props: { threeJsCode: '', selectedShapes: selectedShapes },
  })

  const selectedShapesWithoutModel3d = selectedShapes.filter((shape) => shape.type !== 'model3d')

  // Get an SVG based on the selected shapes
  const svg = await editor.getSvg(selectedShapesWithoutModel3d, {
    scale: 1,
    background: true,
  })

  if (!svg) {
    return
  }

  // Turn the SVG into a DataUrl
  const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const blob = await getSvgAsImage(svg, IS_SAFARI, {
    type: 'png',
    quality: 0.8,
    scale: 1,
  })
  const dataUrl = await blobToBase64(blob!)

  // Get the text from the selection
  const selectionText = getSelectionAsText(editor)

  try {
    // Send the image and text to the backend
    const response = await fetch('http://localhost:8000/api/queue/3d', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: selectionText,
        image_base64: dataUrl
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw Error(`API error: ${errorData.detail || response.statusText}`)
    }

    // Get the response with task ID
    const jsonResponse = await response.json()
    
    // Now wait for the completed code via SSE
    const generatedCodeData = await waitForCodeGeneration(jsonResponse.task_id)
    
    if (generatedCodeData && generatedCodeData.content) {
      // Extract the Three.js code from the response
      const threeJsCode = processThreeJsCode(generatedCodeData.content);
      
      // Make sure we have code
      if (threeJsCode.length < 100) {
        console.warn(generatedCodeData.content)
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

      console.log(`Response received from backend`)
    } else {
      throw Error('No code was generated')
    }
  } catch (e) {
    // If anything went wrong, delete the shape
    editor.deleteShape(newShapeId)
    throw e
  }
}

// Function to wait for the code generation to complete via SSE
async function waitForCodeGeneration(taskId: string): Promise<{ content: string } | null> {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`http://localhost:8000/api/subscribe/${taskId}`)
    
    eventSource.addEventListener('start', (event) => {
      console.log('Code generation started')
    })
    
    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data)
        console.log('Complete event received:', data)
        
        if (data.content) {
          resolve({ content: data.content })
        } else {
          resolve(null)
        }
        eventSource.close()
      } catch (error) {
        console.error('Error parsing complete event:', error)
        reject(error)
        eventSource.close()
      }
    })
    
    eventSource.addEventListener('error', (event) => {
      console.error('SSE error event received')
      try {
        const data = JSON.parse((event as MessageEvent).data)
        reject(new Error(data.error || 'Error generating code'))
      } catch (e) {
        reject(new Error('Unknown error in code generation'))
      } finally {
        eventSource.close()
      }
    })
    
    // Handle general error case
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      reject(new Error('Error with SSE connection'))
      eventSource.close()
    }
    
    // Set a timeout in case the SSE connection doesn't close properly
    setTimeout(() => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        console.warn('Code generation timed out, closing SSE connection')
        eventSource.close()
        reject(new Error('Code generation timed out'))
      }
    }, 120000) // 2 minute timeout
  })
}

function processThreeJsCode(code: string): string {
  let processedCode = code;
  
  // Extract code from markdown code blocks if present
  const jsPattern = /```javascript\s*\n([\s\S]*?)```/;
  const jsMatch = processedCode.match(jsPattern);
  
  if (jsMatch && jsMatch[1]) {
    processedCode = jsMatch[1];
  } else {
    // Try to find any code block with or without language specification
    const codePattern = /```(?:\w*\s*)?\n([\s\S]*?)```/;
    const codeMatch = processedCode.match(codePattern);
    if (codeMatch && codeMatch[1]) {
      processedCode = codeMatch[1];
    } else {
      // If no markdown code blocks found, try to find script tags
      const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/;
      const scriptMatch = processedCode.match(scriptPattern);
      if (scriptMatch && scriptMatch[1]) {
        processedCode = scriptMatch[1];
      }
    }
  }
  
  // Process the code to adapt to the non-ES modules environment
  processedCode = processedCode.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^import\s+\*\s+as\s+.*?\s+from\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^import\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^const\s+.*?\s*=\s*require\(['"].*?['"]\);?\s*$/gm, '');
  
  processedCode = processedCode.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+{\s*OrbitControls\s*}\s+from\s+['"]three\/addons\/controls\/OrbitControls\.js['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+{\s*[^}]*\s*}\s+from\s+['"]three['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+THREE\s+from\s+['"]three['"];?\s*/g, '');
  
  processedCode = processedCode.replace(/THREE\.OrbitControls/g, 'OrbitControls');
  
  return processedCode;
>>>>>>> Stashed changes
}