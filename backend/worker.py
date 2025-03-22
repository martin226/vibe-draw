# Run Celery worker for processing Claude requests
from app.core.celery_app import celery_app
import os

def run_worker():
    """Start the Celery worker process."""
    celery_command = "celery -A worker worker --loglevel=info"
    print(f"Starting Celery worker with command: {celery_command}")
    os.system(celery_command)

if __name__ == "__main__":
    # This file is a module that imports celery_app
    # To run the worker, use the command: celery -A worker worker --loglevel=info
    print("Usage: celery -A worker worker --loglevel=info")
    print("Or run with: python -m worker run")
    
    # Check if run command is given
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "run":
        run_worker()
