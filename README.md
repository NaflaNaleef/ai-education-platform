# AI Education Platform

[![Cloud Run Ready](https://img.shields.io/badge/Cloud%20Run-Ready-brightgreen)](https://cloud.google.com/run)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js-blue)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/AI%20Service-Python%20%2B%20Gemini-yellow)](https://python.org/)

---

## Table of Contents
- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
  - [Teacher Workflow](#teacher-workflow)
  - [Student Workflow](#student-workflow)
  - [AI Capabilities](#ai-capabilities)
- [Workflow Example](#workflow-example)
- [Technical Stack](#technical-stack)
- [Requirements](#requirements)
- [Installation & Setup](#installation--setup)
  - [Frontend/API (Next.js)](#frontendapi-nextjs)
  - [AI Service (Python)](#ai-service-python)
  - [Database Setup](#database-setup)
- [Testing](#testing)
- [Future Enhancements](#future-enhancements)
- [License](#license)

---

## Project Overview

**AI Education Platform** is a multi-service application designed for educational institutions to automate quiz generation, assignment management, and AI-powered grading. It leverages advanced AI to streamline both teaching and learning workflows, providing real-time feedback and analytics.

---

## Architecture

```
[ Teacher/Student ]
        |
   [ Next.js Web/API ]  <---->  [ FastAPI AI Service (Gemini) ]
        |                              |
   [ Clerk Auth ]                      |
        |                              |
    [ Supabase (PostgreSQL) ] --------
```

---

## Key Features

### Teacher Workflow
- Upload educational resources (PDFs, documents)
- AI-powered content analysis and concept extraction
- Automatic question paper generation with marking schemes
- Assignment creation and class management
- Real-time grading dashboard

### Student Workflow
- View available assignments
- Take timed quizzes with multiple question types
- Receive instant AI-generated feedback
- Track performance and completion rates

### AI Capabilities
- Content analysis and summarization
- Dynamic question generation (multiple choice, short answer, etc.)
- Intelligent auto-grading with detailed feedback
- Difficulty level adaptation

---

## Workflow Example

**End-to-End Automation:**
1. **Upload**: Teacher uploads resource
2. **Analyze**: AI analyzes and extracts concepts
3. **Generate**: System generates questions and marking scheme
4. **Assign**: Teacher assigns quiz to class
5. **Quiz**: Students take the quiz
6. **Grade**: AI grades and provides feedback

> Example: Generated 6 questions in 7.2 seconds, graded submission in 7.1 seconds

---

## Technical Stack

- **Frontend/API**: Next.js (TypeScript)
- **AI Service**: FastAPI (Python) with Gemini AI integration
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **Deployment**: Google Cloud Run ready
- **Ports**:
  - Next.js: `3001`
  - Python AI Service (FastAPI): `8000`

---

## Requirements

- Node.js (v18+ recommended)
- Python 3.9+
- Supabase account and project
- Clerk account for authentication
- Google Cloud account (for deployment)
- Gemini API key

---

## Installation & Setup

### Frontend/API (Next.js)
```bash
# Navigate to backend directory
cd apps/backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Clerk and Supabase credentials

# Run development server
npm run dev
```

### AI Service (FastAPI)
```bash
# Navigate to AI service directory
cd apps/backend/ai

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your Gemini API key and Supabase credentials

# Run the FastAPI service
python main.py
```

### Database Setup

1. **Create Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Set up Database Schema**:
   - Use Supabase SQL Editor or run migrations
   - Import your schema if you have migration files

3. **Update Environment Variables**:
   ```bash
   # In both .env.local (Next.js) and .env (FastAPI)
   DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
   SUPABASE_URL=https://[project-ref].supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   ```

---

## Testing

Automated end-to-end tests validate the complete workflow, including resource upload, question generation, assignment, quiz-taking, and grading.

```bash
# Example: Run the complete workflow test (PowerShell)
pwsh test-complete-workflow.ps1
```

---

## Future Enhancements
- Google Classroom integration
- Advanced analytics and reporting
- Multi-language support

---

## Environment Configuration

### Next.js (`.env.local`)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
AI_SERVICE_URL=http://localhost:8000
```

### Python AI Service (`.env`)
```bash
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
PORT=8000
```

---

## Troubleshooting

### Common Issues

**AI Service Connection Error**
```bash
# Check if AI service is running
curl http://localhost:8000/health
```

**Database Connection Issues**
- Verify `DATABASE_URL` in both services
- Ensure database is running and accessible
- Check firewall settings

**Clerk Authentication Issues**
- Verify Clerk keys in Next.js environment
- Check Clerk dashboard for domain configuration

---

## API Overview

### Key Endpoints
- `POST /api/teacher/upload-resource` – Upload educational content
- `POST /api/teacher/create-question-paper` – Generate AI questions
- `GET /api/student/assignments` – View available assignments
- `POST /api/student/submit-answers` – Submit quiz responses

> Full API documentation available in [API.md](docs/API.md)

---

## Test Results

Our automated end-to-end test demonstrates the complete workflow:

```
🎯 FINAL RESULT: 18.5% (F)
📊 Questions Generated: 6
⏱️ Generation Time: 7.2 seconds  
🤖 Grading Time: 7.1 seconds
✅ Complete workflow: SUCCESSFUL
```

**Test Coverage:**
- ✅ Resource upload and analysis
- ✅ AI question generation with marking schemes  
- ✅ Student assignment workflow
- ✅ Automated grading with feedback
- ✅ Dashboard updates

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices for Next.js code
- Use Python type hints in the AI service
- Add tests for new features
- Update documentation for API changes

---

## License

[MIT](LICENSE)
