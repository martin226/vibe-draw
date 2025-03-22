import asyncio
from celery import Task
from app.core.celery_app import celery_app
from app.core.redis import redis_service
from typing import Dict, Any, Optional, Protocol

# Default model configuration - can be overridden by specific implementations
DEFAULT_MAX_TOKENS = 4096
DEFAULT_TEMPERATURE = 0.7

class AsyncClient(Protocol):
    """Protocol defining the interface that AI client implementations must satisfy."""
    async def send_message(self, message_params: Dict[str, Any]) -> Any:
        """Send a message to the AI service and return the response."""
        ...

class AsyncAITask(Task):
    """Base class for AI Celery tasks that use async functions."""
    _client = None
    
    @property
    async def client(self) -> AsyncClient:
        """Get the AI client. This should be implemented by subclasses."""
        raise NotImplementedError
    
    def run(self, *args, **kwargs):
        """Run the coroutine in an event loop."""
        return asyncio.run(self._run_async(*args, **kwargs))
    
    async def _run_async(self, *args, **kwargs):
        """This should be implemented by subclasses."""
        raise NotImplementedError

class GenericPromptTask(AsyncAITask):
    """Generic task to stream a prompt to an AI model."""
    
    async def _run_async(self, task_id: str, prompt: str, system_prompt: Optional[str] = None,
                        max_tokens: int = DEFAULT_MAX_TOKENS, temperature: float = DEFAULT_TEMPERATURE,
                        additional_params: Optional[Dict[str, Any]] = None):
        """Process a prompt with an AI model and stream the response to Redis."""
        try:
            # Publish start event
            redis_service.publish_start_event(task_id)
            
            # Prepare the message parameters - this will be modified by subclasses
            message_params = self.prepare_message_params(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                additional_params=additional_params
            )
            
            # Get client
            client = await self.client
            
            # Send the message to the AI service
            response = await self.send_message(client, message_params)
            
            # Extract the response content - subclass responsibility
            content = self.extract_content(response)
            
            # Prepare final response with metadata
            final_response = self.prepare_final_response(task_id, response, content)
            
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
                             max_tokens: int = DEFAULT_MAX_TOKENS, temperature: float = DEFAULT_TEMPERATURE,
                             additional_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Prepare the message parameters for the AI service.
        
        This should be implemented by subclasses to format the prompt according to
        the requirements of their specific AI service.
        """
        raise NotImplementedError
    
    async def send_message(self, client: Any, message_params: Dict[str, Any]) -> Any:
        """Send the message to the AI service.
        
        This should be implemented by subclasses to handle the specific API call.
        """
        raise NotImplementedError
    
    def extract_content(self, response: Any) -> str:
        """Extract the content from the AI service response.
        
        This should be implemented by subclasses to parse the response format.
        """
        raise NotImplementedError
    
    def prepare_final_response(self, task_id: str, response: Any, content: str) -> Dict[str, Any]:
        """Prepare the final response with metadata.
        
        This should be implemented by subclasses to include service-specific metadata.
        """
        raise NotImplementedError 