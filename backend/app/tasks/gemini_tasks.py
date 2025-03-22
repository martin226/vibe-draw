import asyncio
import base64
from io import BytesIO
from google import genai
from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks.tasks import AsyncAITask, GenericPromptTask, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from typing import Dict, Any, Optional, List, Union
from google.genai import types

# Default model configuration for Gemini
DEFAULT_MODEL = "gemini-2.0-flash-exp"
DEFAULT_IMAGE_MODEL = "imagen-3.0-generate-002"

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
                # Create blob from base64 data
                image_bytes = base64.b64decode(image_base64)
                image_part = types.Part.from_data(
                    data=image_bytes,
                    mime_type="image/jpeg"  # Assume JPEG by default
                )
                
                # Create a list with both the prompt and image
                contents = [prompt, image_part]
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

class GeminiImageGenerationTask(AsyncGeminiTask):
    """Task to generate images with Imagen."""
    
    async def execute(self, task_id: str, prompt: str, 
                  number_of_images: int = 1,
                  aspect_ratio: str = "1:1",
                  negative_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generate images based on prompt (async implementation)."""
        client = await self.client
        
        # Create config for image generation
        config = types.GenerateImagesConfig(
            number_of_images=number_of_images,
            aspect_ratio=aspect_ratio
        )
        
        # Add negative prompt if provided
        if negative_prompt:
            config.negative_prompt = negative_prompt
            
        try:
            # Generate images
            response = await client.aio.models.generate_images(
                model=DEFAULT_IMAGE_MODEL,
                prompt=prompt,
                config=config
            )
            
            # Process the response
            image_results = []
            for idx, generated_image in enumerate(response.generated_images):
                # Convert image to base64 for return
                image_base64 = base64.b64encode(generated_image.image.image_bytes).decode('utf-8')
                image_results.append({
                    "image_id": f"{task_id}_{idx}",
                    "image_base64": image_base64
                })
                
            return {
                "status": "success",
                "model": DEFAULT_IMAGE_MODEL,
                "images": image_results,
                "task_id": task_id
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "task_id": task_id
            }
    
    def run(self, task_id: str, prompt: str, 
            number_of_images: int = 1,
            aspect_ratio: str = "1:1",
            negative_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Non-async wrapper for Celery compatibility."""
        # Create and run the event loop to execute the async function
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(
            self.execute(
                task_id=task_id,
                prompt=prompt,
                number_of_images=number_of_images,
                aspect_ratio=aspect_ratio,
                negative_prompt=negative_prompt
            )
        )
        return result

# Register the tasks properly with Celery
GeminiPromptTask = celery_app.register_task(GeminiPromptTask()) 
GeminiImageGenerationTask = celery_app.register_task(GeminiImageGenerationTask()) 