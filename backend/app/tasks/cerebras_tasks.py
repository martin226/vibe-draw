import asyncio
from cerebras.cloud.sdk import AsyncCerebras
from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks.tasks import AsyncAITask, GenericPromptTask, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from typing import Dict, Any, Optional, List

# Default model configuration for Cerebras
DEFAULT_MODEL = "llama3.1-8b"

# Create Cerebras client
async def get_cerebras_client() -> AsyncCerebras:
    client = AsyncCerebras(api_key=settings.CEREBRAS_API_KEY)
    return client

class AsyncCerebrasTask(AsyncAITask):
    """Base class for Cerebras Celery tasks that use async functions."""
    _client = None
    
    @property
    async def client(self) -> AsyncCerebras:
        if self._client is None:
            self._client = await get_cerebras_client()
        return self._client

class CerebrasPromptTask(GenericPromptTask, AsyncCerebrasTask):
    """Task to process a prompt with Cerebras LLaMA."""
    
    def prepare_message_params(self, prompt: str, system_prompt: Optional[str] = None,
                             max_tokens: int = DEFAULT_MAX_TOKENS, 
                             temperature: float = DEFAULT_TEMPERATURE,
                             additional_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Prepare the message parameters for Cerebras."""
        messages = []
        
        # Add system message if provided
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
            
        # Add user message
        messages.append({
            "role": "user",
            "content": prompt
        })
        
        # Prepare parameters
        message_params = {
            "model": DEFAULT_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        # Add any additional parameters
        if additional_params:
            message_params.update(additional_params)
            
        return message_params
    
    async def send_message(self, client: AsyncCerebras, message_params: Dict[str, Any]) -> Any:
        """Send the message to Cerebras."""
        model = message_params.pop("model")
        return await client.chat.completions.create(model=model, top_p=1, **message_params)
    
    def extract_content(self, response: Any) -> str:
        """Extract the content from Cerebras response."""
        return response.choices[0].message.content.lstrip("```javascript").rstrip("```")
    
    def prepare_final_response(self, task_id: str, response: Any, content: str) -> Dict[str, Any]:
        """Prepare the final response with Cerebras-specific metadata."""
        return {
            "status": "success",
            "content": content,
            "model": response.model,
            "usage": {
                "input_tokens": getattr(response.usage, "prompt_tokens", 0),
                "output_tokens": getattr(response.usage, "completion_tokens", 0),
                "total_tokens": getattr(response.usage, "total_tokens", 0)
            },
            "task_id": task_id
        }

# Register the task properly with Celery
CerebrasPromptTask = celery_app.register_task(CerebrasPromptTask()) 