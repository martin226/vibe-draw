import asyncio
import base64
import os
from io import BytesIO
from google import genai
from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks.tasks import AsyncAITask, GenericPromptTask, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from app.core.redis import redis_service
from typing import Dict, Any, Optional, List, Union
from google.genai import types
from PIL import Image

# Default model configuration for Gemini
DEFAULT_MODEL = "gemini-2.0-flash-exp"
DEFAULT_IMAGE_GEN_MODEL = "gemini-2.0-flash-exp-image-generation"

# Create output directory for debug images
DEBUG_IMAGE_DIR = "debug_images"
os.makedirs(DEBUG_IMAGE_DIR, exist_ok=True)

# Create Gemini client
async def get_gemini_client():
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return client

class AsyncGeminiTask(AsyncAITask):
    """Base class for Gemini Celery tasks that use async functions."""
    _client = None
    
    @property
    async def client(self):
        if self._client is None:
            self._client = await get_gemini_client()
        return self._client

class GeminiPromptTask(GenericPromptTask, AsyncGeminiTask):
    """Task to stream a prompt with Gemini 2.0 Flash."""
    
    def prepare_message_params(self, prompt: str, system_prompt: Optional[str] = None,
                             max_tokens: int = DEFAULT_MAX_TOKENS, 
                             temperature: float = DEFAULT_TEMPERATURE,
                             additional_params: Optional[Dict[str, Any]] = None,
                             image_base64: Optional[str] = None) -> Dict[str, Any]:
        """Prepare the message parameters for Gemini."""
        # Create config with generation parameters
        config = types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature
        )
        
        # Add system prompt if provided
        if system_prompt:
            config.system_instruction = system_prompt
            
        # Create contents with text and image if provided
        contents: Union[str, List] = prompt
        
        # If image is provided, add it to contents
        if image_base64:
            # Decode base64 image and create a Part
            try:
                image = Image.open(BytesIO(base64.b64decode(image_base64)))
                # Create a list with both the prompt and image
                contents = [prompt, image]
            except Exception as e:
                # Log the error but continue with just the text
                print(f"Error processing image: {str(e)}")
        
        message_params = {
            "model": DEFAULT_MODEL,
            "contents": contents,
            "config": config
        }
        
        # Add any additional parameters
        if additional_params:
            message_params.update(additional_params)
            
        return message_params
    
    async def send_message(self, client, message_params: Dict[str, Any]) -> Any:
        """Send the message to Gemini."""
        model_name = message_params.pop("model")
        return await client.aio.models.generate_content(model=model_name, **message_params)
    
    def extract_content(self, response: Any) -> str:
        """Extract the content from Gemini's response."""
        return response.text
    
    def prepare_final_response(self, task_id: str, response: Any, content: str) -> Dict[str, Any]:
        """Prepare the final response with Gemini-specific metadata."""
        return {
            "status": "success",
            "content": content,
            "model": DEFAULT_MODEL,
            "usage": {
                "input_tokens": getattr(response.usage_metadata, "prompt_token_count", 0),
                "output_tokens": getattr(response.usage_metadata, "candidates_token_count", 0),
                "total_tokens": getattr(response.usage_metadata, "total_token_count", 0)
            },
            "task_id": task_id
        }

class GeminiImageGenerationTask(GenericPromptTask, AsyncGeminiTask):
    """Task to generate images with Gemini 2.0 Flash with SSE streaming support."""
    
    async def _run_async(self, task_id: str, image_base64: str, prompt: str = "", 
                        system_prompt: Optional[str] = None,
                        max_tokens: int = DEFAULT_MAX_TOKENS, 
                        temperature: float = DEFAULT_TEMPERATURE,
                        additional_params: Optional[Dict[str, Any]] = None):
        """Process a prompt with an image for Gemini image generation."""
        try:
            # Publish start event
            redis_service.publish_start_event(task_id)
            
            # Prepare the message parameters
            message_params = self.prepare_message_params(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                additional_params=additional_params,
                image_base64=image_base64
            )
            
            # Get client
            client = await self.client
            
            # Send the message to the AI service
            response = await self.send_message(client, message_params)
            
            # Prepare final response with metadata
            final_response = self.prepare_final_response(task_id, response, '')
            
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
    
    def prepare_message_params(self, prompt: str, system_prompt: Optional[str] = None,
                              max_tokens: int = DEFAULT_MAX_TOKENS, 
                              temperature: float = DEFAULT_TEMPERATURE,
                              additional_params: Optional[Dict[str, Any]] = None,
                              image_base64: Optional[str] = None) -> Dict[str, Any]:
        """Prepare the message parameters for Gemini image generation."""
        if not image_base64:
            raise ValueError("Image base64 is required for image generation")
            
        # Create config with generation parameters
        config = types.GenerateContentConfig(
            response_modalities=['Text', 'Image']
        )
        
        # Default system prompt for image generation if not provided
        if not system_prompt:
            system_prompt = "Convert this rough sketch into an image of a low-poly 3D model. Include only the object in the image, with nothing else."
        
        try:
            # Convert the image base64 to PIL Image
            image = Image.open(BytesIO(base64.b64decode(image_base64)))
            
            # Create contents with system prompt, optional user prompt, and image
            contents = [system_prompt, image] if not prompt else [system_prompt, prompt, image]
            
        except Exception as e:
            # Log the error and raise
            print(f"[ERROR] Error processing input image: {str(e)}")
            raise ValueError(f"Failed to process input image: {str(e)}")
        
        message_params = {
            "model": DEFAULT_IMAGE_GEN_MODEL,
            "contents": contents,
            "config": config
        }
        
        # Add any additional parameters
        if additional_params:
            message_params.update(additional_params)
            
        return message_params
    
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
        
    async def send_message(self, client, message_params: Dict[str, Any]) -> Any:
        """Send the message to Gemini for image generation."""
        model_name = message_params.pop("model")
        return await client.aio.models.generate_content(model=model_name, **message_params)
    
    def prepare_final_response(self, task_id: str, response: Any, content: str) -> Dict[str, Any]:
        """Prepare the final response with Gemini-specific metadata and generated images."""
        image_results = []
        
        # Process each part of the response to extract images
        for idx, part in enumerate(response.candidates[0].content.parts):
            if part.inline_data is not None:
                # Save image to disk for debugging
                image_bytes = part.inline_data.data
                image_path = os.path.join(DEBUG_IMAGE_DIR, f"{task_id}_{idx}.jpg")
                
                # Save the image using PIL
                try:
                    img = Image.open(BytesIO(image_bytes))
                    img.save(image_path)
                    print(f"[DEBUG] Saved image to {image_path}")
                    
                    # Get image dimensions
                    width, height = img.size
                except Exception as e:
                    print(f"[ERROR] Failed to save image: {str(e)}")
                    width, height = 500, 500  # Default dimensions on error
                
                # Convert image to base64 for return
                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                image_results.append({
                    "image_id": f"{task_id}_{idx}",
                    "image_base64": image_base64,
                    "saved_path": image_path,
                    "width": width,
                    "height": height
                })
        
        # Log result summary
        print(f"[DEBUG] Generated {len(image_results)} images and content length {len(content)}")
        
        return {
            "status": "success",
            "content": content,
            "model": DEFAULT_IMAGE_GEN_MODEL,
            "images": image_results,
            "usage": {
                "input_tokens": getattr(response.usage_metadata, "prompt_token_count", 0),
                "output_tokens": getattr(response.usage_metadata, "candidates_token_count", 0),
                "total_tokens": getattr(response.usage_metadata, "total_token_count", 0)
            },
            "task_id": task_id
        }

# Register the tasks properly with Celery
GeminiPromptTask = celery_app.register_task(GeminiPromptTask()) 
GeminiImageGenerationTask = celery_app.register_task(GeminiImageGenerationTask()) 