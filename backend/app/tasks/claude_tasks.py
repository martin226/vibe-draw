import asyncio
from anthropic import AsyncAnthropic
from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks.tasks import AsyncAITask, GenericPromptTask, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from app.core.redis import redis_service
from typing import Dict, Any, Optional, List, Union

# Default model configuration for Claude
DEFAULT_MODEL = "claude-3-7-sonnet-20250219"

# Create Anthropic client for Claude 3.7
async def get_anthropic_client() -> AsyncAnthropic:
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return client

class AsyncClaudeTask(AsyncAITask):
    """Base class for Claude Celery tasks that use async functions."""
    _client = None
    
    @property
    async def client(self) -> AsyncAnthropic:
        if self._client is None:
            self._client = await get_anthropic_client()
        return self._client

class ClaudePromptTask(GenericPromptTask, AsyncClaudeTask):
    """Task to generate 3D models from images using Claude 3.7."""

    async def _run_async(self, task_id: str, image_base64: str, prompt: str = "",
                         system_prompt: Optional[str] = None,
                         max_tokens: int = DEFAULT_MAX_TOKENS, 
                         temperature: float = DEFAULT_TEMPERATURE,
                         additional_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process a 3D model generation request with Claude 3.7."""
        try:
            # Publish start event
            redis_service.publish_start_event(task_id)
            
            # Get the Claude client
            client = await self.client
            
            # Prepare the system prompt for 3D generation
            system_prompt = """You are an expert 3D modeler and Three.js developer who specializes in turning 2D drawings and wireframes into 3D models.
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
Wrap your entire code in backticks with the javascript identifier: ```javascript"""
            
            # Base text prompt that will always be included
            base_text = """Transform this 2D drawing/wireframe into an interactive Three.js 3D scene. 

I need code that:
1. Creates appropriate 3D geometries based on the shapes in the image
2. Uses materials that match the colors and styles in the drawing
3. Implements OrbitControls for interaction
4. Sets up proper lighting to enhance the 3D effect
5. Includes subtle animations to bring the scene to life
6. Is responsive to container size
7. Creates a cohesive scene that represents the spatial relationships in the drawing

Return ONLY the JavaScript code that creates and animates the Three.js scene."""
            
            # Ensure we have a valid message with at least one content item
            message_content = [{"type": "text", "text": base_text}]
            
            # Extract base64 data without the prefix if it exists
            image_data = image_base64.split(",")[-1] if "," in image_base64 else image_base64
            
            # Add the image to the message
            if image_data:
                message_content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": image_data
                    }
                })
            else:
                raise ValueError("Invalid image data provided")
            
            # Add any text prompts provided
            if prompt and prompt.strip():
                message_content.append({
                    "type": "text",
                    "text": f"Here's a list of text that we found in the design:\n{prompt}"
                })
            
            # Prepare message parameters for Claude
            message_params = {
                "model": DEFAULT_MODEL,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": [{
                    "role": "user",
                    "content": message_content
                }],
                "system": system_prompt
            }
            
            # Add any additional parameters
            if additional_params:
                message_params.update(additional_params)
            
            # Send the request to Claude
            response = await client.messages.create(**message_params)
            
            # Extract content from the response
            content = response.content[0].text
            
            # Prepare the final response
            final_response = {
                "status": "success",
                "content": content,
                "model": response.model,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                },
                "task_id": task_id
            }
            
            # Publish completion event
            redis_service.publish_complete_event(task_id, final_response)
            
            # Store the final response in Redis for retrieval
            redis_service.store_response(task_id, final_response)
            
            return final_response
            
        except Exception as e:
            # Prepare error response
            error_response = {
                "status": "error",
                "error": str(e),
                "error_type": type(e).__name__,
                "task_id": task_id
            }
            
            try:
                # Publish error event and store the error response
                redis_service.publish_error_event(task_id, e)
                redis_service.store_response(task_id, error_response)
            except Exception:
                pass  # Ignore Redis errors at this point
            
            return error_response

    def run(self, task_id: str, image_base64: str, prompt: str = "",
            system_prompt: Optional[str] = None,
            max_tokens: int = DEFAULT_MAX_TOKENS, 
            temperature: float = DEFAULT_TEMPERATURE,
            additional_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Run the task with the given parameters."""
        # Create and run the event loop to execute the async function
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(
            self._run_async(
                task_id=task_id,
                image_base64=image_base64,
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                additional_params=additional_params
            )
        )
        return result

# Register the task properly with Celery
ClaudePromptTask = celery_app.register_task(ClaudePromptTask())
