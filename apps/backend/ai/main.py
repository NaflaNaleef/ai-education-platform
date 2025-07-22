# apps/backend/ai/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import service classes
from services.question_generator import QuestionGenerator
from services.grading_service import GradingService

# Initialize FastAPI app
app = FastAPI(
    title="AI Education Service",
    description="AI microservice for question generation and grading",
    version="1.0.0"
)

# CORS middleware for Next.js integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js development
        "http://localhost:3001",  # Alternative port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize service classes
question_generator = QuestionGenerator()
grading_service = GradingService()

# Request/Response models
class ContentAnalysisRequest(BaseModel):
    file_content: str
    file_type: str
    resource_id: str

class ContentAnalysisResponse(BaseModel):
    success: bool
    content_type: Optional[str] = None
    word_count: Optional[int] = None
    language: Optional[str] = None
    suitable_for_questions: Optional[bool] = None
    message: Optional[str] = None
    educational_score: Optional[int] = None
    quality_score: Optional[int] = None
    reading_level: Optional[float] = None
    grade_level: Optional[float] = None
    subject_confidence: Optional[int] = None
    detected_title: Optional[str] = None
    chunk_count: Optional[int] = None

class QuestionGenerationRequest(BaseModel):
    content: str
    question_count: int = 10
    difficulty_level: str = "medium"
    question_types: list = ["multiple_choice", "short_answer"]

# Health check endpoint
@app.get("/")
async def root():
    return {"message": "AI Education Service is running", "status": "healthy"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AI Education Service",
        "version": "1.0.0",
        "ready_for_gemini": False  # Will be True after Day 8
    }

# Content analysis endpoint (Day 7 implementation)
@app.post("/analyze-content", response_model=ContentAnalysisResponse)
async def analyze_content(request: ContentAnalysisRequest):
    try:
        result = await question_generator.analyze_content(
            request.file_content, 
            request.file_type
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content analysis failed: {str(e)}")

# Question generation endpoint (Day 8 implementation)
@app.post("/generate-questions")
async def generate_questions(request: QuestionGenerationRequest):
    try:
        # Day 8: Will implement with Gemini API
        return {
            "status": "pending",
            "message": "Question generation will be implemented on Day 8 with Gemini API",
            "request_received": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")

# Test endpoint for Next.js integration
@app.post("/test-connection")
async def test_connection(data: dict):
    return {
        "success": True,
        "message": "Connection successful",
        "received_data": data,
        "ai_service_status": "ready"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)