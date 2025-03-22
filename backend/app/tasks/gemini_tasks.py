import asyncio
from google.generativeai import AsyncGenAI
from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks.tasks import AsyncAITask, GenericPromptTask, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from typing import Dict, Any, Optional

# Default model configuration for Gemini
DEFAULT_MODEL = "gemini-2.0-flash-exp"

# Create Gemini client
async def get_gemini_client() -> AsyncGenAI:
    client = AsyncGenAI(api_key=settings.GOOGLE_API_KEY)
    return client

class AsyncGeminiTask(AsyncAITask):
    """Base class for Gemini Celery tasks that use async functions."""
    _client = None
    
    @property
    async def client(self) -> AsyncGenAI:
        if self._client is None:
            self._client = await get_gemini_client()
        return self._client

class GeminiPromptTask(GenericPromptTask, AsyncGeminiTask):
    """Task to stream a prompt with Gemini 2.0 Flash."""
    
    def prepare_message_params(self, prompt: str, system_prompt: Optional[str] = None,
                             max_tokens: int = DEFAULT_MAX_TOKENS, 
                             temperature: float = DEFAULT_TEMPERATURE,
                             additional_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Prepare the message parameters for Gemini."""
        message_params = {
            "model": DEFAULT_MODEL,
            "max_output_tokens": max_tokens,
            "temperature": temperature,
            "contents": [{
                "role": "user",
                "parts": [{"text": prompt}]
            }]
        }
        
        # Add system prompt if provided
        if system_prompt:
            message_params["system_instruction"] = {"parts": [{"text": system_prompt}]}
            
        # Add any additional parameters
        if additional_params:
            message_params.update(additional_params)
            
        return message_params
    
    async def send_message(self, client: AsyncGenAI, message_params: Dict[str, Any]) -> Any:
        """Send the message to Gemini."""
        return await client.generate_content(**message_params)
    
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
                "input_tokens": getattr(response, "usage", {}).get("prompt_tokens", 0),
                "output_tokens": getattr(response, "usage", {}).get("completion_tokens", 0)
            },
            "task_id": task_id
        }

# Register the task properly with Celery
GeminiPromptTask = celery_app.register_task(GeminiPromptTask()) 