from redis import Redis
from app.core.config import settings
import json
from typing import Dict, Any
import time

class RedisService:
    """Service for interacting with Redis."""
    
    def __init__(self):
        self.host = settings.REDIS_HOST
        self.port = settings.REDIS_PORT
        self._client = None
    
    @property
    def client(self) -> Redis:
        """Get a Redis client instance."""
        if self._client is None:
            self._client = Redis(
                host=self.host,
                port=self.port,
                decode_responses=True
            )
        return self._client
    
    def get_value(self, key: str) -> str:
        """Get a value from Redis."""
        return self.client.get(key)
    
    def set_value(self, key: str, value: str, expiry: int = None) -> bool:
        """Set a value in Redis with optional expiry in seconds."""
        result = self.client.set(key, value)
        if expiry:
            self.client.expire(key, expiry)
        return result
    
    def delete_value(self, key: str) -> int:
        """Delete a value from Redis."""
        return self.client.delete(key)
    
    def publish(self, channel: str, message: str) -> int:
        """Publish a message to a Redis channel."""
        return self.client.publish(channel, message)
    
    def subscribe(self, channel: str):
        """Subscribe to a Redis channel."""
        pubsub = self.client.pubsub()
        pubsub.subscribe(channel)
        return pubsub
        
    def publish_event(self, task_id: str, event_type: str, data: Dict[str, Any]) -> int:
        """Publish an event to a task's stream channel."""
        event = {
            "event": event_type,
            "data": data
        }
        return self.publish(f"task_stream:{task_id}", json.dumps(event))
        
    def store_response(self, task_id: str, response_data: Dict[str, Any], expiry: int = 3600) -> bool:
        """Store a response in Redis with expiry."""
        key = f"task_response:{task_id}"
        return self.set_value(key, json.dumps(response_data), expiry)
        
    def publish_start_event(self, task_id: str) -> int:
        """Publish a start event for a task."""
        return self.publish_event(task_id, "start", {
            "task_id": task_id,
            "timestamp": time.time()
        })
        
    def publish_complete_event(self, task_id: str, response_data: Dict[str, Any]) -> int:
        """Publish a completion event for a task."""
        return self.publish_event(task_id, "complete", response_data)
        
    def publish_error_event(self, task_id: str, error: Exception) -> int:
        """Publish an error event for a task."""
        error_data = {
            "status": "error",
            "error": str(error),
            "error_type": type(error).__name__,
            "task_id": task_id
        }
        return self.publish_event(task_id, "error", error_data)

# Create a singleton instance
redis_service = RedisService()
