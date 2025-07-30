# apps/backend/ai/main.py - COMPLETELY FIXED VERSION
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import enhanced services
try:
    from services.question_generator import QuestionGenerator
    from services.grading_service import GradingService
    logger.info("✅ Services imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import services: {e}")
    raise

# Initialize FastAPI app
app = FastAPI(
    title="AI Education Service",
    description="Enhanced AI microservice for content analysis, question generation, and auto-grading",
    version="2.1.0"
)

# CORS middleware for Next.js integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://your-domain.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
try:
    question_generator = QuestionGenerator()
    grading_service = GradingService()
    logger.info("✅ AI services initialized successfully")
    logger.info(f"Gemini ready: {question_generator.gemini_ready}")
    logger.info(f"Grading service ready: {grading_service.gemini_ready}")   
except Exception as e:
    logger.error(f"❌ Failed to initialize services: {e}")
    question_generator = None
    grading_service = None

# Pydantic models
class ContentAnalysisRequest(BaseModel):
    file_content: str
    file_type: str
    resource_id: str

class QuestionGenerationRequest(BaseModel):
    content: str
    question_count: int = 10
    difficulty_level: str = "medium"
    question_types: List[str] = ["multiple_choice", "short_answer"]
    subject: str = "general"

class MarkingSchemeRequest(BaseModel):
    questions: List[dict]

class GradeSubmissionRequest(BaseModel):
    questions: List[dict]
    student_answers: List[dict]
    submission_id: str
    question_paper_id: str
    student_id: str

class GradeSubmissionWithSchemeRequest(BaseModel):
    questions: List[dict]
    student_answers: List[dict]
    submission_id: str
    question_paper_id: str
    student_id: str
    marking_scheme: dict

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "AI Education Service is running",
        "status": "healthy",
        "version": "2.1.0",
        "features": {
            "content_analysis": True,
            "question_generation": question_generator.gemini_ready if question_generator else False,
            "auto_grading": grading_service.gemini_ready if grading_service else False,
            "usage_tracking": True,
            "marking_schemes": question_generator.gemini_ready if question_generator else False
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Enhanced health check with service status"""
    if not question_generator:
        return {
            "status": "unhealthy",
            "service": "AI Education Service",
            "version": "2.1.0",
            "error": "Question generator not initialized"
        }
    
    return {
        "status": "healthy",
        "service": "AI Education Service", 
        "version": "2.1.0",
        "gemini_ai": "available" if question_generator.gemini_ready else "unavailable",
        "model": question_generator.model_name if question_generator.gemini_ready else "unavailable",
        "grading_model": grading_service.model_name if grading_service and grading_service.gemini_ready else "unavailable",
        "ready_for_questions": question_generator.gemini_ready,
        "ready_for_grading": grading_service.gemini_ready if grading_service else False,
        "supported_features": {
            "content_analysis": True,
            "question_generation": question_generator.gemini_ready,
            "auto_grading": grading_service.gemini_ready if grading_service else False,
            "marking_schemes": question_generator.gemini_ready,
            "usage_tracking": True
        }
    }

# Content analysis endpoint
@app.post("/analyze-content")
async def analyze_content(request: ContentAnalysisRequest):
    """Enhanced content analysis"""
    if not question_generator:
        raise HTTPException(status_code=503, detail="Question generator service unavailable")
    try:
        logger.info(f"Analyzing content for resource {request.resource_id}")
        result = await question_generator.analyze_content(
            request.file_content,
            request.file_type
        )
        if result["success"]:
            logger.info(f"Analysis successful: {result['content_type']}, {result['word_count']} words")
        else:
            logger.warning(f"Analysis failed: {result['message']}")
        
        return result
        
    except Exception as e:
        logger.error(f"Content analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Content analysis failed: {str(e)}")

# Question generation endpoint
@app.post("/generate-questions")
async def generate_questions(request: QuestionGenerationRequest):
    """Generate questions using Gemini AI"""
    if not question_generator:
        raise HTTPException(status_code=503, detail="Question generator service unavailable")
    if not question_generator.gemini_ready:
        return {
            "success": False,
            "error": "Gemini AI not available. Check GEMINI_API_KEY configuration."
        }
    try:
        logger.info(f"Generating {request.question_count} questions for {request.subject}")
        result = await question_generator.generate_question_paper(
            content=request.content,
            question_count=request.question_count,
            difficulty_level=request.difficulty_level,
            question_types=request.question_types,
            subject=request.subject
        )
        if result.get("success"):
            logger.info(f"Generated {result['total_questions']} questions in {result['generation_time']}")
        else:
            logger.warning(f"Question generation failed: {result.get('error', 'Unknown error')}")
        
        # Handle error field standardization
        if not result.get("success") and "message" in result and "error" not in result:
            result["error"] = result["message"]
        
        return result
        
    except Exception as e:
        logger.error(f"Question generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")

# Marking scheme generation endpoint
@app.post("/generate-marking-scheme")
async def generate_marking_scheme(request: MarkingSchemeRequest):
    """Generate marking scheme for provided questions"""
    if not question_generator:
        raise HTTPException(status_code=503, detail="Question generator service unavailable")
    
    try:
        logger.info(f"Generating marking scheme for {len(request.questions)} questions")
        result = await question_generator.create_marking_scheme(request.questions)
        
        if result["success"]:
            logger.info("Marking scheme generated successfully")
        else:
            logger.warning(f"Marking scheme generation failed: {result.get('message', 'Unknown error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"Marking scheme generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Marking scheme generation failed: {str(e)}")

# FIXED: Grade submission endpoint
@app.post("/grade-submission")
async def grade_submission(request: GradeSubmissionRequest):
    """Grade student submission using AI"""
    if not grading_service:
        raise HTTPException(status_code=503, detail="Grading service unavailable")
    
    if not grading_service.gemini_ready:
        return {
            "success": False,
            "error": "Auto-grading not available. Gemini AI not configured."
        }
    
    try:
        logger.info(f"Grading submission {request.submission_id} for student {request.student_id}")
        
        grading_data = {
            "questions": request.questions,
            "student_answers": request.student_answers,
            "submission_id": request.submission_id,
            "question_paper_id": request.question_paper_id,
            "student_id": request.student_id
        }
        
        result = await grading_service.grade_submission(grading_data)
        
        if result.get("success"):
            logger.info(f"Grading successful: {result['total_score']}/{result['max_possible_score']} ({result['percentage']}%)")
        else:
            logger.warning(f"Grading failed: {result.get('error', 'Unknown error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"Grading submission failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(e)}")

# NEW: Grade submission with marking scheme endpoint
@app.post("/grade-submission-with-scheme")
async def grade_submission_with_scheme(request: GradeSubmissionWithSchemeRequest):
    """Grade student submission using AI with marking scheme"""
    if not grading_service:
        raise HTTPException(status_code=503, detail="Grading service unavailable")
    
    if not grading_service.gemini_ready:
        return {
            "success": False,
            "error": "Auto-grading not available. Gemini AI not configured."
        }
    
    try:
        logger.info(f"Grading submission {request.submission_id} with marking scheme for student {request.student_id}")
        
        grading_data = {
            "questions": request.questions,
            "student_answers": request.student_answers,
            "submission_id": request.submission_id,
            "question_paper_id": request.question_paper_id,
            "student_id": request.student_id,
            "marking_scheme": request.marking_scheme
        }
        
        result = await grading_service.grade_submission_with_scheme(grading_data)
        
        if result.get("success"):
            logger.info(f"Marking scheme grading successful: {result['total_score']}/{result['max_possible_score']} ({result['percentage']}%)")
        else:
            logger.warning(f"Marking scheme grading failed: {result.get('error', 'Unknown error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"Marking scheme grading failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Marking scheme grading failed: {str(e)}")

# FIXED: Grading service health check endpoint
@app.get("/grading-status")
async def get_grading_status():
    """Get grading service status and capabilities"""
    if not grading_service:
        return {
            "grading_available": False,
            "error": "Grading service not initialized"
        }
    
    try:
        stats = grading_service.get_grading_stats()
        return {
            "grading_available": stats["grading_service_ready"],
            "model_used": stats.get("model_used"),
            "features": stats.get("features", {}),
            "free_tier": stats.get("free_tier"),
            "status": "healthy" if stats["grading_service_ready"] else "unavailable"
        }
        
    except Exception as e:
        logger.error(f"Failed to get grading status: {str(e)}")
        return {
            "grading_available": False,
            "error": f"Status check failed: {str(e)}"
        }

# Usage statistics endpoint
@app.get("/ai-usage")
async def get_ai_usage():
    """Get current AI usage statistics"""
    if not question_generator:
        raise HTTPException(status_code=503, detail="Question generator service unavailable")
    
    try:
        stats = question_generator.get_usage_stats()
        logger.info(f"Usage stats requested: {stats['requests_remaining']} remaining")
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get usage stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get usage stats: {str(e)}")

# Test endpoint for Next.js integration
@app.post("/test-connection")
async def test_connection(data: dict):
    """Enhanced test endpoint with service status"""
    return {
        "success": True,
        "message": "Connection successful",
        "received_data": data,
        "ai_service_status": "ready",
        "timestamp": "2025-01-23T10:00:00Z",
        "service_info": {
            "version": "2.1.0",
            "gemini_available": question_generator.gemini_ready if question_generator else False,
            "grading_available": grading_service.gemini_ready if grading_service else False,
            "features_enabled": [
                "content_analysis",
                "question_generation" if question_generator and question_generator.gemini_ready else None,
                "auto_grading" if grading_service and grading_service.gemini_ready else None,
                "usage_tracking"
            ]
        }
    }

# Batch processing endpoint
@app.post("/batch-analyze")
async def batch_analyze_content(requests: List[ContentAnalysisRequest]):
    """Analyze multiple content pieces in batch"""
    if not question_generator:
        raise HTTPException(status_code=503, detail="Question generator service unavailable")
    
    if len(requests) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 requests per batch")
    
    results = []
    for req in requests:
        try:
            result = await question_generator.analyze_content(req.file_content, req.file_type)
            results.append({"resource_id": req.resource_id, "analysis": result})
        except Exception as e:
            results.append({"resource_id": req.resource_id, "error": str(e)})
    
    return {"batch_results": results, "processed_count": len(results)}

# Service information endpoint
@app.get("/service-info")
async def get_service_info():
    """Get detailed service information"""
    return {
        "service_name": "AI Education Service",
        "version": "2.1.0",
        "description": "Complete AI service with content analysis, question generation, and auto-grading",
        "capabilities": {
            "content_analysis": {
                "enabled": True,
                "supported_formats": ["pdf", "txt", "docx"],
                "features": ["content_type_detection", "educational_scoring", "suitability_assessment"]
            },
            "question_generation": {
                "enabled": question_generator.gemini_ready if question_generator else False,
                "model": getattr(question_generator, 'model_name', None) if question_generator else None,
                "question_types": ["multiple_choice", "short_answer", "essay"],
                "difficulty_levels": ["easy", "medium", "hard"]
            },
            "auto_grading": {
                "enabled": grading_service.gemini_ready if grading_service else False,
                "model": getattr(grading_service, 'model_name', None) if grading_service else None,
                "supported_types": ["multiple_choice", "short_answer", "essay"],
                "features": ["detailed_feedback", "letter_grades", "partial_credit"]
            },
            "usage_tracking": {
                "enabled": True,
                "free_tier_limit": 50,
                "rate_limiting": True
            }
        },
        "endpoints": [
            "/health", "/analyze-content", "/generate-questions", 
            "/generate-marking-scheme", "/grade-submission", "/grading-status",
            "/ai-usage", "/test-connection", "/batch-analyze"
        ]
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {
        "error": "Endpoint not found",
        "message": "The requested endpoint does not exist",
        "available_endpoints": [
            "/health", "/analyze-content", "/generate-questions",
            "/generate-marking-scheme", "/grade-submission", "/grading-status",
            "/ai-usage", "/test-connection", "/service-info", "/batch-analyze"
        ]
    }

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Internal server error: {exc}")
    return {
        "error": "Internal server error",
        "message": "An unexpected error occurred. Please try again.",
        "status": "error"
    }

# Startup/shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 AI Education Service starting up...")
    logger.info(f"Question generation ready: {question_generator.gemini_ready if question_generator else False}")
    logger.info(f"Auto-grading ready: {grading_service.gemini_ready if grading_service else False}")
    
    if question_generator and question_generator.gemini_ready:
        usage = question_generator.get_usage_stats()
        logger.info(f"Usage remaining: {usage['requests_remaining']}/{usage['max_daily_requests']}")
    
    if grading_service and grading_service.gemini_ready:
        grading_stats = grading_service.get_grading_stats()
        logger.info(f"Grading features: {grading_stats.get('features', {})}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 AI Education Service shutting down...")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)