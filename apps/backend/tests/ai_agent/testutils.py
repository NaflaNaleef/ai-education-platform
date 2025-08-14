# tests/ai_agent/testutils.py
import pytest
import re
from unittest.mock import Mock, patch

class TestAIUtilities:
    """Test utility functions used in AI processing"""
    
    def test_text_preprocessing(self):
        """Test text cleaning and preprocessing functions"""
        def mock_clean_text(text):
            # Remove special characters but keep punctuation (fixed regex)
            text = re.sub(r'[^a-zA-Z0-9\s\.\,\?\!\-]', '', text)
            # Remove extra whitespace (this handles double spaces after character removal)
            text = re.sub(r'\s+', ' ', text)
            # Strip and convert to proper case
            return text.strip()
        
        test_cases = [
            {
                "input": "  This   has    extra   spaces  ",
                "expected": "This has extra spaces"
            },
            {
                "input": "Text with @#$%^& special chars!",
                "expected": "Text with special chars!"
            },
            {
                "input": "Normal sentence with proper punctuation.",
                "expected": "Normal sentence with proper punctuation."
            },
            {
                "input": "Mixed\n\nlines\twith\ttabs",
                "expected": "Mixed lines with tabs"
            }
        ]
        
        for case in test_cases:
            result = mock_clean_text(case["input"])
            assert result == case["expected"], f"Failed for input: '{case['input']}'. Expected: '{case['expected']}', Got: '{result}'"

    def test_content_extraction(self):
        """Test extracting key information from educational content"""
        def mock_extract_key_info(text):
            # Simple keyword extraction
            science_keywords = ['photosynthesis', 'biology', 'plants', 'atoms', 'molecules']
            math_keywords = ['algebra', 'geometry', 'equation', 'fraction', 'variable']
            history_keywords = ['war', 'civilization', 'empire', 'revolution', 'century']
            
            text_lower = text.lower()
            found_keywords = []
            subject = "general"
            
            # Check for science keywords
            science_found = [kw for kw in science_keywords if kw in text_lower]
            if science_found:
                found_keywords.extend(science_found)
                subject = "science"
            
            # Check for math keywords
            math_found = [kw for kw in math_keywords if kw in text_lower]
            if math_found:
                found_keywords.extend(math_found)
                if subject == "general":
                    subject = "mathematics"
            
            # Check for history keywords
            history_found = [kw for kw in history_keywords if kw in text_lower]
            if history_found:
                found_keywords.extend(history_found)
                if subject == "general":
                    subject = "history"
            
            return {
                "keywords": found_keywords,
                "subject": subject,
                "word_count": len(text.split()),
                "sentence_count": len([s for s in text.split('.') if s.strip()]),
                "complexity": len(found_keywords) / max(len(text.split()), 1)
            }
        
        test_content = """
        Photosynthesis is a biological process where plants convert sunlight into energy.
        This process involves complex molecules and atoms working together.
        """
        
        result = mock_extract_key_info(test_content)
        
        assert "photosynthesis" in result["keywords"]
        assert result["subject"] == "science"
        assert result["word_count"] > 0
        assert result["sentence_count"] > 0
        assert 0 <= result["complexity"] <= 1

    def test_difficulty_assessment(self):
        """Test automatic difficulty level assessment"""
        def mock_assess_difficulty(content, grade_level=None):
            words = content.split()
            word_count = len(words)
            
            # Count complex words (more than 7 characters)
            complex_words = len([w for w in words if len(w) > 7])
            complex_ratio = complex_words / word_count if word_count > 0 else 0
            
            # Count sentences
            sentences = len([s for s in content.split('.') if s.strip()])
            avg_sentence_length = word_count / max(sentences, 1)
            
            # Calculate difficulty score
            difficulty_score = 0
            difficulty_score += min(complex_ratio * 2, 1.0) * 0.4  # Vocabulary complexity
            difficulty_score += min(avg_sentence_length / 15, 1.0) * 0.3  # Sentence length
            difficulty_score += min(word_count / 200, 1.0) * 0.3  # Content length
            
            # Determine difficulty level
            if difficulty_score < 0.3:
                level = "easy"
            elif difficulty_score < 0.7:
                level = "medium"
            else:
                level = "hard"
            
            return {
                "difficulty_level": level,
                "difficulty_score": round(difficulty_score, 2),
                "word_count": word_count,
                "complex_words": complex_words,
                "avg_sentence_length": round(avg_sentence_length, 1),
                "recommendation": f"Suitable for {level} level questions"
            }
        
        test_cases = [
            {
                "content": "The cat sat on the mat. It was happy.",
                "expected_level": "easy"
            },
            {
                "content": "Photosynthesis involves the transformation of carbon dioxide and water into glucose through chlorophyll-mediated reactions.",
                "expected_level": "medium"
            },
            {
                "content": "The implementation of sophisticated algorithms requires comprehensive understanding of computational complexity theory and mathematical optimization techniques.",
                "expected_level": "hard"
            }
        ]
        
        for case in test_cases:
            result = mock_assess_difficulty(case["content"])
            assert result["difficulty_level"] == case["expected_level"]
            assert "difficulty_score" in result
            assert result["word_count"] > 0

    def test_question_validation(self):
        """Test validation of generated questions"""
        def mock_validate_question(question):
            errors = []
            warnings = []
            
            # Required fields check
            required_fields = ["question", "type", "correct_answer", "points"]
            for field in required_fields:
                if field not in question or not str(question[field]).strip():
                    errors.append(f"Missing required field: {field}")
            
            # Question text validation
            if "question" in question:
                q_text = str(question["question"]).strip()
                if len(q_text) < 10:
                    errors.append("Question text too short (minimum 10 characters)")
                if not q_text.endswith('?'):
                    warnings.append("Question should end with a question mark")
            
            # Points validation
            if "points" in question:
                try:
                    points = float(question["points"])
                    if points <= 0:
                        errors.append("Points must be positive")
                    elif points > 50:
                        warnings.append("High point value (over 50 points)")
                except (ValueError, TypeError):
                    errors.append("Points must be a number")
            
            # Type-specific validation
            if question.get("type") == "multiple_choice":
                if "options" not in question:
                    errors.append("Multiple choice questions require options")
                elif len(question["options"]) < 2:
                    errors.append("Multiple choice needs at least 2 options")
                elif question.get("correct_answer") not in question.get("options", []):
                    errors.append("Correct answer must be one of the options")
            
            return {
                "is_valid": len(errors) == 0,
                "errors": errors,
                "warnings": warnings,
                "score": max(0, 100 - len(errors) * 25 - len(warnings) * 10)
            }
        
        # Test valid question
        valid_question = {
            "question": "What is the capital of France?",
            "type": "multiple_choice",
            "options": ["London", "Berlin", "Paris", "Madrid"],
            "correct_answer": "Paris",
            "points": 2
        }
        
        valid_result = mock_validate_question(valid_question)
        assert valid_result["is_valid"] is True
        assert len(valid_result["errors"]) == 0
        assert valid_result["score"] >= 90
        
        # Test invalid question
        invalid_question = {
            "question": "Bad?",  # Too short
            "type": "multiple_choice",
            "options": ["A"],  # Not enough options
            "correct_answer": "B",  # Not in options
            "points": -1  # Invalid points
        }
        
        invalid_result = mock_validate_question(invalid_question)
        assert invalid_result["is_valid"] is False
        assert len(invalid_result["errors"]) > 0

    def test_content_optimization(self):
        """Test content optimization for AI processing"""
        def mock_optimize_content(content, max_length=1000):
            words = content.split()
            
            if len(words) <= max_length:
                return {
                    "optimized_content": content,
                    "was_truncated": False,
                    "original_length": len(words),
                    "final_length": len(words)
                }
            
            # Keep important parts: beginning and end
            keep_start = int(max_length * 0.4)
            keep_end = int(max_length * 0.4)
            summary_space = max_length - keep_start - keep_end
            
            start_words = words[:keep_start]
            end_words = words[-keep_end:]
            summary = ["[... content summarized ...]"] * min(summary_space, 5)
            
            optimized_words = start_words + summary + end_words
            optimized_content = " ".join(optimized_words)
            
            return {
                "optimized_content": optimized_content,
                "was_truncated": True,
                "original_length": len(words),
                "final_length": len(optimized_words),
                "compression_ratio": len(optimized_words) / len(words)
            }
        
        # Test short content (no optimization needed)
        short_content = "This is a short piece of content for testing."
        short_result = mock_optimize_content(short_content, max_length=100)
        
        assert short_result["was_truncated"] is False
        assert short_result["original_length"] == short_result["final_length"]
        
        # Test long content (optimization needed)
        long_content = " ".join(["word"] * 2000)
        long_result = mock_optimize_content(long_content, max_length=500)
        
        assert long_result["was_truncated"] is True
        assert long_result["final_length"] < long_result["original_length"]
        assert long_result["compression_ratio"] < 1.0

    def test_performance_metrics(self):
        """Test performance tracking utilities"""
        def mock_track_performance(operation_name, duration, tokens_used=0):
            # Simple performance categorization
            if duration < 1.0:
                performance = "excellent"
            elif duration < 3.0:
                performance = "good"
            elif duration < 10.0:
                performance = "acceptable"
            else:
                performance = "slow"
            
            # Cost estimation (mock)
            estimated_cost = tokens_used * 0.0001  # $0.0001 per token
            
            return {
                "operation": operation_name,
                "duration_seconds": duration,
                "tokens_used": tokens_used,
                "performance_rating": performance,
                "estimated_cost": round(estimated_cost, 4),
                "efficiency_score": max(0, 100 - duration * 10)
            }
        
        # Test fast operation
        fast_result = mock_track_performance("question_generation", 0.5, 100)
        assert fast_result["performance_rating"] == "excellent"
        assert fast_result["efficiency_score"] > 90
        
        # Test slow operation
        slow_result = mock_track_performance("essay_grading", 15.0, 500)
        assert slow_result["performance_rating"] == "slow"
        assert slow_result["efficiency_score"] < 50

    def test_format_conversion(self):
        """Test converting between different data formats"""
        def mock_convert_to_quiz_format(questions_data):
            """Convert AI-generated questions to quiz format"""
            quiz_format = {
                "quiz_id": f"quiz_{hash(str(questions_data)) % 10000}",
                "title": f"Generated Quiz ({len(questions_data)} questions)",
                "total_points": sum(q.get("points", 0) for q in questions_data),
                "estimated_time": len(questions_data) * 2,  # 2 minutes per question
                "questions": []
            }
            
            for i, q in enumerate(questions_data, 1):
                formatted_q = {
                    "id": i,
                    "text": q.get("question", ""),
                    "type": q.get("type", "multiple_choice"),
                    "points": q.get("points", 1),
                    "difficulty": q.get("difficulty", "medium")
                }
                
                if q.get("type") == "multiple_choice":
                    formatted_q["options"] = q.get("options", [])
                    formatted_q["correct"] = q.get("correct_answer", "")
                else:
                    formatted_q["sample_answer"] = q.get("correct_answer", "")
                
                quiz_format["questions"].append(formatted_q)
            
            return quiz_format
        
        sample_questions = [
            {
                "question": "What is 2+2?",
                "type": "multiple_choice",
                "options": ["3", "4", "5", "6"],
                "correct_answer": "4",
                "points": 2,
                "difficulty": "easy"
            },
            {
                "question": "Explain gravity.",
                "type": "short_answer",
                "correct_answer": "Force that attracts objects",
                "points": 5,
                "difficulty": "medium"
            }
        ]
        
        result = mock_convert_to_quiz_format(sample_questions)
        
        assert "quiz_id" in result
        assert result["total_points"] == 7  # 2 + 5
        assert result["estimated_time"] == 4  # 2 questions * 2 minutes
        assert len(result["questions"]) == 2
        assert result["questions"][0]["type"] == "multiple_choice"
        assert "options" in result["questions"][0]