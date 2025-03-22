import uvicorn
from app.core.config import settings

def start_api_server(host=None, port=None, reload=True):
    """Start the FastAPI server with the given configuration."""
    host = host or settings.API_HOST
    port = port or settings.API_PORT
    
    print(f"Starting API server at http://{host}:{port}")
    print("API Documentation available at http://localhost:8000/docs")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload  # For development
    )

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run the Claude 3.7 API server")
    parser.add_argument("--host", type=str, help="Host to bind the server to")
    parser.add_argument("--port", type=int, help="Port to bind the server to")
    parser.add_argument("--no-reload", action="store_true", help="Disable auto-reload")
    
    args = parser.parse_args()
    
    start_api_server(
        host=args.host,
        port=args.port,
        reload=not args.no_reload
    )
