# User Management API Endpoints

## Authentication
All endpoints (except `POST /api/auth/user`) require:
- Header: `x-clerk-user-id: <clerk_user_id>`
- Header: `x-user-email: <user_email>`

---

# Resource Management API

## Authentication
All endpoints require Supabase session cookies:
- `sb-access-token`
- `sb-refresh-token`

## Endpoints

### POST /api/upload/resource
Upload a file with title and description.

**Headers:**  
Cookie: sb-access-token=...; sb-refresh-token=...

**Form Data:**
- file: File (PDF, DOCX, DOC, TXT, max 10MB, required)
- title: string (optional)
- description: string (optional)

**Response:**
```json
{
  "message": "File uploaded successfully",
  "resource": { /* resource object */ }
}
```

---

### GET /api/resources
Get all resources uploaded by the current user.

**Headers:**  
Cookie: sb-access-token=...; sb-refresh-token=...

**Response:**
```json
{
  "resources": [ /* array of resource objects */ ]
}
```

---

### GET /api/resources/download?id=RESOURCE_ID
Get a download URL and metadata for a specific resource.

**Headers:**  
Cookie: sb-access-token=...; sb-refresh-token=...

**Response:**
```json
{
  "downloadUrl": "...",
  "title": "...",
  "description": "...",
  "fileType": "...",
  "fileSize": 12345,
  "uploadStatus": "ready"
}
```

---

## Example: File Upload (Frontend)
```js
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('title', 'My Test Document');
formData.append('description', 'This is a test upload');

fetch('/api/upload/resource', {
  method: 'POST',
  body: formData,
  credentials: 'include'
});
```

---

## Contact
For resource API questions, contact [Your Name] at [your.email@example.com].

---

## Endpoints

### POST /api/auth/user
Create new user after Clerk signup

**Request Body:**
```json
{
  "clerk_id": "user_123",
  "email": "user@example.com", 
  "full_name": "John Doe",
  "role": "teacher"
}
```

---

### GET /api/auth/user
Get current user profile

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clerk_id": "user_123",
    "email": "user@example.com",
    "full_name": "John Doe", 
    "role": "teacher",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### PUT /api/auth/user
Update user profile

**Request Body:**
```json
{
  "full_name": "John Smith",
  "preferences": {"theme": "dark"}
}
```

---

### GET /api/auth/user/role
Get user role and permissions

**Response:**
```json
{
  "success": true,
  "data": {
    "role": "teacher",
    "full_name": "John Doe",
    "permissions": ["create_resources", "create_question_papers"]
  }
}
```

---

### POST /api/ai/analyze-content
Analyze the content of a resource using the AI service.

**Request Body:**
```json
{
  "resourceId": "string"
}
```

**Response:**
- 200: `{ "success": true, "resource_id": "string", "analysis": { ... } }`
- 400: `{ "error": "Resource ID is required" }`
- 404: `{ "error": "Resource not found" }` or `{ "error": "File content not found" }`
- 500: `{ "error": "Analysis failed", "details": "..." }`

**Description:**  
Fetches the resource by ID, downloads its file content, analyzes it using the AI service, and updates the resource with the analysis result. 