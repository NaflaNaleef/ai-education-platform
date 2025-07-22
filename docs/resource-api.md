# Resource Management API

All resource-related API endpoints are now documented in [api-endpoints.md](./api-endpoints.md).

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