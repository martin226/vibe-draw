from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List, Union
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

class GeminiImageResponse(BaseModel):
    """Response model for image generation tasks."""
    status: str = Field(..., description="Status of the response (success or error)")
    model: Optional[str] = Field(None, description="Model used for the response")
    images: Optional[List[Dict[str, str]]] = Field(None, description="List of generated images as base64")
    text: Optional[str] = Field(None, description="Generated text accompanying the images")
    error: Optional[str] = Field(None, description="Error message if status is error")
    task_id: Optional[str] = Field(None, description="Task ID for tracking")

class StreamRequest(BaseModel):
    """Request model for streaming responses."""
    prompt: str = Field(..., description="The prompt to send to Claude")
    threejs_code: Optional[str] = Field(None, description="The Three.js code to edit")
    system_prompt: Optional[str] = Field(None, description="Optional system prompt")
    max_tokens: Optional[int] = Field(4096, description="Maximum number of tokens to generate")
    temperature: Optional[float] = Field(0.7, description="Temperature for sampling")
    additional_params: Optional[Dict[str, Any]] = Field(None, description="Additional parameters for the Claude API")
    task_id: Optional[str] = Field(None, description="Custom task ID for tracking. If not provided, a UUID will be generated.")
    # Image generation parameters
    number_of_images: Optional[int] = Field(1, description="Number of images to generate (1-4)")
    aspect_ratio: Optional[str] = Field("1:1", description="Aspect ratio for generated images (1:1, 16:9, 4:3, etc)")
    negative_prompt: Optional[str] = Field(None, description="Negative prompt for image generation")
    # Base64 encoded image for multi-modal inputs
    image_base64: Optional[str] = Field(None, description="Base64 encoded image for multi-modal inputs")

class TaskResponse(BaseModel):
    """Response model for task submission."""
    task_id: str = Field(..., description="Task ID for tracking the request")
    status: str = Field("pending", description="Initial status of the task")
    message: str = Field("Task submitted successfully", description="Message about the task status")

class TaskStatusResponse(BaseModel):
    """Response model for task status."""
    task_id: str = Field(..., description="Task ID")
    status: str = Field(..., description="Status of the task (pending, completed, failed)")
    result: Optional[Union[ClaudeResponse, GeminiImageResponse]] = Field(None, description="Result of the task if completed")

class TrellisWebhookConfig(BaseModel):
    endpoint: Optional[str] = None
    secret: Optional[str] = None

class TrellisConfig(BaseModel):
    webhook_config: Optional[TrellisWebhookConfig] = None

class TrellisInput(BaseModel):
    image: str
    seed: Optional[int] = 0
    ss_sampling_steps: Optional[int] = Field(50, ge=10, le=50)
    slat_sampling_steps: Optional[int] = Field(50, ge=10, le=50)
    ss_guidance_strength: Optional[float] = Field(7.5, gt=0, le=10)
    slat_guidance_strength: Optional[float] = Field(3, gt=0, le=10)

class TrellisRequest(BaseModel):
    model: str = "Qubico/trellis"
    task_type: str = "image-to-3d"
    input: TrellisInput
    config: Optional[TrellisConfig] = None

class TrellisResponse(BaseModel):
    id: str
    status: str
    # Other fields can be added as needed based on the API response
