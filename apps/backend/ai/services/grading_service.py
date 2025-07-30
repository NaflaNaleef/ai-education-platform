# apps/backend/ai/services/grading_service.py
from typing import Dict, List, Optional
import json
import os
import google.generativeai as genai
import asyncio
from datetime import datetime
import logging
import re

logger = logging.getLogger(__name__)

class GradingService:
    def __init__(self):
        """Initialize the AI Grading Service"""
        # Initialize Gemini API (reuse same setup as question_generator.py)
        self.gemini_ready = False
        self._initialize_gemini()
        
        # Grading configuration
        self.max_feedback_length = 500
        self.grading_temperature = 0.3  # Lower temperature for more consistent grading
        
    def _initialize_gemini(self):
        """Initialize Gemini API for grading"""
        try:
            api_key = os.getenv('GEMINI_API_KEY')
            if api_key:
                genai.configure(api_key=api_key)
                self.model_name = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
                self.model = genai.GenerativeModel(self.model_name)
                self.gemini_ready = True
                self.use_free_tier = os.getenv('USE_FREE_TIER', 'true').lower() == 'true'
                logger.info(f"✅ Grading Service initialized with {self.model_name}")
            else:
                logger.warning("⚠️ GEMINI_API_KEY not found. Auto-grading disabled.")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Gemini for grading: {e}")
            self.gemini_ready = False

    async def grade_submission(self, submission_data: Dict) -> Dict:
        """
        Grade student submission using AI
        
        Args:
            submission_data: {
                'questions': List[Dict],  # Question paper questions with correct answers
                'student_answers': List[Dict],  # Student's submitted answers
                'submission_id': str,
                'question_paper_id': str,
                'student_id': str
            }
        
        Returns:
            Dict with grading results
        """
        if not self.gemini_ready:
            return {
                "success": False,
                "error": "Auto-grading not available - Gemini API not configured",
                "total_score": 0,
                "max_possible_score": 0,
                "detailed_feedback": []
            }

        try:
            logger.info(f"🤖 Starting AI grading for submission {submission_data.get('submission_id')}")
            
            questions = submission_data.get('questions', [])
            student_answers = submission_data.get('student_answers', [])
            
            if not questions or not student_answers:
                return {
                    "success": False,
                    "error": "Missing questions or student answers",
                    "total_score": 0,
                    "max_possible_score": 0,
                    "detailed_feedback": []
                }

            start_time = datetime.now()
            
            # Grade each question individually
            question_grades = []
            total_score = 0
            max_possible_score = 0
            
            # Create a map of student answers by question_id for quick lookup
            answer_map = {ans.get('question_id'): ans for ans in student_answers}
            
            for question in questions:
                question_id = question.get('id')
                question_points = question.get('points', question.get('marks', 2))
                max_possible_score += question_points
                
                # Get student's answer for this question
                student_answer = answer_map.get(question_id, {}).get('answer', '')
                
                if not student_answer.strip():
                    # No answer provided
                    question_grades.append({
                        "question_id": question_id,
                        "question_number": question.get('number', len(question_grades) + 1),
                        "question_text": question.get('question', ''),
                        "student_answer": '',
                        "points_possible": question_points,
                        "points_awarded": 0,
                        "feedback": "No answer provided",
                        "correct_answer": question.get('correct_answer', ''),
                        "grade_percentage": 0
                    })
                    continue
                
                # Grade this individual question
                question_grade = await self._grade_individual_question(
                    question, student_answer, question_points
                )
                
                question_grades.append(question_grade)
                total_score += question_grade['points_awarded']
                
                # Add small delay to avoid rate limiting
                if self.use_free_tier:
                    await asyncio.sleep(1)

            # Calculate overall statistics
            percentage = (total_score / max_possible_score * 100) if max_possible_score > 0 else 0
            letter_grade = self._calculate_letter_grade(percentage)
            
            # Generate overall feedback
            overall_feedback = await self._generate_overall_feedback(
                question_grades, percentage, total_score, max_possible_score
            )
            
            end_time = datetime.now()
            grading_time = f"{(end_time - start_time).total_seconds():.1f} seconds"
            
            logger.info(f"✅ Grading complete: {total_score}/{max_possible_score} ({percentage:.1f}%) in {grading_time}")
            
            return {
                "success": True,
                "total_score": total_score,
                "max_possible_score": max_possible_score,
                "percentage": round(percentage, 1),
                "grade": letter_grade,
                "detailed_feedback": question_grades,
                "overall_feedback": overall_feedback,
                "grading_time": grading_time,
                "questions_graded": len(question_grades),
                "model_used": self.model_name,
                "graded_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"💥 Grading failed: {str(e)}")
            return {
                "success": False,
                "error": f"Grading failed: {str(e)}",
                "total_score": 0,
                "max_possible_score": 0,
                "detailed_feedback": []
            }

    async def grade_submission_with_scheme(self, submission_data: Dict) -> Dict:
        """
        Grade student submission using AI with marking scheme
        
        Args:
            submission_data: {
                'questions': List[Dict],  # Question paper questions with correct answers
                'student_answers': List[Dict],  # Student's submitted answers
                'submission_id': str,
                'question_paper_id': str,
                'student_id': str,
                'marking_scheme': Dict  # Previously generated marking scheme
            }
        
        Returns:
            Dict with grading results
        """
        if not self.gemini_ready:
            return {
                "success": False,
                "error": "Auto-grading not available - Gemini API not configured",
                "total_score": 0,
                "max_possible_score": 0,
                "detailed_feedback": []
            }

        try:
            logger.info(f"🤖 Starting AI grading with marking scheme for submission {submission_data.get('submission_id')}")
            
            questions = submission_data.get('questions', [])
            student_answers = submission_data.get('student_answers', [])
            marking_scheme = submission_data.get('marking_scheme', {})
            
            if not questions or not student_answers:
                return {
                    "success": False,
                    "error": "Missing questions or student answers",
                    "total_score": 0,
                    "max_possible_score": 0,
                    "detailed_feedback": []
                }

            if not marking_scheme:
                logger.warning("⚠️ No marking scheme provided, falling back to direct AI grading")
                return await self.grade_submission(submission_data)

            start_time = datetime.now()
            
            # Grade each question individually using marking scheme
            question_grades = []
            total_score = 0
            max_possible_score = marking_scheme.get('total_points', 0)
            
            # Create a map of student answers by question_id for quick lookup
            answer_map = {ans.get('question_id'): ans for ans in student_answers}
            
            for question in questions:
                question_id = question.get('id')
                question_points = question.get('points', question.get('marks', 2))
                
                # Get student's answer for this question
                student_answer = answer_map.get(question_id, {}).get('answer', '')
                
                if not student_answer.strip():
                    # No answer provided
                    question_grades.append({
                        "question_id": question_id,
                        "question_number": question.get('number', len(question_grades) + 1),
                        "question_text": question.get('question', ''),
                        "student_answer": '',
                        "points_possible": question_points,
                        "points_awarded": 0,
                        "feedback": "No answer provided",
                        "correct_answer": question.get('correct_answer', ''),
                        "grade_percentage": 0
                    })
                    continue
                
                # Grade this individual question using marking scheme
                question_grade = await self._grade_individual_question_with_scheme(
                    question, student_answer, question_points, marking_scheme
                )
                
                question_grades.append(question_grade)
                total_score += question_grade['points_awarded']
                
                # Add small delay to avoid rate limiting
                if self.use_free_tier:
                    await asyncio.sleep(1)

            # Calculate overall statistics
            percentage = (total_score / max_possible_score * 100) if max_possible_score > 0 else 0
            letter_grade = self._calculate_letter_grade(percentage)
            
            # Generate overall feedback using marking scheme context
            overall_feedback = await self._generate_overall_feedback_with_scheme(
                question_grades, percentage, total_score, max_possible_score, marking_scheme
            )
            
            end_time = datetime.now()
            grading_time = f"{(end_time - start_time).total_seconds():.1f} seconds"
            
            logger.info(f"✅ Marking scheme grading complete: {total_score}/{max_possible_score} ({percentage:.1f}%) in {grading_time}")
            
            return {
                "success": True,
                "total_score": total_score,
                "max_possible_score": max_possible_score,
                "percentage": round(percentage, 1),
                "grade": letter_grade,
                "detailed_feedback": question_grades,
                "overall_feedback": overall_feedback,
                "grading_time": grading_time,
                "questions_graded": len(question_grades),
                "model_used": self.model_name,
                "graded_at": datetime.now().isoformat(),
                "marking_scheme_used": True
            }
            
        except Exception as e:
            logger.error(f"💥 Marking scheme grading failed: {str(e)}")
            return {
                "success": False,
                "error": f"Marking scheme grading failed: {str(e)}",
                "total_score": 0,
                "max_possible_score": 0,
                "detailed_feedback": []
            }

    async def _grade_individual_question(self, question: Dict, student_answer: str, points_possible: int) -> Dict:
        """Grade a single question using AI"""
        try:
            question_type = question.get('type', 'short_answer')
            question_text = question.get('question', '')
            correct_answer = question.get('correct_answer', '')
            explanation = question.get('explanation', '')
            
            if question_type == 'multiple_choice':
                # For multiple choice, exact matching with some flexibility
                return await self._grade_multiple_choice(
                    question, student_answer, points_possible
                )
            else:
                # For short answer, essay, etc. - use AI grading
                return await self._grade_open_ended(
                    question, student_answer, points_possible
                )
                
        except Exception as e:
            logger.error(f"Error grading individual question: {e}")
            return {
                "question_id": question.get('id'),
                "question_number": question.get('number', 1),
                "question_text": question_text,
                "student_answer": student_answer,
                "points_possible": points_possible,
                "points_awarded": 0,
                "feedback": f"Grading error: {str(e)}",
                "correct_answer": correct_answer,
                "grade_percentage": 0
            }

    async def _grade_individual_question_with_scheme(self, question: Dict, student_answer: str, points_possible: int, marking_scheme: Dict) -> Dict:
        """Grade a single question using AI-generated marking scheme"""
        question_id = question.get('id')
        question_text = question.get('question', '')
        correct_answer = question.get('correct_answer', '')
        explanation = question.get('explanation', '')

        # Find the marking criteria for this specific question
        marking_criteria = None
        for criteria in marking_scheme.get('criteria', []):
            if criteria.get('question_id') == question_id:
                marking_criteria = criteria
                break

        if not marking_criteria:
            logger.warning(f"No marking criteria found for question {question_id}. Falling back to direct AI grading.")
            return await self._grade_open_ended(question, student_answer, points_possible)

        # Extract criteria details
        grading_method = marking_criteria.get('grading_method', 'keyword_match')
        partial_credit_rules = marking_criteria.get('partial_credit_rules', {})
        ai_grading_prompt = marking_criteria.get('ai_grading_prompt', '')

        # Grade based on the specified method
        if grading_method == 'exact_match':
            return await self._grade_with_exact_match(question, student_answer, points_possible, marking_criteria)
        elif grading_method == 'keyword_match':
            return await self._grade_with_keyword_match(question, student_answer, points_possible, marking_criteria)
        elif grading_method == 'ai_enhanced':
            return await self._grade_with_ai_enhanced(question, student_answer, points_possible, marking_criteria, ai_grading_prompt)
        else:
            # Default to AI-enhanced grading
            return await self._grade_with_ai_enhanced(question, student_answer, points_possible, marking_criteria, ai_grading_prompt)

    async def _grade_with_exact_match(self, question: Dict, student_answer: str, points_possible: int, criteria: Dict) -> Dict:
        """Grade using exact match criteria"""
        question_id = question.get('id')
        question_text = question.get('question', '')
        correct_answer = question.get('correct_answer', '')
        
        partial_credit_rules = criteria.get('partial_credit_rules', {})
        case_sensitive = partial_credit_rules.get('case_sensitive', False)
        
        # Normalize answers for comparison
        if case_sensitive:
            student_normalized = student_answer.strip()
            correct_normalized = correct_answer.strip()
        else:
            student_normalized = student_answer.strip().upper()
            correct_normalized = correct_answer.strip().upper()
        
        # Check for exact match
        is_correct = student_normalized == correct_normalized
        
        # Also check for letter-only match (A, B, C, D)
        if not is_correct and len(correct_normalized) == 1 and len(student_normalized) == 1:
            is_correct = student_normalized == correct_normalized
        
        points_awarded = points_possible if is_correct else 0
        feedback = criteria.get('feedback_template', 'Correct answer.' if is_correct else f'Incorrect. The correct answer is {correct_answer}.')
        
        return {
            "question_id": question_id,
            "question_number": question.get('number', 1),
            "question_text": question_text,
            "student_answer": student_answer,
            "points_possible": points_possible,
            "points_awarded": points_awarded,
            "feedback": feedback,
            "correct_answer": correct_answer,
            "grade_percentage": (points_awarded / points_possible * 100) if points_possible > 0 else 0,
            "grading_method": "exact_match"
        }

    async def _grade_with_keyword_match(self, question: Dict, student_answer: str, points_possible: int, criteria: Dict) -> Dict:
        """Grade using keyword match criteria"""
        question_id = question.get('id')
        question_text = question.get('question', '')
        correct_answer = question.get('correct_answer', '')
        
        keywords = criteria.get('keywords', [])
        partial_credit_rules = criteria.get('partial_credit_rules', {})
        min_keywords = partial_credit_rules.get('min_keywords', max(1, len(keywords) // 2))
        keyword_weight = partial_credit_rules.get('keyword_weight', 1.0)
        
        if not keywords:
            logger.warning(f"No keywords found for question {question_id}. Falling back to AI grading.")
            return await self._grade_open_ended(question, student_answer, points_possible)
        
        # Count keyword matches
        student_answer_lower = student_answer.lower()
        matches = sum(1 for keyword in keywords if keyword.lower() in student_answer_lower)
        
        # Calculate points based on keyword matches
        if matches >= len(keywords):
            points_awarded = points_possible
            feedback = criteria.get('feedback_template', 'Excellent answer! All key points covered.')
        elif matches >= min_keywords:
            partial_score = (matches / len(keywords)) * points_possible * keyword_weight
            points_awarded = min(points_possible, partial_score)
            feedback = criteria.get('feedback_template', f'Good answer with {matches}/{len(keywords)} key points. Consider including: {", ".join([k for k in keywords if k.lower() not in student_answer_lower])}')
        else:
            points_awarded = 0
            feedback = criteria.get('feedback_template', f'Answer missing key points. Consider including: {", ".join(keywords)}')
        
        return {
            "question_id": question_id,
            "question_number": question.get('number', 1),
            "question_text": question_text,
            "student_answer": student_answer,
            "points_possible": points_possible,
            "points_awarded": points_awarded,
            "feedback": feedback,
            "correct_answer": correct_answer,
            "grade_percentage": (points_awarded / points_possible * 100) if points_possible > 0 else 0,
            "grading_method": "keyword_match",
            "keywords_matched": matches,
            "total_keywords": len(keywords)
        }

    async def _grade_with_ai_enhanced(self, question: Dict, student_answer: str, points_possible: int, criteria: Dict, ai_prompt: str) -> Dict:
        """Grade using AI-enhanced criteria with custom prompt"""
        question_id = question.get('id')
        question_text = question.get('question', '')
        correct_answer = question.get('correct_answer', '')
        
        if not self.gemini_ready:
            logger.warning(f"AI not available for enhanced grading of question {question_id}. Using keyword match fallback.")
            return await self._grade_with_keyword_match(question, student_answer, points_possible, criteria)
        
        try:
            # Use the custom AI grading prompt from the marking scheme
            if ai_prompt:
                # Replace placeholder with actual student answer
                prompt = ai_prompt.replace('{student_answer}', student_answer)
            else:
                # Fallback to default prompt
                prompt = self._create_grading_prompt(question_text, student_answer, correct_answer, question.get('explanation', ''), points_possible)
            
            # Call Gemini API for grading
            response = await self._call_gemini_for_grading(prompt)
            grading_result = self._parse_grading_response(response.text, points_possible)
            
            return {
                "question_id": question_id,
                "question_number": question.get('number', 1),
                "question_text": question_text,
                "student_answer": student_answer,
                "points_possible": points_possible,
                "points_awarded": grading_result['points'],
                "feedback": grading_result['feedback'],
                "correct_answer": correct_answer,
                "grade_percentage": (grading_result['points'] / points_possible * 100) if points_possible > 0 else 0,
                "grading_method": "ai_enhanced"
            }
            
        except Exception as e:
            logger.error(f"AI-enhanced grading failed for question {question_id}: {e}")
            # Fallback to keyword matching
            return await self._grade_with_keyword_match(question, student_answer, points_possible, criteria)

    async def _grade_multiple_choice(self, question: Dict, student_answer: str, points_possible: int) -> Dict:
        """Grade multiple choice question with exact matching"""
        question_id = question.get('id')
        question_text = question.get('question', '')
        correct_answer = question.get('correct_answer', '').strip()
        student_answer_clean = student_answer.strip()
        
        # Normalize answers for comparison
        correct_normalized = re.sub(r'^[A-D][\)\.]?\s*', '', correct_answer.upper()).strip()
        student_normalized = re.sub(r'^[A-D][\)\.]?\s*', '', student_answer_clean.upper()).strip()
        
        # Check for exact match or normalized match
        is_correct = (
            student_answer_clean.upper() == correct_answer.upper() or
            student_normalized == correct_normalized or
            student_answer_clean.upper().startswith(correct_answer.upper()[:1])  # Match by letter only
        )
        
        points_awarded = points_possible if is_correct else 0
        feedback = "Correct!" if is_correct else f"Incorrect. The correct answer is {correct_answer}."
        
        return {
            "question_id": question_id,
            "question_number": question.get('number', 1),
            "question_text": question_text,
            "student_answer": student_answer,
            "points_possible": points_possible,
            "points_awarded": points_awarded,
            "feedback": feedback,
            "correct_answer": correct_answer,
            "grade_percentage": (points_awarded / points_possible * 100) if points_possible > 0 else 0
        }

    async def _grade_open_ended(self, question: Dict, student_answer: str, points_possible: int) -> Dict:
        """Grade open-ended question using AI"""
        question_id = question.get('id')
        question_text = question.get('question', '')
        correct_answer = question.get('correct_answer', '')
        explanation = question.get('explanation', '')
        
        # Create grading prompt
        prompt = self._create_grading_prompt(
            question_text, student_answer, correct_answer, explanation, points_possible
        )
        
        try:
            # Call Gemini API for grading
            response = await self._call_gemini_for_grading(prompt)
            grading_result = self._parse_grading_response(response.text, points_possible)
            
            return {
                "question_id": question_id,
                "question_number": question.get('number', 1),
                "question_text": question_text,
                "student_answer": student_answer,
                "points_possible": points_possible,
                "points_awarded": grading_result['points'],
                "feedback": grading_result['feedback'],
                "correct_answer": correct_answer,
                "grade_percentage": (grading_result['points'] / points_possible * 100) if points_possible > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"AI grading failed for question {question_id}: {e}")
            # Fallback to basic grading
            return await self._fallback_grading(question, student_answer, points_possible)

    def _create_grading_prompt(self, question: str, student_answer: str, correct_answer: str, explanation: str, max_points: int) -> str:
        """Create prompt for AI grading"""
        return f"""
You are an expert educator grading a student's answer. Please evaluate the response fairly and provide constructive feedback.

QUESTION:
{question}

CORRECT/SAMPLE ANSWER:
{correct_answer}

{f"EXPLANATION: {explanation}" if explanation else ""}

STUDENT'S ANSWER:
{student_answer}

GRADING CRITERIA:
- Maximum points possible: {max_points}
- Award full points for completely correct answers
- Award partial credit for partially correct answers
- Award 0 points for completely incorrect or irrelevant answers
- Consider key concepts, accuracy, and understanding

Please respond in this exact format:
POINTS: [number between 0 and {max_points}]
FEEDBACK: [Constructive feedback explaining the grade, highlighting what was correct/incorrect, max 200 words]

Example:
POINTS: 3
FEEDBACK: Good understanding of the main concept. You correctly identified X and Y, but missed Z. Consider reviewing the relationship between A and B for a complete answer.
"""

    async def _call_gemini_for_grading(self, prompt: str):
        """Call Gemini API for grading"""
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=self.grading_temperature,  # Lower temperature for consistent grading
                    top_p=0.8,
                    top_k=40,
                    max_output_tokens=300,  # Shorter responses for grading
                )
            )
            return response
        except Exception as e:
            raise Exception(f"Gemini API call failed: {str(e)}")

    def _parse_grading_response(self, response_text: str, max_points: int) -> Dict:
        """Parse AI grading response"""
        try:
            lines = response_text.strip().split('\n')
            points = 0
            feedback = "No feedback provided"
            
            for line in lines:
                line = line.strip()
                if line.startswith('POINTS:'):
                    points_str = line.split(':', 1)[1].strip()
                    try:
                        points = float(points_str)
                        # Ensure points are within valid range
                        points = max(0, min(points, max_points))
                    except ValueError:
                        points = 0
                elif line.startswith('FEEDBACK:'):
                    feedback = line.split(':', 1)[1].strip()
                    # Limit feedback length
                    if len(feedback) > self.max_feedback_length:
                        feedback = feedback[:self.max_feedback_length] + "..."
            
            return {
                "points": points,
                "feedback": feedback
            }
            
        except Exception as e:
            logger.error(f"Failed to parse grading response: {e}")
            return {
                "points": 0,
                "feedback": f"Grading parse error: {str(e)}"
            }

    async def _fallback_grading(self, question: Dict, student_answer: str, points_possible: int) -> Dict:
        """Fallback grading when AI fails"""
        # Simple keyword-based grading as fallback
        correct_answer = question.get('correct_answer', '').lower()
        student_answer_lower = student_answer.lower()
        
        # Basic keyword matching
        if correct_answer and len(correct_answer) > 3:
            # Give partial credit for keyword matches
            keywords = correct_answer.split()
            matches = sum(1 for keyword in keywords if keyword in student_answer_lower)
            if matches > 0:
                partial_score = min(points_possible, (matches / len(keywords)) * points_possible)
                return {
                    "question_id": question.get('id'),
                    "question_number": question.get('number', 1),
                    "question_text": question.get('question', ''),
                    "student_answer": student_answer,
                    "points_possible": points_possible,
                    "points_awarded": partial_score,
                    "feedback": f"Partial credit awarded based on keyword matching. AI grading temporarily unavailable.",
                    "correct_answer": question.get('correct_answer', ''),
                    "grade_percentage": (partial_score / points_possible * 100) if points_possible > 0 else 0
                }
        
        return {
            "question_id": question.get('id'),
            "question_number": question.get('number', 1),
            "question_text": question.get('question', ''),
            "student_answer": student_answer,
            "points_possible": points_possible,
            "points_awarded": 0,
            "feedback": "Unable to grade automatically. Manual review required.",
            "correct_answer": question.get('correct_answer', ''),
            "grade_percentage": 0
        }

    async def _generate_overall_feedback(self, question_grades: List[Dict], percentage: float, total_score: float, max_score: float) -> str:
        """Generate overall feedback for the submission"""
        try:
            if not self.gemini_ready:
                return f"Score: {total_score}/{max_score} ({percentage:.1f}%). Good effort! Review the individual question feedback for specific improvements."
            
            # Create summary for AI
            summary = f"""
Student scored {total_score} out of {max_score} points ({percentage:.1f}%).

Question Performance:
"""
            for grade in question_grades:
                summary += f"- Q{grade['question_number']}: {grade['points_awarded']}/{grade['points_possible']} points\n"
            
            prompt = f"""
Based on this student's quiz performance, provide encouraging overall feedback in 2-3 sentences:

{summary}

Focus on:
- Acknowledging their effort
- Highlighting strengths
- Suggesting areas for improvement
- Being encouraging and constructive

Keep response under 150 words and be supportive.
"""
            
            response = await self._call_gemini_for_grading(prompt)
            feedback = response.text.strip()
            
            # Ensure reasonable length
            if len(feedback) > 300:
                feedback = feedback[:300] + "..."
                
            return feedback
            
        except Exception as e:
            logger.error(f"Failed to generate overall feedback: {e}")
            return f"Score: {total_score}/{max_score} ({percentage:.1f}%). Keep up the good work and review the feedback for each question!"

    async def _generate_overall_feedback_with_scheme(self, question_grades: List[Dict], percentage: float, total_score: float, max_score: float, marking_scheme: Dict) -> str:
        """Generate overall feedback for the submission using a marking scheme context"""
        try:
            if not self.gemini_ready:
                return f"Score: {total_score}/{max_score} ({percentage:.1f}%). Good effort! Review the individual question feedback for specific improvements."
            
            # Create summary for AI
            summary = f"""
Student scored {total_score} out of {max_score} points ({percentage:.1f}%).

Question Performance:
"""
            for grade in question_grades:
                summary += f"- Q{grade['question_number']}: {grade['points_awarded']}/{grade['points_possible']} points\n"
            
            prompt = f"""
Based on this student's quiz performance and the marking scheme, provide encouraging overall feedback in 2-3 sentences:

{summary}

Focus on:
- Acknowledging their effort
- Highlighting strengths
- Suggesting areas for improvement
- Being encouraging and constructive

Keep response under 150 words and be supportive.
"""
            
            response = await self._call_gemini_for_grading(prompt)
            feedback = response.text.strip()
            
            # Ensure reasonable length
            if len(feedback) > 300:
                feedback = feedback[:300] + "..."
                
            return feedback
            
        except Exception as e:
            logger.error(f"Failed to generate overall feedback with marking scheme: {e}")
            return f"Score: {total_score}/{max_score} ({percentage:.1f}%). Keep up the good work and review the feedback for each question!"

    def _calculate_letter_grade(self, percentage: float) -> str:
        """Calculate letter grade from percentage"""
        if percentage >= 97:
            return "A+"
        elif percentage >= 93:
            return "A"
        elif percentage >= 90:
            return "A-"
        elif percentage >= 87:
            return "B+"
        elif percentage >= 83:
            return "B"
        elif percentage >= 80:
            return "B-"
        elif percentage >= 77:
            return "C+"
        elif percentage >= 73:
            return "C"
        elif percentage >= 70:
            return "C-"
        elif percentage >= 67:
            return "D+"
        elif percentage >= 65:
            return "D"
        else:
            return "F"

    async def provide_feedback(self, question: str, student_answer: str, correct_answer: str) -> Dict:
        """
        Provide detailed feedback for individual answers
        """
        if not self.gemini_ready:
            return {
                "success": False,
                "error": "Feedback generation not available - Gemini API not configured",
                "feedback": "",
                "score": 0
            }

        try:
            prompt = f"""
Provide constructive feedback for this student answer:

QUESTION: {question}
STUDENT ANSWER: {student_answer}
CORRECT ANSWER: {correct_answer}

Please provide specific, helpful feedback focusing on:
1. What the student got right
2. What they missed or got wrong
3. How they can improve

Keep feedback encouraging and educational, under 200 words.
"""
            
            response = await self._call_gemini_for_grading(prompt)
            feedback = response.text.strip()
            
            return {
                "success": True,
                "feedback": feedback,
                "score": 1  # Placeholder scoring
            }
            
        except Exception as e:
            logger.error(f"Feedback generation failed: {str(e)}")
            return {
                "success": False,
                "error": f"Feedback generation failed: {str(e)}",
                "feedback": "",
                "score": 0
            }

    def get_grading_stats(self) -> Dict:
        """Get grading service statistics"""
        return {
            "grading_service_ready": self.gemini_ready,
            "model_used": self.model_name if self.gemini_ready else None,
            "free_tier": self.use_free_tier if self.gemini_ready else None,
            "features": {
                "multiple_choice_grading": True,
                "open_ended_grading": self.gemini_ready,
                "detailed_feedback": self.gemini_ready,
                "overall_feedback": self.gemini_ready,
                "letter_grades": True
            }
        }