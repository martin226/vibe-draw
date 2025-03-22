from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router
from app.core.config import settings

# Create FastAPI app with metadata
app = FastAPI(
    title="Claude 3.7 API",
    version="0.1.0",
    description="API for interacting with Claude 3.7 model",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    """Root endpoint that confirms the API server is running."""
    return {
        "message": "Claude 3.7 API server running",
        "version": "0.1.0",
        "docs_url": "/docs"
    }
