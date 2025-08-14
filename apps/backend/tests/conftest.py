# tests/conftest.py
import pytest
import os
import sys
from unittest.mock import Mock, patch

# Add project root to Python path so we can import our modules
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'ai'))  # Add ai folder to path

@pytest.fixture(scope="session")
def ai_config():
    """Configuration settings for AI tests"""
    return {
        "gemini_api_key": "test-api-key-12345",
        "model_name": "gemini-pro",
        "max_tokens": 2000,
        "temperature": 0.7,
        "timeout": 30
    }

@pytest.fixture
def mock_gemini_api():
    """Mock Google Gemini API for all tests"""
    with patch('google.generativeai.configure') as mock_configure, \
         patch('google.generativeai.GenerativeModel') as mock_model:
        
        # Create mock model instance
        mock_instance = Mock()
        mock_model.return_value = mock_instance
        
        # Default successful response
        mock_instance.generate_content.return_value.text = '{"success": true, "result": "test response"}'
        
        yield {
            "configure": mock_configure,
            "model": mock_model,
            "instance": mock_instance
        }

@pytest.fixture
def sample_educational_content():
    """Sample educational content for testing"""
    return {
        "science": """
        Chapter 3: The Solar System
        
        Our solar system consists of the Sun and eight planets. The inner planets 
        (Mercury, Venus, Earth, Mars) are rocky, while the outer planets 
        (Jupiter, Saturn, Uranus, Neptune) are gas giants.
        
        Key Facts:
        - The Sun is a star that provides energy through fusion
        - Earth is in the habitable zone
        - Jupiter is the largest planet
        - Saturn has distinctive rings
        """,
        "mathematics": """
        Chapter 7: Linear Equations
        
        A linear equation is an equation where the highest power of variables is 1.
        The general form is ax + b = 0, where a and b are constants.
        
        Examples:
        - 2x + 5 = 0
        - 3y - 7 = 2y + 1
        
        To solve: isolate the variable on one side.
        """,
        "history": """
        Chapter 12: The Industrial Revolution
        
        The Industrial Revolution began in Britain in the late 18th century.
        It transformed society from agricultural to industrial, introducing
        new manufacturing processes and technologies.
        
        Key Changes:
        - Steam power replaced manual labor
        - Factories replaced home-based production
        - Urbanization increased rapidly
        """
    }

@pytest.fixture
def sample_quiz_questions():
    """Sample quiz questions for testing grading"""
    return [
        {
            "id": 1,
            "question": "How many planets are in our solar system?",
            "type": "multiple_choice",
            "options": ["7", "8", "9", "10"],
            "correct_answer": "8",
            "points": 2,
            "difficulty": "easy"
        },
        {
            "id": 2,
            "question": "What is the general form of a linear equation?",
            "type": "short_answer",
            "correct_answer": "ax + b = 0",
            "points": 3,
            "difficulty": "medium"
        },
        {
            "id": 3,
            "question": "Describe the impact of the Industrial Revolution on society.",
            "type": "essay",
            "correct_answer": "The Industrial Revolution transformed society from agricultural to industrial, introducing new technologies, factory systems, and urbanization.",
            "points": 8,
            "difficulty": "hard"
        }
    ]

@pytest.fixture
def sample_student_submissions():
    """Sample student submissions for grading tests"""
    return [
        {
            "student_id": "student-001",
            "question_id": 1,
            "student_answer": "8",
            "submitted_at": "2025-01-01T10:00:00Z"
        },
        {
            "student_id": "student-001",
            "question_id": 2,
            "student_answer": "ax + b = 0",
            "submitted_at": "2025-01-01T10:01:00Z"
        },
        {
            "student_id": "student-001",
            "question_id": 3,
            "student_answer": "The Industrial Revolution changed how people lived and worked. Factories were built and people moved to cities. Steam power was important.",
            "submitted_at": "2025-01-01T10:05:00Z"
        }
    ]

@pytest.fixture
def mock_database():
    """Mock database operations"""
    class MockDB:
        def __init__(self):
            self.questions = []
            self.submissions = []
            self.results = []
        
        def save_questions(self, questions):
            self.questions.extend(questions)
            return {"success": True, "count": len(questions)}
        
        def save_submission(self, submission):
            self.submissions.append(submission)
            return {"success": True, "id": f"sub_{len(self.submissions)}"}
        
        def save_results(self, results):
            self.results.append(results)
            return {"success": True, "id": f"result_{len(self.results)}"}
        
        def get_questions(self, quiz_id):
            return [q for q in self.questions if q.get("quiz_id") == quiz_id]
    
    return MockDB()

# Test markers for better organization
def pytest_configure(config):
    """Configure custom pytest markers"""
    config.addinivalue_line(
        "markers", "unit: Unit tests for individual functions"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests with external services"
    )
    config.addinivalue_line(
        "markers", "ai: AI-related functionality tests"
    )
    config.addinivalue_line(
        "markers", "slow: Tests that take longer to run"
    )
    config.addinivalue_line(
        "markers", "api: Tests that mock external API calls"
    )

# Custom test collection and configuration
def pytest_configure(config):
    """Configure custom pytest markers and settings"""
    config.addinivalue_line(
        "markers", "unit: Unit tests for individual functions"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests with external services"
    )
    config.addinivalue_line(
        "markers", "ai: AI-related functionality tests"
    )
    config.addinivalue_line(
        "markers", "slow: Tests that take longer to run"
    )
    config.addinivalue_line(
        "markers", "api: Tests that mock external API calls"
    )
    
    # Set default test options if not already set
    if not config.getoption("--tb"):
        config.option.tbstyle = "short"
    if not hasattr(config.option, 'verbose') or config.option.verbose < 1:
        config.option.verbose = 1

# Pytest collection hook for adding default markers
def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers automatically"""
    for item in items:
        # Add 'ai' marker to all tests in ai_agent folder
        if "ai_agent" in str(item.fspath):
            item.add_marker(pytest.mark.ai)
        
        # Add 'unit' marker to test functions that don't mock external services
        if not any(mark.name in ['integration', 'slow'] for mark in item.iter_markers()):
            item.add_marker(pytest.mark.unit)

# Helpful utility functions for tests
@pytest.fixture
def assert_valid_question():
    """Helper function to validate question structure"""
    def _validate(question):
        required_fields = ["question", "type", "correct_answer", "points"]
        for field in required_fields:
            assert field in question, f"Missing required field: {field}"
        
        assert isinstance(question["points"], (int, float)), "Points must be numeric"
        assert question["points"] > 0, "Points must be positive"
        assert len(question["question"]) >= 10, "Question text too short"
        
        if question["type"] == "multiple_choice":
            assert "options" in question, "Multiple choice needs options"
            assert len(question["options"]) >= 2, "Need at least 2 options"
            assert question["correct_answer"] in question["options"], "Correct answer must be in options"
    
    return _validate

@pytest.fixture
def assert_valid_grading():
    """Helper function to validate grading results"""
    def _validate(result):
        required_fields = ["score", "max_points", "feedback"]
        for field in required_fields:
            assert field in result, f"Missing required field: {field}"
        
        assert isinstance(result["score"], (int, float)), "Score must be numeric"
        assert isinstance(result["max_points"], (int, float)), "Max points must be numeric"
        assert 0 <= result["score"] <= result["max_points"], "Score must be within valid range"
        assert len(result["feedback"]) > 0, "Feedback cannot be empty"
    
    return _validate