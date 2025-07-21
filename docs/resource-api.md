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