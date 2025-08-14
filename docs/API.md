# API Documentation

## Overview

- **Base URLs:**
  - Next.js Backend: `http://localhost:3001/api/`
  - AI Service (FastAPI): `http://localhost:8000/`
- **Authentication:** All endpoints require Clerk JWT via `Authorization: Bearer <token>`
- **Content Types:** JSON (`application/json`), file uploads use `multipart/form-data`

---

## Authentication

All API requests require a valid Clerk JWT token in the `Authorization` header:

```http
Authorization: Bearer <your_clerk_jwt_token>
```

- Unauthorized requests return `401 Unauthorized` with `{ "error": "Unauthorized" }`.
- Only users with the correct role (teacher/student) can access role-specific endpoints.

---

## Teacher Endpoints

| Method | Path                                 | Description                                 | Auth Required |
|--------|--------------------------------------|---------------------------------------------|--------------|
| GET    | /api/teacher/students                | List students in teacher's classes          | Yes          |
| POST   | /api/teacher/students                | Add a new student                           | Yes          |
| GET    | /api/teacher/dashboard               | Teacher dashboard overview                  | Yes          |
| POST   | /api/teacher/create-question-paper   | Create a new question paper with AI         | Yes          |
| GET    | /api/teacher/create-question-paper   | List question papers for a resource         | Yes          |
| GET    | /api/teacher/assignments             | List assignments for teacher's classes      | Yes          |
| POST   | /api/teacher/assignments             | Create a new assignment                     | Yes          |

### Example: Create Question Paper

**POST /api/teacher/create-question-paper**

- **Request:**
```json
{
  "resource_id": "resource-uuid",
  "title": "Algebra Quiz 1",
  "description": "Quiz on basic algebra concepts",
  "question_count": 6,
  "difficulty_level": "medium",
  "question_types": ["multiple_choice", "short_answer"],
  "time_limit": 30
}
```
- **Response (success):**
```json
{
  "success": true,
  "message": "Question paper \"Algebra Quiz 1\" created successfully with 6 questions",
  "question_paper": {
    "id": "qp-uuid",
    "title": "Algebra Quiz 1",
    "total_questions": 6,
    "total_marks": 12,
    "time_limit": 30,
    "status": "published"
  },
  "ai_generation": {
    "questions_generated": 6,
    "marking_scheme_generated": true
  }
}
```
- **Error (missing fields):**
```json
{
  "success": false,
  "error": "Missing required fields: resource_id, title"
}
```

---

## Student Endpoints

| Method | Path                              | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|--------------|
| GET    | /api/student/assignments          | List assignments/quizzes for student        | Yes          |
| GET    | /api/student/dashboard            | Student dashboard overview                  | Yes          |
| POST   | /api/student/submit-answers       | Submit answers for a quiz                   | Yes          |
| GET    | /api/student/submit-answers       | Get quiz for student (by question_paper_id) | Yes          |

### Example: Submit Answers

**POST /api/student/submit-answers**

- **Request:**
```json
{
  "question_paper_id": "qp-uuid",
  "answers": [
    { "question_id": "q1", "question_number": 1, "answer": "42" },
    { "question_id": "q2", "question_number": 2, "answer": "x = 3" }
  ],
  "time_taken": 420
}
```
- **Response (success):**
```json
{
  "success": true,
  "submission": {
    "id": "submission-uuid",
    "question_paper_id": "qp-uuid",
    "student_id": "student-uuid",
    "submitted_at": "2024-05-01T12:00:00Z",
    "status": "submitted"
  },
  "auto_grading": {
    "enabled": true,
    "success": true,
    "result_id": "result-uuid",
    "total_score": 8,
    "max_possible_score": 12,
    "percentage": 66.7,
    "grade": "C",
    "grading_time": 7.1
  }
}
```
- **Error (already submitted):**
```json
{
  "error": "You have already submitted answers for this quiz",
  "existing_submission_id": "submission-uuid",
  "status": "graded"
}
```

---

## Resource Management

| Method | Path                        | Description                | Auth Required |
|--------|-----------------------------|----------------------------|--------------|
| POST   | /api/resources/upload       | Upload a resource file     | Yes          |
| GET    | /api/resources              | List resources             | Yes          |
| GET    | /api/resources/download     | Download a resource file   | Yes          |
| GET    | /api/resources/[id]         | Get resource by ID         | Yes          |

**File Upload:** Use `multipart/form-data` with fields:
- `file`: The file to upload
- `title`, `description`, `subject`, `grade_level` (as needed)

**Download Example:**
```http
GET /api/resources/download?id=resource-uuid
Authorization: Bearer <token>
```
- **Response:**
```json
{
  "downloadUrl": "https://.../file.pdf",
  "title": "Algebra Notes",
  "description": "PDF notes for algebra",
  "fileType": "application/pdf",
  "fileSize": 123456,
  "uploadStatus": "complete"
}
```

---

## AI Service Endpoints (FastAPI)

| Method | Path                      | Description                        | Auth Required |
|--------|---------------------------|------------------------------------|--------------|
| GET    | /health                   | Health check                       | No           |
| POST   | /analyze-content          | Analyze resource content           | Yes (API Key) |
| POST   | /generate-questions       | Generate questions from content    | Yes (API Key) |
| POST   | /grade-submission         | Grade a student submission         | Yes (API Key) |
| POST   | /grade-submission-with-scheme | Grade with marking scheme      | Yes (API Key) |
| GET    | /grading-status           | Grading service status             | No           |
| GET    | /ai-usage                 | AI usage statistics                | No           |

**Example: Analyze Content**
```json
POST /analyze-content
{
  "file_content": "...text...",
  "file_type": "text/plain",
  "resource_id": "resource-uuid"
}
```
- **Response:**
```json
{
  "success": true,
  "word_count": 1200,
  "suitable_for_questions": true,
  "content_type": "text/plain"
}
```

---

## Assignment Management

- **Teacher:** `/api/teacher/assignments` (GET, POST)
- **Student:** `/api/student/assignments` (GET)
- **Assignment object** includes: `id`, `title`, `due_date`, `status`, `class_id`, `question_paper_id`, `max_attempts`, etc.

---

## Guardian Endpoints

| Method | Path                        | Description                                 | Auth Required |
|--------|-----------------------------|---------------------------------------------|--------------|
| GET    | /api/guardian/dashboard     | Guardian dashboard overview, notifications, and student details | Yes (guardian) |

- **Query Parameters:**
  - `type=notifications` — Only notifications
  - `student_id=xxx` — Specific student details

- **Response Example (overview):**
```json
{
  "success": true,
  "data": {
    "overview": { "total_students": 2, "total_quizzes_completed": 10, "average_score": 78, "students_improving": 1, "students_need_attention": 1 },
    "recent_activities": [ { "student_name": "Alice", "activity": "Quiz completed", "score": 85, "subject": "Math", "date": "2024-05-01T12:00:00Z" } ],
    "notifications": [ { "id": "low_score_0", "type": "low_score", "title": "Low Quiz Score", "message": "Alice scored 55% on Math", "priority": "medium", "student_name": "Alice", "date": "2024-05-01T12:00:00Z" } ],
    "students_summary": [ { "id": "student-uuid", "name": "Alice", "grade": "5", "avg_score": 78, "total_quizzes": 5, "trend": "improving" } ]
  }
}
```

---

## Grading & Results

- **Student submission:** `/api/student/submit-answers` (POST)
- **Auto-grading:** Performed automatically, results stored in `results` table
- **Result object:** `total_score`, `max_score`, `percentage`, `grade`, `ai_feedback`, `graded_at`

| Method | Path                | Description                        | Auth Required |
|--------|---------------------|------------------------------------|--------------|
| GET    | /api/results        | Get grading results for submission | Yes          |

- **Query Parameters:** `submission_id` (required)
- **Response Example:**
```json
{
  "success": true,
  "results": {
    "total_score": 8,
    "max_score": 12,
    "percentage": 66.7,
    "question_scores": [ ... ],
    "ai_feedback": { ... },
    "teacher_feedback": null,
    "graded_by": "ai",
    "graded_at": "2024-05-01T12:10:00Z",
    "reviewed_at": null
  }
}
```
- **Error:** `{ "success": false, "error": "submission_id required" }` (400), `{ "success": false, "error": "Results not found" }` (404)

---

## Admin/Other Endpoints

- `/api/health` (GET): Backend health check
- `/api/db-test` (GET): Database connection test
- `/api/ai/usage` (GET): AI usage stats
- `/api/ai/test-connection` (GET, POST): AI service test

### Auth/User Endpoints

| Method | Path                | Description                        | Auth Required |
|--------|---------------------|------------------------------------|--------------|
| POST   | /api/auth/user      | Create user after Clerk signup     | No           |
| GET    | /api/auth/user      | Get current user profile           | Yes          |
| PUT    | /api/auth/user      | Update user profile                | Yes          |

- **POST Request Example:**
```json
{
  "clerk_id": "clerk-uuid",
  "email": "user@example.com",
  "full_name": "User Name",
  "role": "student",
  "profile_image_url": "https://..."
}
```
- **GET Request:** Requires `x-clerk-user-id` header.
- **PUT Request:** Requires `x-clerk-user-id` header and update fields.

- **Standard Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "clerk_id": "clerk-uuid",
    "email": "user@example.com",
    "full_name": "User Name",
    "role": "student",
    "profile_image_url": "https://...",
    "preferences": {},
    "created_at": "...",
    "updated_at": "..."
  }
}
```
- **Error:** `{ "success": false, "error": "User already exists" }` (409), `{ "success": false, "error": "User not authenticated" }` (401), `{ "success": false, "error": "Validation failed" }` (400)

---

## Error Handling

- **Standard error format:**
```json
{
  "error": "Error message",
  "details": "Optional details"
}
```
- **Common HTTP status codes:**
  - 200 OK: Success
  - 201 Created: Resource created
  - 400 Bad Request: Invalid input
  - 401 Unauthorized: Missing/invalid token
  - 403 Forbidden: Insufficient permissions
  - 404 Not Found: Resource not found
  - 409 Conflict: Duplicate submission
  - 500 Internal Server Error: Server error

---

## Rate Limiting

- No explicit rate limiting found in the codebase. (Add if implemented in the future.)

---

## Testing

- End-to-end workflow test: `test-complete-workflow.ps1`
- Example: `pwsh test-complete-workflow.ps1`
- Tests cover: resource upload, question generation, assignment, quiz-taking, grading, and dashboard updates.

---

For further details, see the codebase and endpoint source files.
