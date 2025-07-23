# apps/backend/ai/services/question_generator.py
from typing import Dict, List, Optional
import re
import json
import os
import google.generativeai as genai
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class QuestionGenerator:
    def __init__(self):
        """Initialize the Question Generator service"""
        # Day 7 functionality (keep working)
        self.supported_file_types = ['pdf', 'txt', 'docx']
        
        # Day 8 Gemini integration
        self.gemini_ready = False
        self._initialize_gemini()
        
        # Usage tracking
        self.daily_requests = 0
        self.max_daily_requests = int(os.getenv('MAX_DAILY_REQUESTS', 45))
        self.last_reset = datetime.now().date()
        
    def _initialize_gemini(self):
        """Initialize Gemini API (Day 8 addition)"""
        try:
            api_key = os.getenv('GEMINI_API_KEY')
            if api_key:
                genai.configure(api_key=api_key)
                self.model_name = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
                self.model = genai.GenerativeModel(self.model_name)
                self.gemini_ready = True
                self.use_free_tier = os.getenv('USE_FREE_TIER', 'true').lower() == 'true'
                logger.info(f"✅ Gemini initialized with {self.model_name}")
            else:
                logger.warning("⚠️ GEMINI_API_KEY not found. Question generation disabled.")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Gemini: {e}")
            self.gemini_ready = False
    
    async def analyze_content(self, content: str, file_type: str) -> Dict:
        """
        Day 7 functionality: Analyze uploaded content for suitability
        Enhanced for Day 8 with better detection
        """
        try:
            # Basic content analysis (no API calls)
            word_count = len(content.split())
            
            # Enhanced educational keywords for Day 8
            educational_keywords = [
                'chapter', 'lesson', 'topic', 'concept', 'definition',
                'example', 'theory', 'principle', 'method', 'process',
                'learn', 'study', 'understand', 'explain', 'analyze',
                'question', 'answer', 'problem', 'solution', 'exercise'
            ]
            
            educational_score = sum(1 for keyword in educational_keywords 
                                  if keyword.lower() in content.lower())
            
            # Determine language (basic check)
            language = "english"  # Default, can be enhanced later
            
            # Content type detection (Day 7 method)
            content_type = self._detect_content_type(content)
            
            # Day 8 enhancement: Better suitability check
            suitable_for_questions = (
                word_count > 100 and 
                educational_score > 0 and 
                self._has_substantive_content(content)
            )
            
            return {
                "success": True,
                "content_type": content_type,
                "word_count": word_count,
                "language": language,
                "suitable_for_questions": suitable_for_questions,
                "educational_score": educational_score,
                "gemini_available": self.gemini_ready,
                "message": f"Content analyzed successfully. {word_count} words found."
            }
            
        except Exception as e:
            return {
                "success": False,
                "content_type": "unknown",
                "word_count": 0,
                "language": "unknown",
                "suitable_for_questions": False,
                "gemini_available": self.gemini_ready,
                "message": f"Analysis failed: {str(e)}"
            }
    
    def _detect_content_type(self, content: str) -> str:
        """Day 7 method: Detect the type of educational content"""
        content_lower = content.lower()
        
        if any(word in content_lower for word in ['math', 'equation', 'formula', 'calculate', 'algebra', 'geometry']):
            return "mathematics"
        elif any(word in content_lower for word in ['history', 'war', 'century', 'empire', 'civilization']):
            return "history"
        elif any(word in content_lower for word in ['science', 'experiment', 'hypothesis', 'theory', 'research']):
            return "science"
        elif any(word in content_lower for word in ['language', 'grammar', 'literature', 'writing', 'reading']):
            return "language_arts"
        else:
            return "general_education"
    
    def _has_substantive_content(self, content: str) -> bool:
        """Day 8 enhancement: Check if content has enough substance for questions"""
        # Remove common filler words and check remaining content
        sentences = content.split('.')
        substantive_sentences = [s for s in sentences if len(s.split()) > 5]
        return len(substantive_sentences) >= 3
    
    def _reset_daily_counter_if_needed(self):
        """Day 8: Reset daily request counter at midnight"""
        today = datetime.now().date()
        if today > self.last_reset:
            self.daily_requests = 0
            self.last_reset = today
            logger.info("Daily request counter reset")
    
    async def generate_question_paper(self, content: str, question_count: int = 10, **kwargs) -> Dict:
        """
        Day 8: Generate question paper using Gemini AI
        Replaces the placeholder from Day 7
        """
        if not self.gemini_ready:
            return {
                "success": False,
                "message": "Gemini API not configured. Check GEMINI_API_KEY environment variable.",
                "questions": [],
                "marking_scheme": {},
                "suggestion": "Add GEMINI_API_KEY to enable AI question generation"
            }
        
        self._reset_daily_counter_if_needed()
        
        # Check free tier limits
        if self.use_free_tier and self.daily_requests >= self.max_daily_requests:
            return {
                "success": False,
                "error": "Daily free tier limit reached",
                "daily_requests": self.daily_requests,
                "max_daily_requests": self.max_daily_requests,
                "reset_time": "midnight UTC"
            }
        
        try:
            # Extract parameters
            difficulty_level = kwargs.get('difficulty_level', 'medium')
            question_types = kwargs.get('question_types', ['multiple_choice', 'short_answer'])
            subject = kwargs.get('subject', 'general')
            
            # Generate with Gemini
            start_time = datetime.now()
            prompt = self._create_question_prompt(content, question_count, difficulty_level, question_types, subject)
            response = await self._call_gemini_api(prompt)
            questions = self._parse_gemini_response(response.text, question_types)
            
            # Calculate generation time
            end_time = datetime.now()
            generation_time = f"{(end_time - start_time).total_seconds():.1f} seconds"
            
            # Track usage
            self.daily_requests += 1
            
            return {
                "success": True,
                "total_questions": len(questions),
                "questions": questions,
                "marking_scheme": self._generate_marking_scheme(questions),
                "generation_time": generation_time,
                "cost_estimate": "$0.00 (FREE TIER)" if self.use_free_tier else self._estimate_cost(content, question_count),
                "daily_requests": self.daily_requests,
                "requests_remaining": self.max_daily_requests - self.daily_requests,
                "model_used": self.model_name
            }
            
        except Exception as e:
            logger.error(f"Question generation failed: {str(e)}")
            return {
                "success": False,
                "error": f"Generation failed: {str(e)}",
                "daily_requests": self.daily_requests
            }
    
    def _create_question_prompt(self, content: str, count: int, difficulty: str, question_types: List[str], subject: str) -> str:
        """Day 8: Create optimized prompt for Gemini"""
        content_preview = content[:3000] if len(content) > 3000 else content
        
        type_instructions = []
        if "multiple_choice" in question_types:
            type_instructions.append("""
Multiple Choice Format:
Q1: [Question text]?
A) [Option 1]
B) [Option 2]
C) [Option 3]
D) [Option 4]
Correct: A
Explanation: [Brief explanation]
""")
        
        if "short_answer" in question_types:
            type_instructions.append("""
Short Answer Format:
Q1: [Question requiring 2-3 sentence answer]
Sample Answer: [Example response]
Points: 5
""")
        
        return f"""
You are an expert {subject} educator creating assessment questions.

CONTENT TO ANALYZE:
{content_preview}

REQUIREMENTS:
- Generate exactly {count} questions
- Difficulty level: {difficulty}
- Question types: {', '.join(question_types)}
- Questions must test understanding of the provided content
- Each question should be clear and educational

FORMAT REQUIREMENTS:
{''.join(type_instructions)}

Generate {count} high-quality questions now:
"""
    
    async def _call_gemini_api(self, prompt: str):
        """Day 8: Call Gemini API with rate limiting"""
        try:
            if self.use_free_tier:
                await asyncio.sleep(4)  # Rate limiting for free tier
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    top_p=0.8,
                    top_k=40,
                    max_output_tokens=2048,
                )
            )
            return response
        except Exception as e:
            raise Exception(f"Gemini API call failed: {str(e)}")
    
    def _parse_gemini_response(self, response_text: str, question_types: List[str]) -> List[Dict]:
        """Day 8: Parse Gemini response into structured questions"""
        questions = []
        lines = response_text.split('\n')
        current_question = {}
        question_counter = 1
        
        for line in lines:
            line = line.strip()
            
            if re.match(r'^Q\d+:', line) or line.startswith('**Question'):
                if current_question and 'question' in current_question:
                    questions.append(current_question)
                
                question_text = line.split(':', 1)[1].strip() if ':' in line else line
                question_text = question_text.replace('**', '').strip()
                
                current_question = {
                    "id": f"q{question_counter}",
                    "question": question_text,
                    "points": 2,
                    "difficulty": "medium",
                    "estimated_time": "3 minutes"
                }
                question_counter += 1
            
            elif re.match(r'^[A-D][\)\.]', line) or re.match(r'^\([a-d]\)', line):
                if 'options' not in current_question:
                    current_question['options'] = []
                    current_question['type'] = 'multiple_choice'
                current_question['options'].append(line)
            
            elif line.startswith('Correct:') or line.startswith('**Correct Answer:**'):
                answer_text = line.split(':', 1)[1].strip().replace('**', '')
                current_question['correct_answer'] = answer_text
            
            elif line.startswith('Explanation:') or line.startswith('**Explanation:**'):
                explanation_text = line.split(':', 1)[1].strip().replace('**', '')
                current_question['explanation'] = explanation_text
            
            elif line.startswith('Sample Answer:'):
                current_question['sample_answer'] = line.split(':', 1)[1].strip()
                current_question['type'] = 'short_answer'
                current_question['points'] = 5
        
        if current_question and 'question' in current_question:
            questions.append(current_question)
        
        for q in questions:
            if 'type' not in q:
                q['type'] = question_types[0] if question_types else 'multiple_choice'
        
        return questions
    
    async def create_marking_scheme(self, questions: List[Dict]) -> Dict:
        """Day 8: Create marking scheme for generated questions"""
        if not questions:
            return {
                "success": False,
                "message": "No questions provided for marking scheme",
                "scheme": {}
            }
        
        return {
            "success": True,
            "scheme": self._generate_marking_scheme(questions)
        }
    
    def _generate_marking_scheme(self, questions: List[Dict]) -> Dict:
        """Day 8: Generate marking scheme for questions"""
        total_points = sum(q.get('points', 2) for q in questions)
        
        total_time = 0
        for q in questions:
            if q.get('type') == 'multiple_choice':
                total_time += 2
            elif q.get('type') == 'short_answer':
                total_time += 5
            else:
                total_time += 3
        
        return {
            "total_points": total_points,
            "total_questions": len(questions),
            "time_limit_minutes": total_time,
            "question_breakdown": {
                "multiple_choice": len([q for q in questions if q.get('type') == 'multiple_choice']),
                "short_answer": len([q for q in questions if q.get('type') == 'short_answer']),
                "essay": len([q for q in questions if q.get('type') == 'essay'])
            },
            "grading_instructions": {
                "multiple_choice": "Award full points for correct answer",
                "short_answer": "Award partial credit for partially correct answers",
                "essay": "Use rubric to evaluate key points"
            }
        }
    
    def _estimate_cost(self, content: str, question_count: int) -> str:
        """Day 8: Estimate API cost for paid tier"""
        input_tokens = len(content.split()) * 1.3
        output_tokens = question_count * 50
        total_tokens = input_tokens + output_tokens
        cost = (total_tokens / 1000) * 0.0005
        return f"${cost:.2f}"
    
    def get_usage_stats(self) -> Dict:
        """Day 8: Get current usage statistics"""
        self._reset_daily_counter_if_needed()
        
        return {
            "daily_requests": self.daily_requests,
            "max_daily_requests": self.max_daily_requests,
            "requests_remaining": self.max_daily_requests - self.daily_requests,
            "tier": "free" if self.use_free_tier else "paid",
            "gemini_ready": self.gemini_ready,
            "model_used": self.model_name if self.gemini_ready else "none"
        }