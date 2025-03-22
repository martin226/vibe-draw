import asyncio
import base64
import os
from io import BytesIO
from google import genai
from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks.tasks import AsyncAITask, GenericPromptTask, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
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
    """Task to generate images with Gemini 2.0 Flash."""
    
    async def execute(self, task_id: str, prompt: str) -> Dict[str, Any]:
        """Generate images based on prompt using Gemini's built-in image generation."""
        client = await self.client
        
        # Log the request for debugging
        print(f"[DEBUG] Generating image with prompt: '{prompt}'")
        
        # Prepare config for image generation
        config = types.GenerateContentConfig(
            response_modalities=['Text', 'Image']
        )
            
        try:
            # Generate images using Gemini's multimodal response
            response = await client.aio.models.generate_content(
                model=DEFAULT_IMAGE_GEN_MODEL,
                contents=prompt,
                config=config
            )
            
            # Process the response parts
            image_results = []
            text_results = []
            
            # Process each part of the response
            for idx, part in enumerate(response.candidates[0].content.parts):
                if part.text is not None:
                    text_results.append(part.text)
                    print(f"[DEBUG] Generated text: {part.text}")
                elif part.inline_data is not None:
                    # Save image to disk for debugging
                    image_bytes = part.inline_data.data
                    image_path = os.path.join(DEBUG_IMAGE_DIR, f"{task_id}_{idx}.jpg")
                    
                    # Save the image using PIL
                    try:
                        img = Image.open(BytesIO(image_bytes))
                        img.save(image_path)
                        print(f"[DEBUG] Saved image to {image_path}")
                    except Exception as e:
                        print(f"[ERROR] Failed to save image: {str(e)}")
                    
                    # Convert image to base64 for return
                    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    image_results.append({
                        "image_id": f"{task_id}_{idx}",
                        "image_base64": image_base64,
                        "saved_path": image_path
                    })
                
            # Log result summary
            print(f"[DEBUG] Generated {len(image_results)} images and {len(text_results)} text blocks")
                
            return {
                "status": "success",
                "model": DEFAULT_IMAGE_GEN_MODEL,
                "images": image_results,
                "text": "\n".join(text_results) if text_results else "",
                "task_id": task_id
            }
            
        except Exception as e:
            print(f"[ERROR] Image generation failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "task_id": task_id
            }
    
    def run(self, task_id: str, prompt: str) -> Dict[str, Any]:
        """Non-async wrapper for Celery compatibility."""
        # Create and run the event loop to execute the async function
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(
            self.execute(
                task_id=task_id,
                prompt=prompt
            )
        )
        return result

# Register the tasks properly with Celery
GeminiPromptTask = celery_app.register_task(GeminiPromptTask()) 
GeminiImageGenerationTask = celery_app.register_task(GeminiImageGenerationTask()) 