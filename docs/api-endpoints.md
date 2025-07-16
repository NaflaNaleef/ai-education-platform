# User Management API Endpoints

## Authentication
All endpoints (except `POST /api/auth/user`) require:
- Header: `x-clerk-user-id: <clerk_user_id>`
- Header: `x-user-email: <user_email>`

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