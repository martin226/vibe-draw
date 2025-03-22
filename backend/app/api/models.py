from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import uuid

class ClaudePromptRequest(BaseModel):
    """Request model for Claude prompt requests."""
    prompt: str = Field(..., description="The prompt to send to Claude")
    system_prompt: Optional[str] = Field(None, description="Optional system prompt")
    max_tokens: Optional[int] = Field(4096, description="Maximum number of tokens to generate")
    temperature: Optional[float] = Field(0.7, description="Temperature for sampling")
    additional_params: Optional[Dict[str, Any]] = Field(None, description="Additional parameters for the Claude API")

class ClaudeResponse(BaseModel):
    """Response model from Claude API."""
    status: str = Field(..., description="Status of the response (success or error)")
    content: Optional[str] = Field(None, description="Content of the response if successful")
    model: Optional[str] = Field(None, description="Model used for the response")
    error: Optional[str] = Field(None, description="Error message if status is error")
    error_type: Optional[str] = Field(None, description="Type of error if status is error")
    usage: Optional[Dict[str, int]] = Field(None, description="Token usage information")
    task_id: Optional[str] = Field(None, description="Task ID for tracking")

class StreamRequest(BaseModel):
    """Request model for streaming responses."""
    prompt: str = Field(..., description="The prompt to send to Claude")
    system_prompt: Optional[str] = Field(None, description="Optional system prompt")
    max_tokens: Optional[int] = Field(4096, description="Maximum number of tokens to generate")
    temperature: Optional[float] = Field(0.7, description="Temperature for sampling")
    additional_params: Optional[Dict[str, Any]] = Field(None, description="Additional parameters for the Claude API")
    task_id: Optional[str] = Field(None, description="Custom task ID for tracking. If not provided, a UUID will be generated.")

class TaskResponse(BaseModel):
    """Response model for task submission."""
    task_id: str = Field(..., description="Task ID for tracking the request")
    status: str = Field("pending", description="Initial status of the task")
    message: str = Field("Task submitted successfully", description="Message about the task status")

class TaskStatusResponse(BaseModel):
    """Response model for task status."""
    task_id: str = Field(..., description="Task ID")
    status: str = Field(..., description="Status of the task (pending, completed, failed)")
    result: Optional[ClaudeResponse] = Field(None, description="Result of the task if completed")
