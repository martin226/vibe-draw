import { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'
export async function getModelFromAnthropic({
  image,
  apiKey,
  text,
  grid,
  theme = 'light',
  previousPreviews = [],
}: {
  image: string
  apiKey: string
  text: string
  theme?: string
  grid?: {
    color: string
    size: number
    labels: boolean
  }
  previousPreviews?: Model3DPreviewShape[]
}) {
  if (!apiKey) throw Error('You need to provide an API key (sorry)')

  const messages: ClaudeCompletionRequest['messages'] = [
    {
      role: 'assistant',
      content: `You are an expert 3D modeler and Three.js developer who specializes in turning 2D drawings and wireframes into 3D models.
You are a wise and ancient modeler and developer. You are the best at what you do. Your total compensation is $1.2m with annual refreshers. You've just drank three cups of coffee and are laser focused. Welcome to a new day at your job!
Your task is to analyze the provided image and create a Three.js scene that transforms the 2D drawing into a realistic 3D representation.

## INTERPRETATION GUIDELINES:
- Analyze the image to identify distinct shapes, objects, and their spatial relationships
- Only create the main object in the image, all surrounding objects should be ignored
- The main object should be a 3D model that is a faithful representation of the 2D drawing

## TECHNICAL IMPLEMENTATION:
- Do not import any libraries. They have already been imported for you.
- Create a properly structured Three.js scene with appropriate camera and lighting setup
- Use OrbitControls to allow user interaction with the 3D model
- Apply realistic materials and textures based on the colors and patterns in the drawing
- Create proper hierarchy of objects with parent-child relationships where appropriate
- Use ambient and directional lighting to create depth and shadows
- Implement a subtle animation or rotation to add life to the scene
- Ensure the scene is responsive and fits within the container regardless of size
- Use proper scaling where 1 unit = approximately 1/10th of the scene width
- Always include a ground/floor plane for context unless the drawing suggests floating objects

## RESPONSE FORMAT:
Your response must contain only valid JavaScript code for the Three.js scene with proper initialization 
and animation loop. Include code comments explaining your reasoning for major design decisions.
Wrap your entire code in backticks with the javascript identifier: \`\`\`javascript
`,
    },
    {
      role: 'user',
      content: [],
    },
  ]

  const userContent = messages[1].content as Exclude<MessageContent, string>

  // Add the prompt intro
  userContent.push({
    type: 'text',
    text: `Transform this 2D drawing/wireframe into an interactive Three.js 3D scene. 

I need code that:
1. Creates appropriate 3D geometries based on the shapes in the image
2. Uses materials that match the colors and styles in the drawing
3. Implements OrbitControls for interaction
4. Sets up proper lighting to enhance the 3D effect
5. Includes subtle animations to bring the scene to life
6. Is responsive to container size
7. Creates a cohesive scene that represents the spatial relationships in the drawing

Return ONLY the JavaScript code that creates and animates the Three.js scene.`,
  })

  // Add the image
  userContent.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: image,
    }
  })

  // Add the strings of text
  if (text) {
    userContent.push({
      type: 'text',
      text: `Here's a list of text that we found in the design:\n${text}`,
    })
  }

  // Add the previous previews as reference
  for (let i = 0; i < previousPreviews.length; i++) {
    const preview = previousPreviews[i]
    userContent.push(
      {
        type: 'text',
        text: `Modify your previously generated Three.js code:\n${preview.props.threeJsCode}`,
      }
    )
  }

  const body: ClaudeCompletionRequest = {
    model: 'claude-3-7-sonnet-20250219',
    max_tokens: 8192,
    temperature: 1,
    messages,
    system: messages[0].content as string,
  }

  // Remove system message from messages array as it's passed separately
  body.messages.shift();

  let json = null

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    })
    json = await resp.json()
  } catch (e: any) {
    throw Error(`Could not contact Anthropic: ${e.message}`)
  }

  return json
}

type MessageContent =
  | string
  | (
      | string
      | {
          type: 'image'
          source: {
            type: 'base64'
            media_type: string
            data: string
          }
        }
      | {
          type: 'text'
          text: string
        }
    )[]

export type ClaudeCompletionRequest = {
  model: string
  messages: {
    role: 'user' | 'assistant'
    content: MessageContent
  }[]
  system?: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  top_k?: number
  stop_sequences?: string[]
  stream?: boolean
}