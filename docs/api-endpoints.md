# API Endpoints Contract

## Resource Management

| Method | Path                        | Description                       |
|--------|-----------------------------|-----------------------------------|
| POST   | /api/resources/upload       | Upload a resource (PDF, DOCX, TXT)|
| GET    | /api/resources              | List resources for current user   |
| GET    | /api/resources/download     | Download a resource file          |

### POST /api/resources/upload
**Request:** `multipart/form-data`
- file: File (PDF, DOCX, TXT)
- title: string
- description: string

**Response:**
```json
{
  "message": "File uploaded successfully",
  "resource": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "...",
    "description": "...",
    "file_url": "...",
    "file_type": "pdf|docx|txt",
    "file_size": 12345,
    "content_preview": "...",
    "upload_status": "processing|ready|failed",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "analysis_result": { /* AI analysis output, see below */ }
  }
}
```
> **Note:** `analysis_result` is a JSON object storing the output of AI content analysis (e.g., language, word count, suitability, etc.).

### GET /api/resources
**Response:**
```json
{
  "resources": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title": "...",
      "description": "...",
      "file_url": "...",
      "file_type": "pdf|docx|txt",
      "file_size": 12345,
      "content_preview": "...",
      "upload_status": "processing|ready|failed",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "analysis_result": { /* ... */ }
    }
  ]
}
```

### GET /api/resources/download?id=resourceId
**Response:**
```json
{
  "downloadUrl": "...",
  "title": "...",
  "description": "...",
  "fileType": "...",
  "fileSize": 12345,
  "uploadStatus": "ready",
  "contentPreview": "..."
}
```

---

## Question Paper & Marking Scheme

| Method | Path                              | Description                       |
|--------|-----------------------------------|-----------------------------------|
| POST   | /api/ai/analyze-content           | Analyze resource content          |
| POST   | /api/ai/generate-questions        | Generate questions from resource  |
| POST   | /api/ai/generate-marking-scheme   | Generate marking scheme           |
| GET    | /api/question-paper               | Retrieve question papers (by resource_id or teacher_id) |
| GET    | /api/marking-scheme               | Retrieve marking scheme (by question_paper_id) |

### POST /api/ai/analyze-content
**Request:**
```json
{
  "file_content": "...",
  "file_type": "pdf|txt|docx",
  "resource_id": "..."
}
```
**Response:**
```json
{
  "success": true,
  "content_type": "...",
  "word_count": 123,
  "language": "english",
  "suitable_for_questions": true,
  "educational_score": 5,
  "gemini_available": true,
  "message": "Content analyzed successfully."
}
```

### POST /api/ai/generate-questions
**Request:**
```json
{
  "content": "...",
  "question_count": 10,
  "difficulty_level": "medium",
  "question_types": ["multiple_choice", "short_answer"],
  "subject": "general"
}
```
**Response:**
```json
{
  "success": true,
  "total_questions": 10,
  "questions": [ /* array of questions */ ],
  "marking_scheme": { /* marking scheme */ },
  "generation_time": "2.1 seconds",
  "cost_estimate": "$0.00 (FREE TIER)",
  "requests_remaining": 44
}
```

### GET /api/question-paper?resource_id=...&teacher_id=...
**Response:**
```json
{
  "success": true,
  "question_papers": [
    {
      "id": "uuid",
      "resource_id": "uuid",
      "teacher_id": "uuid",
      "title": "...",
      "description": "...",
      "content": [ /* questions */ ],
      "marking_scheme": { /* ... */ },
      "total_marks": 100,
      "time_limit": 60,
      "difficulty_level": "easy|medium|hard",
      "status": "draft|published|archived",
      "ai_generated_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/marking-scheme?question_paper_id=...
**Response:**
```json
{
  "success": true,
  "marking_scheme": { /* ... */ }
}
```

---

## Submissions & Results

| Method | Path                    | Description                       |
|--------|-------------------------|-----------------------------------|
| POST   | /api/ai/grade-submission| Submit and auto-grade answers     |
| GET    | /api/results           | Get results for a submission      |

### POST /api/ai/grade-submission
**Request:**
```json
{
  "user_id": "...",
  "question_paper_id": "...",
  "answers": [ /* array of answers */ ]
}
```
**Response:**
```json
{
  "success": true,
  "submission_id": "...",
  "auto_graded": true,
  "score": 18,
  "results": { /* grading breakdown */ }
}
```

### GET /api/results?submission_id=...
**Response:**
```json
{
  "success": true,
  "results": {
    "total_score": 18,
    "max_score": 20,
    "percentage": 90.0,
    "question_scores": { /* per-question scores */ },
    "ai_feedback": { /* ... */ },
    "teacher_feedback": null,
    "graded_by": "ai|teacher",
    "graded_at": "2024-01-01T00:00:00Z",
    "reviewed_at": null
  }
}
```

---

## User Management

| Method | Path                    | Description                       |
|--------|-------------------------|-----------------------------------|
| POST   | /api/auth/user          | Create user (after Clerk signup)  |
| GET    | /api/auth/user          | Get current user info             |
| PUT    | /api/auth/user          | Update user profile               |
| GET    | /api/auth/user/role     | Get user role and permissions     |

---

## Health & Utility

| Method | Path                    | Description                       |
|--------|-------------------------|-----------------------------------|
| GET    | /api/health             | Health check                      |
| GET    | /api/db-test            | Test DB connection                |
| GET    | /api/test-user          | Test user creation/count          |
| DELETE | /api/test-user          | Cleanup test users                | 