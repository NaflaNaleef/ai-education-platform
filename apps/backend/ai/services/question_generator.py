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
                "marking_scheme": await self.create_marking_scheme(questions),
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
        """Day 8: Create marking scheme for generated questions using AI"""
        if not questions:
            return {
                "success": False,
                "message": "No questions provided for marking scheme",
                "scheme": {}
            }
        
        if not self.gemini_ready:
            logger.warning("⚠️ Gemini not available, using basic marking scheme")
            return {
                "success": True,
                "scheme": self._generate_basic_marking_scheme(questions)
            }
        
        try:
            logger.info(f"🤖 Generating AI-powered marking scheme for {len(questions)} questions")
            
            # Create AI prompt for marking scheme generation
            prompt = self._create_marking_scheme_prompt(questions)
            
            # Call Gemini API
            response = await self._call_gemini_api(prompt)
            
            # Parse AI response
            ai_marking_scheme = self._parse_marking_scheme_response(response.text, questions)
            
            # Combine AI-generated scheme with basic structure
            final_scheme = self._combine_marking_schemes(ai_marking_scheme, questions)
            
            logger.info("✅ AI marking scheme generated successfully")
            
            return {
                "success": True,
                "scheme": final_scheme
            }
            
        except Exception as e:
            logger.error(f"❌ AI marking scheme generation failed: {str(e)}")
            logger.info("🔄 Falling back to basic marking scheme")
            return {
                "success": True,
                "scheme": self._generate_basic_marking_scheme(questions)
            }
    
    def _create_marking_scheme_prompt(self, questions: List[Dict]) -> str:
        """Create AI prompt for marking scheme generation"""
        prompt = f"""
You are an expert educator creating a detailed marking scheme for {len(questions)} questions. 

For each question, provide:
1. Specific grading criteria
2. Key points/keywords that should be included
3. Point allocation breakdown
4. Feedback templates
5. Partial credit guidelines

Questions to analyze:
"""
        
        for i, question in enumerate(questions, 1):
            prompt += f"""
Question {i}:
- Type: {question.get('type', 'multiple_choice')}
- Points: {question.get('points', 2)}
- Question: {question.get('question', '')}
- Correct Answer: {question.get('correct_answer', '')}
- Explanation: {question.get('explanation', '')}
"""
        
        prompt += """

Please respond in this exact JSON format:
{
  "total_points": <total>,
  "total_questions": <count>,
  "time_limit_minutes": <estimated_time>,
  "question_breakdown": {
    "multiple_choice": <count>,
    "short_answer": <count>,
    "essay": <count>
  },
  "grading_instructions": {
    "multiple_choice": "<instruction>",
    "short_answer": "<instruction>",
    "essay": "<instruction>"
  },
  "criteria": [
    {
      "question_id": "<id>",
      "question_number": <number>,
      "type": "<type>",
      "points": <points>,
      "correct_answer": "<answer>",
      "explanation": "<explanation>",
      "grading_method": "<exact_match|keyword_match|ai_enhanced>",
      "keywords": ["<keyword1>", "<keyword2>", ...],
      "feedback_template": "<template>",
      "partial_credit_rules": {
        "exact_match": <boolean>,
        "case_sensitive": <boolean>,
        "allow_partial": <boolean>,
        "min_keywords": <number>,
        "keyword_weight": <number>
      },
      "ai_grading_prompt": "<specific prompt for AI grading>"
    }
  ],
  "version": "2.0",
  "ai_generated": true
}

Focus on creating fair, consistent, and educational grading criteria.
"""
        return prompt
    
    def _parse_marking_scheme_response(self, response_text: str, questions: List[Dict]) -> Dict:
        """Parse AI-generated marking scheme response"""
        try:
            # Extract JSON from response
            import re
            import json
            
            # Find JSON block in response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                raise ValueError("No JSON found in AI response")
            
            json_str = json_match.group()
            ai_scheme = json.loads(json_str)
            
            # Validate and clean the AI response
            cleaned_scheme = self._validate_and_clean_ai_scheme(ai_scheme, questions)
            
            return cleaned_scheme
            
        except Exception as e:
            logger.error(f"Failed to parse AI marking scheme: {e}")
            raise ValueError(f"Invalid AI marking scheme format: {str(e)}")
    
    def _validate_and_clean_ai_scheme(self, ai_scheme: Dict, questions: List[Dict]) -> Dict:
        """Validate and clean AI-generated marking scheme"""
        # Ensure required fields exist
        if 'criteria' not in ai_scheme:
            ai_scheme['criteria'] = []
        
        if 'total_points' not in ai_scheme:
            ai_scheme['total_points'] = sum(q.get('points', 2) for q in questions)
        
        if 'total_questions' not in ai_scheme:
            ai_scheme['total_questions'] = len(questions)
        
        # Clean and validate criteria
        cleaned_criteria = []
        for i, question in enumerate(questions):
            question_id = question.get('id', f'q{i+1}')
            
            # Find matching AI criteria
            ai_criteria = None
            for criteria in ai_scheme.get('criteria', []):
                if criteria.get('question_id') == question_id or criteria.get('question_number') == i + 1:
                    ai_criteria = criteria
                    break
            
            if ai_criteria:
                # Clean and validate the criteria
                cleaned_criteria.append({
                    'question_id': question_id,
                    'question_number': i + 1,
                    'type': question.get('type', 'multiple_choice'),
                    'points': question.get('points', 2),
                    'correct_answer': question.get('correct_answer', ''),
                    'explanation': question.get('explanation', ''),
                    'grading_method': ai_criteria.get('grading_method', 'keyword_match'),
                    'keywords': ai_criteria.get('keywords', self._extract_keywords(question.get('correct_answer', ''))),
                    'feedback_template': ai_criteria.get('feedback_template', self._generate_feedback_template(question)),
                    'partial_credit_rules': {
                        'exact_match': ai_criteria.get('partial_credit_rules', {}).get('exact_match', question.get('type') == 'multiple_choice'),
                        'case_sensitive': ai_criteria.get('partial_credit_rules', {}).get('case_sensitive', False),
                        'allow_partial': ai_criteria.get('partial_credit_rules', {}).get('allow_partial', question.get('type') != 'multiple_choice'),
                        'min_keywords': ai_criteria.get('partial_credit_rules', {}).get('min_keywords', max(1, len(ai_criteria.get('keywords', [])) // 2)),
                        'keyword_weight': ai_criteria.get('partial_credit_rules', {}).get('keyword_weight', 1.0)
                    },
                    'ai_grading_prompt': ai_criteria.get('ai_grading_prompt', self._generate_ai_grading_prompt(question))
                })
            else:
                # Create default criteria if AI didn't provide one
                cleaned_criteria.append(self._create_default_criteria(question, i + 1))
        
        ai_scheme['criteria'] = cleaned_criteria
        ai_scheme['generated_at'] = datetime.now().isoformat()
        
        return ai_scheme
    
    def _create_default_criteria(self, question: Dict, question_number: int) -> Dict:
        """Create default criteria for a question"""
        return {
            'question_id': question.get('id', f'q{question_number}'),
            'question_number': question_number,
            'type': question.get('type', 'multiple_choice'),
            'points': question.get('points', 2),
            'correct_answer': question.get('correct_answer', ''),
            'explanation': question.get('explanation', ''),
            'grading_method': self._determine_grading_method(question),
            'keywords': self._extract_keywords(question.get('correct_answer', '')),
            'feedback_template': self._generate_feedback_template(question),
            'partial_credit_rules': {
                'exact_match': question.get('type') == 'multiple_choice',
                'case_sensitive': False,
                'allow_partial': question.get('type') != 'multiple_choice',
                'min_keywords': max(1, len(self._extract_keywords(question.get('correct_answer', ''))) // 2),
                'keyword_weight': 1.0
            },
            'ai_grading_prompt': self._generate_ai_grading_prompt(question)
        }
    
    def _generate_ai_grading_prompt(self, question: Dict) -> str:
        """Generate specific AI grading prompt for a question"""
        question_type = question.get('type', 'multiple_choice')
        question_text = question.get('question', '')
        correct_answer = question.get('correct_answer', '')
        explanation = question.get('explanation', '')
        points = question.get('points', 2)
        
        if question_type == 'multiple_choice':
            return f"""
Grade this multiple choice answer:
Question: {question_text}
Correct Answer: {correct_answer}
Student Answer: {{student_answer}}
Points Possible: {points}

Award full points for exact match (case-insensitive).
Award 0 points for incorrect answer.
"""
        elif question_type == 'short_answer':
            return f"""
Grade this short answer:
Question: {question_text}
Correct Answer: {correct_answer}
Explanation: {explanation}
Student Answer: {{student_answer}}
Points Possible: {points}

Key points to look for: {', '.join(self._extract_keywords(correct_answer))}

Award partial credit for including key concepts.
Award full points for complete and accurate answer.
"""
        else:  # essay
            return f"""
Grade this essay answer:
Question: {question_text}
Correct Answer: {correct_answer}
Explanation: {explanation}
Student Answer: {{student_answer}}
Points Possible: {points}

Key concepts to evaluate: {', '.join(self._extract_keywords(correct_answer))}

Consider:
- Understanding of key concepts
- Clarity of explanation
- Completeness of answer
- Accuracy of information
"""
    
    def _combine_marking_schemes(self, ai_scheme: Dict, questions: List[Dict]) -> Dict:
        """Combine AI scheme with basic structure"""
        # Calculate time limit
        total_time = 0
        for q in questions:
            if q.get('type') == 'multiple_choice':
                total_time += 2
            elif q.get('type') == 'short_answer':
                total_time += 5
            else:
                total_time += 3
        
        # Ensure basic structure exists
        if 'time_limit_minutes' not in ai_scheme:
            ai_scheme['time_limit_minutes'] = total_time
        
        if 'question_breakdown' not in ai_scheme:
            ai_scheme['question_breakdown'] = {
                "multiple_choice": len([q for q in questions if q.get('type') == 'multiple_choice']),
                "short_answer": len([q for q in questions if q.get('type') == 'short_answer']),
                "essay": len([q for q in questions if q.get('type') == 'essay'])
            }
        
        if 'grading_instructions' not in ai_scheme:
            ai_scheme['grading_instructions'] = {
                "multiple_choice": "Award full points for correct answer",
                "short_answer": "Award partial credit for partially correct answers",
                "essay": "Use rubric to evaluate key points"
            }
        
        return ai_scheme
    
    def _generate_basic_marking_scheme(self, questions: List[Dict]) -> Dict:
        """Generate basic marking scheme when AI is not available"""
        total_points = sum(q.get('points', 2) for q in questions)
        
        total_time = 0
        for q in questions:
            if q.get('type') == 'multiple_choice':
                total_time += 2
            elif q.get('type') == 'short_answer':
                total_time += 5
            else:
                total_time += 3
        
        # Generate basic criteria for each question
        criteria = []
        for i, question in enumerate(questions):
            question_criteria = {
                'question_id': question.get('id', f'q{i+1}'),
                'question_number': i + 1,
                'type': question.get('type', 'multiple_choice'),
                'points': question.get('points', 2),
                'correct_answer': question.get('correct_answer', ''),
                'explanation': question.get('explanation', ''),
                'grading_method': self._determine_grading_method(question),
                'keywords': self._extract_keywords(question.get('correct_answer', '')),
                'feedback_template': self._generate_feedback_template(question),
                'partial_credit_rules': {
                    'exact_match': question.get('type') == 'multiple_choice',
                    'case_sensitive': False,
                    'allow_partial': question.get('type') != 'multiple_choice',
                    'min_keywords': max(1, len(self._extract_keywords(question.get('correct_answer', ''))) // 2),
                    'keyword_weight': 1.0
                },
                'ai_grading_prompt': self._generate_ai_grading_prompt(question)
            }
            criteria.append(question_criteria)
        
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
            },
            "criteria": criteria,
            "version": "2.0",
            "ai_generated": False,
            "generated_at": datetime.now().isoformat()
        }
    
    def _determine_grading_method(self, question: Dict) -> str:
        """Determine the best grading method for a question"""
        question_type = question.get('type', 'multiple_choice')
        correct_answer = question.get('correct_answer', '')
        
        if question_type == 'multiple_choice':
            return 'exact_match'
        elif question_type == 'short_answer':
            if len(correct_answer.split()) <= 3:
                return 'exact_match'
            else:
                return 'keyword_match'
        elif question_type == 'essay':
            return 'keyword_match'
        else:
            return 'keyword_match'
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract important keywords from text for grading"""
        if not text:
            return []
        
        # Remove common words and punctuation
        import re
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Filter out common words
        common_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
        }
        
        keywords = [word for word in words if word not in common_words and len(word) > 2]
        
        # Return unique keywords, limited to 10
        return list(set(keywords))[:10]
    
    def _generate_feedback_template(self, question: Dict) -> str:
        """Generate a feedback template for a question"""
        question_type = question.get('type', 'multiple_choice')
        
        if question_type == 'multiple_choice':
            return "Correct answer: {correct_answer}. {explanation}"
        elif question_type == 'short_answer':
            return "Key points to include: {keywords}. {explanation}"
        elif question_type == 'essay':
            return "Consider these aspects: {keywords}. {explanation}"
        else:
            return "Review the key concepts: {keywords}. {explanation}"
    
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