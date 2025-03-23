from fastapi import APIRouter, HTTPException, Request, Body, WebSocket, WebSocketDisconnect
from sse_starlette.sse import EventSourceResponse
from app.api.models import (
    ClaudeResponse, StreamRequest, TaskResponse, TaskStatusResponse, 
    GeminiImageResponse, TrellisRequest, TrellisResponse
)
from app.tasks.claude_tasks import ClaudePromptTask, ClaudeEditTask
from app.tasks.gemini_tasks import GeminiPromptTask, GeminiImageGenerationTask
from app.tasks.cerebras_tasks import get_cerebras_client
from app.core.redis import redis_service
from app.core.config import settings
import json
import uuid
import asyncio
from typing import Dict, Any
from celery.result import AsyncResult
import re
import httpx
import os
from fastapi import BackgroundTasks

# Create the router
router = APIRouter()

# Trellis API URL
TRELLIS_API_URL = "https://api.piapi.ai/api/v1/task"

async def get_task_result(task_id: str) -> Dict[str, Any]:
    """Get the result of a task from Redis or Celery."""
    # Try to get the result from Redis
    result_json = redis_service.get_value(f"task_response:{task_id}")
    
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
    - edit: Uses Claude 3.7 to edit existing Three.js code
    """
    # Generate a task ID if not provided
    task_id = request.task_id or str(uuid.uuid4())
    
    # Handle different task types
    if type == "3d":
        # Use the existing Claude implementation
        ClaudePromptTask.apply_async(
            args=[
                task_id,
                request.image_base64,
                request.prompt,
                request.system_prompt,
                request.max_tokens,
                request.temperature,
                request.additional_params
            ],
            task_id=task_id
        )
    elif type == "edit":
        # Validate Three.js code is provided in additional_params
        if not request.threejs_code:
            raise HTTPException(status_code=400, detail="Three.js code is required for editing")
        
        # At least one of image or prompt must be provided
        if not request.image_base64 and not request.prompt:
            raise HTTPException(status_code=400, detail="At least one of image or text prompt must be provided")
        
        # Use the ClaudeEditTask for code editing
        ClaudeEditTask.apply_async(
            args=[
                task_id,
                request.threejs_code,
                request.image_base64,
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
            # Image is required for GeminiImageGenerationTask
            GeminiImageGenerationTask.apply_async(
                args=[
                    task_id,
                    request.image_base64,
                    request.prompt,
                    request.system_prompt,
                    request.max_tokens,
                    request.temperature,
                    request.additional_params
                ],
                task_id=task_id
            )
        else:
            # Error - image is required
            raise HTTPException(status_code=400, detail="Image base64 is required for image generation")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported task type: {type}")
    
    # Return the task ID for SSE subscription
    return TaskResponse(task_id=task_id)

async def event_generator(task_id: str, request: Request):
    """Generate SSE events from Redis pub/sub."""
    # Subscribe to the Redis channel
    pubsub = redis_service.subscribe(f"task_stream:{task_id}")
    
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
        pubsub.unsubscribe(f"task_stream:{task_id}")
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

@router.post("/trellis/task", response_model=Dict[str, Any])
async def create_trellis_task(request_data: TrellisRequest):
    """Create a task in the Trellis API for image-to-3D generation.
    
    This endpoint accepts the same format as the Trellis API create-task endpoint
    (https://piapi.ai/docs/trellis-api/create-task), but the API key is provided by the backend.
    
    Args:
        request_data: The data to send to the Trellis API, matching their expected format.
        
    Returns:
        Dict[str, Any]: The response from the Trellis API, which includes the job ID.
    """
    # Check if API key is available
    if not settings.TRELLIS_API_KEY:
        raise HTTPException(status_code=500, detail="Trellis API key not configured")
        
    # Set up the headers with our API key
    headers = {
        "x-api-key": settings.TRELLIS_API_KEY,
        "Content-Type": "application/json"
    }
    
    # Convert Pydantic model to dict for the request
    request_dict = request_data.dict(exclude_none=True)
    
    # Make the request to the Trellis API
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                TRELLIS_API_URL,
                headers=headers,
                json=request_dict,
                timeout=30.0  # 30 second timeout
            )
            
            # Check if the request was successful
            response.raise_for_status()
            
            # Return the response from the Trellis API
            return response.json()
            
        except httpx.HTTPStatusError as e:
            # Handle HTTP errors
            error_detail = f"Trellis API error: {e.response.status_code}"
            try:
                error_json = e.response.json()
                if "detail" in error_json:
                    error_detail = error_json["detail"]
            except Exception:
                pass
            
            raise HTTPException(status_code=e.response.status_code, detail=error_detail)
            
        except httpx.RequestError as e:
            # Handle request errors (connection, timeout, etc.)
            raise HTTPException(status_code=500, detail=f"Error connecting to Trellis API: {str(e)}")

@router.websocket("/trellis/task/ws/{task_id}")
async def trellis_task_status_websocket(websocket: WebSocket, task_id: str):
    """WebSocket endpoint that polls the Trellis API for task status.
    
    Args:
        websocket: The WebSocket connection
        task_id: The ID of the task to poll
        
    Returns:
        Streams the task status and result via WebSocket
    """
    # Check if API key is available
    if not settings.TRELLIS_API_KEY:
        await websocket.close(code=1008, reason="Trellis API key not configured")
        return
        
    await websocket.accept()
    
    # Set up headers for Trellis API
    headers = {
        "x-api-key": settings.TRELLIS_API_KEY,
        "Content-Type": "application/json"
    }
    
    # Flag to control polling loop
    continue_polling = True
    
    try:
        # Start polling loop
        while continue_polling:
            try:
                # Poll the Trellis API for task status
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{TRELLIS_API_URL}/{task_id}",
                        headers=headers,
                        timeout=10.0
                    )
                    
                    # If the request was successful, process the response
                    if response.status_code == 200:
                        response_data = response.json()
                        
                        # Extract the status from the response data
                        # Based on PiAPI's common format, status will be in data.status
                        status = "processing"  # Default status
                        
                        if "code" in response_data and response_data["code"] == 200:
                            # Format matches the unified API response
                            if "data" in response_data and "status" in response_data["data"]:
                                status = response_data["data"]["status"]
                        elif "status" in response_data:
                            # Direct status field in response
                            status = response_data["status"]
                        
                        # Map the status to our expected values
                        # Trellis API likely uses "completed", "processing", "failed" etc.
                        is_completed = status.lower() in ["completed", "succeeded", "done"]
                        is_failed = status.lower() in ["failed", "error"]
                        
                        # If task is complete, send the full result
                        if is_completed:
                            model_data = None
                            
                            # Look for the 3D model data
                            if "data" in response_data and "output" in response_data["data"]:
                                output = response_data["data"]["output"]
                                if "model_file" in output:
                                    model_data = output["model_file"]
                            elif "output" in response_data and "model_file" in response_data["output"]:
                                model_data = response_data["output"]["model_file"]
                            
                            await websocket.send_json({
                                "status": "completed",
                                "message": "Task completed successfully",
                                "data": model_data,
                                "full_response": response_data
                            })
                            continue_polling = False
                        elif is_failed:
                            # Task failed, get error message
                            error_message = "Task processing failed"
                            
                            # Look for error message in different possible locations
                            if "data" in response_data and "error" in response_data["data"]:
                                error_data = response_data["data"]["error"]
                                if isinstance(error_data, dict) and "message" in error_data:
                                    error_message = error_data["message"]
                                elif isinstance(error_data, str):
                                    error_message = error_data
                            elif "error" in response_data:
                                error_data = response_data["error"]
                                if isinstance(error_data, dict) and "message" in error_data:
                                    error_message = error_data["message"]
                                elif isinstance(error_data, str):
                                    error_message = error_data
                            
                            await websocket.send_json({
                                "status": "failed",
                                "message": error_message,
                                "data": None,
                                "full_response": response_data
                            })
                            continue_polling = False
                        else:
                            # Task is still processing
                            await websocket.send_json({
                                "status": "processing",
                                "message": f"Task is {status.lower()}, waiting for completion",
                                "data": None
                            })
                    else:
                        # If there was an error retrieving the task
                        error_message = f"Error retrieving task status: {response.status_code}"
                        try:
                            error_data = response.json()
                            if "message" in error_data:
                                error_message = error_data["message"]
                        except Exception:
                            pass
                        
                        await websocket.send_json({
                            "status": "error",
                            "message": error_message,
                            "data": None
                        })
                
                # Check for messages from the client
                # Use wait_for with a timeout to make this non-blocking
                try:
                    # Wait for a message from the client with a timeout
                    client_message = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                    
                    # If the client sent "close", stop polling
                    if client_message == "close":
                        continue_polling = False
                except asyncio.TimeoutError:
                    # No message from client, continue polling
                    pass
                
                # If we're still polling, wait 2 seconds before the next poll
                if continue_polling:
                    await asyncio.sleep(2)
                
            except httpx.RequestError as e:
                # Handle request errors
                await websocket.send_json({
                    "status": "error",
                    "message": f"Error connecting to Trellis API: {str(e)}",
                    "data": None
                })
                # Wait before retrying
                await asyncio.sleep(2)
    
    except WebSocketDisconnect:
        # Client disconnected, exit the loop
        continue_polling = False
    except Exception as e:
        # Handle unexpected errors
        try:
            await websocket.send_json({
                "status": "error",
                "message": f"Unexpected error: {str(e)}",
                "data": None
            })
        except Exception:
            # If we can't send the error, just exit
            pass
    finally:
        # Ensure the WebSocket is closed when we're done
        try:
            await websocket.close()
        except Exception:
            # If the connection is already closed, ignore the error
            pass
