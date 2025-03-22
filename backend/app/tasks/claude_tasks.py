import asyncio
from anthropic import AsyncAnthropic
from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks.tasks import AsyncAITask, GenericPromptTask, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE
from typing import Dict, Any, Optional

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
    """Task to stream a prompt with Claude 3.7."""
    
    def prepare_message_params(self, prompt: str, system_prompt: Optional[str] = None,
                             max_tokens: int = DEFAULT_MAX_TOKENS, 
                             temperature: float = DEFAULT_TEMPERATURE,
                             additional_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Prepare the message parameters for Claude."""
        message_params = {
            "model": DEFAULT_MODEL,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        }
        
        # Add system prompt if provided
        if system_prompt:
            message_params["system"] = system_prompt
            
        # Add any additional parameters
        if additional_params:
            message_params.update(additional_params)
            
        return message_params
    
    async def send_message(self, client: AsyncAnthropic, message_params: Dict[str, Any]) -> Any:
        """Send the message to Claude."""
        return await client.messages.create(**message_params)
    
    def extract_content(self, response: Any) -> str:
        """Extract the content from Claude's response."""
        return response.content[0].text
    
    def prepare_final_response(self, task_id: str, response: Any, content: str) -> Dict[str, Any]:
        """Prepare the final response with Claude-specific metadata."""
        return {
            "status": "success",
            "content": content,
            "model": response.model,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            },
            "task_id": task_id
        }

# Register the task properly with Celery
ClaudePromptTask = celery_app.register_task(ClaudePromptTask())
