import { Editor, getSvgAsImage } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { blobToBase64 } from './blobToBase64'
import { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'

export async function edit3DCode(
  editor: Editor,
  setIsEditing?: (isEditing: boolean) => void
) {
  // Set editing state if provided
  if (setIsEditing) setIsEditing(true);

  try {
    // Get the selected shapes
    const selectedShapes = editor.getSelectedShapes()
    
    if (selectedShapes.length === 0) {
      throw Error('First select shapes for editing.')
    }

    // Filter the 3D model shapes and other shapes
    const model3dShapes = selectedShapes.filter((shape) => shape.type === 'model3d')
    const nonModel3dShapes = selectedShapes.filter((shape) => shape.type !== 'model3d')
    
    // Validation checks
    if (model3dShapes.length === 0) {
      throw Error('First select a 3D model to edit.')
    }
    
    if (model3dShapes.length > 1) {
      throw Error('Select only one 3D model at a time.')
    }
    
    if (nonModel3dShapes.length === 0) {
      throw Error('Select at least one drawing or shape to guide the editing.')
    }
    
    // Get the model3D shape and its Three.js code
    const model3dShape = model3dShapes[0] as Model3DPreviewShape
    const threeJsCode = model3dShape.props.threeJsCode
    
    if (!threeJsCode || threeJsCode.length < 10) {
      throw Error('The selected 3D model does not contain valid code.')
    }

    // Get an SVG based on the non-model3d shapes
    const svg = await editor.getSvg(nonModel3dShapes, {
      scale: 1,
      background: true,
    })

    if (!svg) {
      throw Error('Could not generate SVG from selected shapes.')
    }

    // Turn the SVG into a DataUrl
    const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    const blob = await getSvgAsImage(svg, IS_SAFARI, {
      type: 'png',
      quality: 0.8,
      scale: 1,
    })
    
    if (!blob) {
      throw Error('Could not generate image from SVG.')
    }
    
    const dataUrl = await blobToBase64(blob)

    // Get any text from the selection
    const selectionText = getSelectionAsText(editor)

    // Send the code, image and text to the backend
    const response = await fetch('http://localhost:8000/api/queue/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        threejs_code: threeJsCode,
        prompt: selectionText,
        image_base64: dataUrl,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw Error(`API error: ${errorData.detail || response.statusText}`)
    }

    // Get the response with task ID
    const jsonResponse = await response.json()
    
    // Now wait for the edited code via SSE
    const editedCodeData = await waitForCodeEditing(jsonResponse.task_id)
    
    if (editedCodeData && editedCodeData.content) {
      // Extract the edited Three.js code from the response
      const editedThreeJsCode = processThreeJsCode(editedCodeData.content)
      
      // Make sure we have code
      if (editedThreeJsCode.length < 100) {
        console.warn(editedCodeData.content)
        throw Error('Could not generate edited 3D model code.')
      }

      // Update the shape with the edited code
      editor.updateShape<Model3DPreviewShape>({
        id: model3dShape.id,
        type: 'model3d',
        props: {
          threeJsCode: editedThreeJsCode,
        },
      })

      console.log(`3D model successfully edited`)
      return model3dShape.id
    } else {
      throw Error('No code was generated from the edit')
    }
  } catch (e) {
    console.error('Error in edit3DCode:', e)
    throw e
  } finally {
    // Reset editing state if provided
    if (setIsEditing) setIsEditing(false);
  }
}

// Function to wait for the code editing to complete via SSE
async function waitForCodeEditing(taskId: string): Promise<{ content: string } | null> {
  return new Promise((resolve, reject) => {
    let timeout: NodeJS.Timeout | null = null;
    
    try {
      const eventSource = new EventSource(`http://localhost:8000/api/subscribe/${taskId}`)
      
      // Set a timeout in case the SSE connection doesn't close properly
      timeout = setTimeout(() => {
        console.warn('Code editing timed out, closing SSE connection')
        eventSource.close()
        reject(new Error('Code editing timed out'))
      }, 120000) // 2 minute timeout
      
      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        eventSource.close()
      }
      
      eventSource.addEventListener('start', (event) => {
        console.log('Code editing started')
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
        } catch (error) {
          console.error('Error parsing complete event:', error)
          reject(error)
        } finally {
          cleanup()
        }
      })
      
      eventSource.addEventListener('error', (event) => {
        console.error('SSE error event received')
        try {
          const data = JSON.parse((event as MessageEvent).data)
          reject(new Error(data.error || 'Error editing code'))
        } catch (e) {
          reject(new Error('Unknown error in code editing'))
        } finally {
          cleanup()
        }
      })
      
      // Handle general error case
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        reject(new Error('Error with SSE connection'))
        cleanup()
      }
    } catch (err) {
      console.error('Error setting up SSE connection:', err)
      if (timeout) clearTimeout(timeout)
      reject(err)
    }
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
} 