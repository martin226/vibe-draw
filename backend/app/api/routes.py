from fastapi import APIRouter, HTTPException, Request, Body
from sse_starlette.sse import EventSourceResponse
from app.api.models import ClaudeResponse, StreamRequest, TaskResponse, TaskStatusResponse, GeminiImageResponse
from app.tasks.claude_tasks import ClaudePromptTask
from app.tasks.gemini_tasks import GeminiPromptTask, GeminiImageGenerationTask
from app.tasks.cerebras_tasks import get_cerebras_client
from app.core.redis import redis_service
import json
import uuid
import asyncio
from typing import Dict, Any
from celery.result import AsyncResult
import re

# Create the router
router = APIRouter()

async def get_task_result(task_id: str) -> Dict[str, Any]:
    """Get the result of a task from Redis or Celery."""
    # Try to get the result from Redis
    result_json = redis_service.get_value(f"claude_response:{task_id}")
    
    if result_json:
        # Parse the result from Redis
        return json.loads(result_json)
    
    # Check if the task exists in Celery
    task_result = AsyncResult(task_id)
    
    if task_result.state == "PENDING":
        return {"status": "pending"}
    elif task_result.state == "FAILURE":
        return {
            "status": "error",
            "error": str(task_result.result),
            "error_type": type(task_result.result).__name__
        }
    elif task_result.state == "SUCCESS":
        # The task completed but the result wasn't in Redis
        return task_result.result
    else:
        return {"status": task_result.state.lower()}

@router.get("/task/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """Get the status of an asynchronous task."""
    result = await get_task_result(task_id)
    
    status = "completed" if result.get("status") not in ["pending", "failed"] else result.get("status")
    
    # Determine response type based on result content
    response_model = None
    if status == "completed":
        if "images" in result:
            # It's an image generation response
            response_model = GeminiImageResponse(**result)
        else:
            # It's a text generation response
            response_model = ClaudeResponse(**result)
    
    return TaskStatusResponse(
        task_id=task_id,
        status=status,
        result=response_model
    )

@router.post("/queue/{type}", response_model=TaskResponse)
async def queue_task(type: str, request: StreamRequest):
    """Start a task based on the specified type.
    
    Types:
    - 3d: Uses Claude 3.7 for 3D generation
    - 3d_magic: For 3D magic generation (unimplemented)
    - image: For image generation using Gemini Imagen
    - extract_object: For object extraction (unimplemented)
    - llama: Uses Cerebras LLaMA model
    """
    # Generate a task ID if not provided
    task_id = request.task_id or str(uuid.uuid4())
    
    # Handle different task types
    if type == "3d":
        # Use the existing Claude implementation
        ClaudePromptTask.apply_async(
            args=[
                task_id,
                request.prompt,
                request.system_prompt,
                request.max_tokens,
                request.temperature,
                request.additional_params
            ],
            task_id=task_id
        )
    elif type == "3d_magic":
        # TODO: Implement 3D magic generation
        pass
    elif type == "image":
        # Check if we're generating images or processing an image with text
        if request.image_base64:
            # Process text + image with Gemini
            GeminiPromptTask.apply_async(
                args=[
                    task_id,
                    request.prompt,
                    request.system_prompt,
                    request.max_tokens,
                    request.temperature,
                    request.additional_params,
                    request.image_base64
                ],
                task_id=task_id
            )
        else:
            # Generate images with Gemini's built-in image generation
            GeminiImageGenerationTask.apply_async(
                args=[
                    task_id,
                    request.prompt,
                ],
                task_id=task_id
            )
    elif type == "extract_object":
        # TODO: Implement object extraction
        pass
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported task type: {type}")
    
    # Return the task ID for SSE subscription
    return TaskResponse(task_id=task_id)

async def event_generator(task_id: str, request: Request):
    """Generate SSE events from Redis pub/sub."""
    # Subscribe to the Redis channel
    pubsub = redis_service.subscribe(f"claude_stream:{task_id}")
    
    try:
        # Check if the client is still connected
        while not await request.is_disconnected():
            # Get message from Redis pub/sub
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            
            if message:
                data = json.loads(message["data"])
                event_type = data.get("event")
                event_data = data.get("data")
                
                # Yield the event
                yield {
                    "event": event_type,
                    "data": json.dumps(event_data)
                }
                
                # If this is the completion event, exit the loop
                if event_type in ["complete", "error"]:
                    break
                    
            # Small sleep to prevent CPU spinning
            await asyncio.sleep(0.01)
            
    except Exception as e:
        # Yield an error event
        yield {
            "event": "error",
            "data": json.dumps({
                "status": "error",
                "error": str(e),
                "error_type": type(e).__name__,
                "task_id": task_id
            })
        }
    finally:
        # Always unsubscribe from the channel
        pubsub.unsubscribe(f"claude_stream:{task_id}")
        pubsub.close()

@router.get("/subscribe/{task_id}")
async def subscribe_claude_events(task_id: str, request: Request):
    """Stream events from a Claude 3.7 task."""
    # Return an event source response
    return EventSourceResponse(event_generator(task_id, request))

@router.post("/cerebras/parse")
async def parse_code_with_cerebras(code: str = Body(..., media_type="text/plain")):
    """Direct endpoint to parse code using Cerebras LLaMA model without SSE.
    
    Takes a plain text body containing the code to be parsed and returns the result directly.
    """
    # Initialize Cerebras client
    client = await get_cerebras_client()
    
    # Prepare the message parameters
    messages = [
        {
            "role": "system",
            "content": ""
        },
        {
            "role": "user",
            "content": """You are provided with a JavaScript snippet containing a Three.js scene. Extract only the main 3D object creation code, including relevant geometries, materials, meshes, and groups. Completely remove all unrelated elements such as the scene, renderer, camera, lighting, ground planes, animation loops, event listeners, orbit controls, and window resize handling.

Present the resulting code directly, ending with a single statement explicitly returning only the main object (THREE.Mesh or THREE.Group) that was created.

Do not wrap the code in a function or module. Do not import anything.
""" + code
        }
    ]
    
    # Send the request to Cerebras
    response = await client.chat.completions.create(
        model="llama3.3-70b",
        messages=messages,
        max_tokens=4096,
        temperature=0.2,
        top_p=1
    )
    
    # Extract and clean the content
    raw_content = response.choices[0].message.content
    
    # Find code blocks marked with ```javascript ... ```
    code_blocks = re.findall(r'```(?:javascript)?(.*?)```', raw_content, re.DOTALL)
    
    # Use the first found code block, or fallback to the full content if no blocks found
    content = code_blocks[0].strip() if code_blocks else raw_content
    
    # Return the parsed code directly
    return {
        "status": "success",
        "content": content,
        "model": response.model,
        "usage": {
            "input_tokens": getattr(response.usage, "prompt_tokens", 0),
            "output_tokens": getattr(response.usage, "completion_tokens", 0),
            "total_tokens": getattr(response.usage, "total_tokens", 0)
        }
    }
