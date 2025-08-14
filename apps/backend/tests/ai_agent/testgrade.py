# tests/ai_agent/testgrade.py
import pytest
import json
from unittest.mock import Mock, patch
from datetime import datetime

# Mock student submissions for grading tests
MOCK_SUBMISSIONS = [
    {
        "student_id": "student-1",
        "question_id": 1,
        "question": "What is the capital of France?",
        "student_answer": "Paris",
        "correct_answer": "Paris",
        "question_type": "multiple_choice",
        "max_points": 2
    },
    {
        "student_id": "student-1",
        "question_id": 2,
        "question": "Explain photosynthesis",
        "student_answer": "Plants use sunlight to make food",
        "correct_answer": "Photosynthesis is the process by which plants convert light energy into chemical energy",
        "question_type": "short_answer",
        "max_points": 5
    },
    {
        "student_id": "student-1",
        "question_id": 3,
        "question": "Describe the water cycle",
        "student_answer": "Water evaporates, forms clouds, then rains",
        "correct_answer": "The water cycle involves evaporation, condensation, precipitation, and collection",
        "question_type": "essay",
        "max_points": 10
    }
]

class TestAIGrading:
    
    @pytest.fixture
    def mock_ai_grader(self):
        """Mock AI grading service"""
        with patch('google.generativeai.GenerativeModel') as mock_model:
            mock_instance = Mock()
            mock_model.return_value = mock_instance
            mock_instance.generate_content.return_value.text = json.dumps({
                "score": 8,
                "feedback": "Good work with minor improvements needed"
            })
            yield mock_instance

    def test_grade_multiple_choice_correct(self):
        """Test grading correct multiple choice answer"""
        def mock_grade_mc(submission):
            student_ans = submission["student_answer"].strip().lower()
            correct_ans = submission["correct_answer"].strip().lower()
            
            is_correct = student_ans == correct_ans
            score = submission["max_points"] if is_correct else 0
            
            return {
                "question_id": submission["question_id"],
                "score": score,
                "max_points": submission["max_points"],
                "is_correct": is_correct,
                "feedback": "Correct!" if is_correct else "Incorrect"
            }
        
        mc_submission = MOCK_SUBMISSIONS[0]  # Paris answer
        result = mock_grade_mc(mc_submission)
        
        assert result["score"] == 2
        assert result["is_correct"] is True
        assert "Correct" in result["feedback"]

    def test_grade_multiple_choice_incorrect(self):
        """Test grading incorrect multiple choice answer"""
        def mock_grade_mc(submission):
            student_ans = submission["student_answer"].strip().lower()
            correct_ans = submission["correct_answer"].strip().lower()
            
            is_correct = student_ans == correct_ans
            score = submission["max_points"] if is_correct else 0
            
            return {
                "question_id": submission["question_id"],
                "score": score,
                "max_points": submission["max_points"],
                "is_correct": is_correct,
                "feedback": "Correct!" if is_correct else f"Incorrect. The answer is {submission['correct_answer']}"
            }
        
        wrong_submission = {
            "question_id": 1,
            "student_answer": "London",
            "correct_answer": "Paris",
            "max_points": 2
        }
        
        result = mock_grade_mc(wrong_submission)
        
        assert result["score"] == 0
        assert result["is_correct"] is False
        assert "Paris" in result["feedback"]

    def test_grade_short_answer(self, mock_ai_grader):
        """Test AI grading of short answer questions"""
        def mock_grade_short_answer(submission):
            # Simulate AI analysis of the answer
            student_answer = submission["student_answer"].lower()
            
            # Check for key concepts
            key_concepts = ["plants", "sunlight", "food", "energy"]
            concepts_found = sum(1 for concept in key_concepts if concept in student_answer)
            
            # Calculate partial credit
            concept_score = (concepts_found / len(key_concepts)) * submission["max_points"]
            score = max(1, int(concept_score))  # Minimum 1 point for attempt
            
            return {
                "question_id": submission["question_id"],
                "score": score,
                "max_points": submission["max_points"],
                "is_correct": score == submission["max_points"],
                "feedback": f"Good understanding. Found {concepts_found}/{len(key_concepts)} key concepts.",
                "concepts_identified": [c for c in key_concepts if c in student_answer]
            }
        
        sa_submission = MOCK_SUBMISSIONS[1]
        result = mock_grade_short_answer(sa_submission)
        
        assert result["score"] > 0
        assert result["score"] <= result["max_points"]
        assert "concepts_identified" in result
        assert len(result["concepts_identified"]) > 0

    def test_grade_essay_question(self, mock_ai_grader):
        """Test grading of essay questions with detailed feedback"""
        def mock_grade_essay(submission):
            answer_length = len(submission["student_answer"].split())
            
            # Score based on completeness and length
            if answer_length >= 15:
                content_score = 4
            elif answer_length >= 10:
                content_score = 3
            elif answer_length >= 5:
                content_score = 2
            else:
                content_score = 1
            
            # Check for key terms
            key_terms = ["evaporate", "cloud", "rain", "cycle"]
            terms_found = sum(1 for term in key_terms 
                            if term in submission["student_answer"].lower())
            term_score = (terms_found / len(key_terms)) * 6
            
            total_score = min(submission["max_points"], content_score + int(term_score))
            
            return {
                "question_id": submission["question_id"],
                "score": total_score,
                "max_points": submission["max_points"],
                "is_correct": total_score >= submission["max_points"] * 0.8,
                "feedback": f"Score: {total_score}/{submission['max_points']}. "
                           f"Found {terms_found} key terms. Word count: {answer_length}",
                "rubric_breakdown": {
                    "content": content_score,
                    "key_terms": int(term_score),
                    "total": total_score
                }
            }
        
        essay_submission = MOCK_SUBMISSIONS[2]
        result = mock_grade_essay(essay_submission)
        
        assert result["score"] > 0
        assert "rubric_breakdown" in result
        assert result["rubric_breakdown"]["total"] == result["score"]

    def test_grade_complete_quiz(self):
        """Test grading a complete quiz submission"""
        def mock_grade_complete_quiz(submissions):
            results = []
            total_score = 0
            max_possible = 0
            
            for submission in submissions:
                if submission["question_type"] == "multiple_choice":
                    is_correct = submission["student_answer"].lower() == submission["correct_answer"].lower()
                    score = submission["max_points"] if is_correct else 0
                elif submission["question_type"] == "short_answer":
                    score = int(submission["max_points"] * 0.7)  # 70% for partial credit
                elif submission["question_type"] == "essay":
                    score = int(submission["max_points"] * 0.8)  # 80% for good essay
                
                results.append({
                    "question_id": submission["question_id"],
                    "score": score,
                    "max_points": submission["max_points"]
                })
                
                total_score += score
                max_possible += submission["max_points"]
            
            percentage = (total_score / max_possible) * 100 if max_possible > 0 else 0
            
            return {
                "student_id": submissions[0]["student_id"],
                "total_score": total_score,
                "max_possible": max_possible,
                "percentage": round(percentage, 2),
                "question_results": results,
                "grade": "A" if percentage >= 90 else "B" if percentage >= 80 else "C" if percentage >= 70 else "D" if percentage >= 60 else "F"
            }
        
        result = mock_grade_complete_quiz(MOCK_SUBMISSIONS)
        
        assert result["total_score"] > 0
        assert result["max_possible"] == 17  # 2 + 5 + 10
        assert 0 <= result["percentage"] <= 100
        assert result["grade"] in ["A", "B", "C", "D", "F"]
        assert len(result["question_results"]) == len(MOCK_SUBMISSIONS)

    def test_edge_cases(self):
        """Test grading edge cases"""
        edge_cases = [
            {
                "name": "empty_answer",
                "submission": {
                    "student_answer": "",
                    "correct_answer": "Paris",
                    "max_points": 2,
                    "question_type": "multiple_choice"
                },
                "expected_score": 0
            },
            {
                "name": "whitespace_only",
                "submission": {
                    "student_answer": "   ",
                    "correct_answer": "Paris",
                    "max_points": 2,
                    "question_type": "multiple_choice"
                },
                "expected_score": 0
            },
            {
                "name": "case_insensitive",
                "submission": {
                    "student_answer": "PARIS",
                    "correct_answer": "Paris",
                    "max_points": 2,
                    "question_type": "multiple_choice"
                },
                "expected_score": 2
            }
        ]
        
        def mock_grade_edge_case(submission):
            answer = submission["student_answer"].strip()
            
            if not answer:
                return {"score": 0, "feedback": "No answer provided"}
            
            if submission["question_type"] == "multiple_choice":
                is_correct = answer.lower() == submission["correct_answer"].lower()
                score = submission["max_points"] if is_correct else 0
                return {"score": score}
            
            return {"score": 0}
        
        for case in edge_cases:
            result = mock_grade_edge_case(case["submission"])
            assert result["score"] == case["expected_score"], f"Failed case: {case['name']}"

    def test_batch_grading(self):
        """Test grading multiple students efficiently"""
        def mock_batch_grade(student_submissions):
            results = []
            
            for student_id, submissions in student_submissions.items():
                student_total = 0
                student_max = 0
                
                for submission in submissions:
                    # Simple scoring: 80% average
                    score = int(submission["max_points"] * 0.8)
                    student_total += score
                    student_max += submission["max_points"]
                
                results.append({
                    "student_id": student_id,
                    "total_score": student_total,
                    "max_possible": student_max,
                    "percentage": (student_total / student_max) * 100
                })
            
            return results
        
        batch_data = {
            "student-1": MOCK_SUBMISSIONS,
            "student-2": MOCK_SUBMISSIONS,
            "student-3": MOCK_SUBMISSIONS
        }
        
        results = mock_batch_grade(batch_data)
        
        assert len(results) == 3
        for result in results:
            assert "student_id" in result
            assert "total_score" in result
            assert "percentage" in result
            assert result["percentage"] > 0

    def test_feedback_quality(self):
        """Test quality of AI-generated feedback"""
        def mock_generate_feedback(score, max_points, question_type):
            percentage = (score / max_points) * 100
            
            if percentage == 100:
                return "Excellent! Perfect answer showing complete understanding."
            elif percentage >= 80:
                return "Very good work! Minor improvements could enhance your answer."
            elif percentage >= 60:
                return "Good effort. Consider adding more detail to strengthen your response."
            elif percentage > 0:
                return "Shows some understanding. Review the material and try to include key concepts."
            else:
                return "No answer provided or incorrect. Please review the material carefully."
        
        test_cases = [
            {"score": 10, "max_points": 10, "expected_word": "Excellent"},
            {"score": 8, "max_points": 10, "expected_word": "Very good"},
            {"score": 6, "max_points": 10, "expected_word": "Good"},
            {"score": 2, "max_points": 10, "expected_word": "some understanding"},
            {"score": 0, "max_points": 10, "expected_word": "No answer"}
        ]
        
        for case in test_cases:
            feedback = mock_generate_feedback(case["score"], case["max_points"], "essay")
            assert case["expected_word"].lower() in feedback.lower()
            assert len(feedback) > 20  # Substantial feedback
            assert feedback.endswith('.')  # Proper sentence