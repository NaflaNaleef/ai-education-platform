# Supabase Schema: AI Education Platform (Production)

## Table: users
| Field             | Type          | Notes                        |
|-------------------|---------------|------------------------------|
| id                | uuid (PK)     | Primary key                  |
| clerk_id          | text          | Clerk user ID (unique)       |
| email             | text          | Unique                       |
| full_name         | text          |                              |
| role              | text          | 'teacher', 'student', 'guardian' |
| profile_image_url | text          | Optional                     |
| preferences       | jsonb         | Optional                     |
| created_at        | timestamptz   | Default: now()               |
| updated_at        | timestamptz   | Default: now()               |

## Table: resources
| Field            | Type                        | Notes/Constraints                                      |
|------------------|-----------------------------|--------------------------------------------------------|
| id               | uuid (PK)                   | Primary key, default uuid_generate_v4()                |
| user_id          | uuid (FK)                   | References users(id), owner of the resource (any user) |
| title            | varchar(255)                | Not null                                               |
| description      | text                        | Nullable                                               |
| file_url         | text                        | Not null                                               |
| file_type        | varchar(50)                 | Not null                                               |
| file_size        | integer                     | Nullable                                               |
| content_preview  | text                        | Nullable                                               |
| upload_status    | varchar(20)                 | Default 'processing', check: processing/ready/failed   |
| created_at       | timestamptz                 | Default now()                                          |
| updated_at       | timestamptz                 | Default now()                                          |
| analysis_result  | jsonb                       | AI analysis output (language, word count, etc.), nullable |

> **Note:** `user_id` is the owner of the resource and can be any user (teacher, student, etc.).

## Table: question_papers
| Field            | Type                        | Notes/Constraints                                      |
|------------------|-----------------------------|--------------------------------------------------------|
| id               | uuid (PK)                   | Primary key, default gen_random_uuid()                 |
| resource_id      | uuid (FK)                   | References resources(id), on delete CASCADE            |
| teacher_id       | uuid (FK)                   | References users(id), must be a teacher                |
| title            | varchar(255)                | Not null                                               |
| description      | text                        | Nullable                                               |
| content          | jsonb                       | Questions array, not null                              |
| marking_scheme   | jsonb                       | Not null                                               |
| total_marks      | integer                     | Not null                                               |
| time_limit       | integer                     | Nullable                                               |
| difficulty_level | varchar(20)                 | Default 'medium', check: easy/medium/hard              |
| status           | varchar(20)                 | Default 'draft', check: draft/published/archived       |
| ai_generated_at  | timestamptz                 | Nullable                                               |
| created_at       | timestamptz                 | Default now()                                          |
| updated_at       | timestamptz                 | Default now()                                          |

> **Note:** `teacher_id` must reference a user with role 'teacher'.

## Table: submissions
| Field            | Type                        | Notes/Constraints                                      |
|------------------|-----------------------------|--------------------------------------------------------|
| id               | uuid (PK)                   | Primary key, default gen_random_uuid()                 |
| assignment_id    | uuid (FK)                   | References assignments(id), on delete CASCADE          |
| student_id       | uuid (FK)                   | References users(id), on delete CASCADE                |
| answers          | jsonb                       | Not null                                               |
| started_at       | timestamptz                 | Default now()                                          |
| submitted_at     | timestamptz                 | Nullable                                               |
| attempt_number   | integer                     | Default 1                                              |
| status           | varchar(20)                 | Default 'in_progress', check: in_progress/submitted/graded |
| time_taken       | integer                     | Nullable                                               |
| created_at       | timestamptz                 | Default now()                                          |
| updated_at       | timestamptz                 | Default now()                                          |

## Table: results
| Field            | Type                        | Notes/Constraints                                      |
|------------------|-----------------------------|--------------------------------------------------------|
| id               | uuid (PK)                   | Primary key, default gen_random_uuid()                 |
| submission_id    | uuid (FK)                   | References submissions(id), on delete CASCADE          |
| total_score      | numeric(5,2)                | Not null                                               |
| max_score        | numeric(5,2)                | Not null                                               |
| percentage       | numeric (generated)         | Always as ((total_score / max_score) * 100)            |
| question_scores  | jsonb                       | Per-question breakdown, not null                       |
| ai_feedback      | jsonb                       | Nullable                                               |
| teacher_feedback | text                        | Nullable                                               |
| graded_by        | varchar(10)                 | Default 'ai', check: ai/teacher                        |
| graded_at        | timestamptz                 | Default now()                                          |
| reviewed_at      | timestamptz                 | Nullable                                               |
| created_at       | timestamptz                 | Default now()                                          |

## Indexes & Constraints
- All foreign keys use `on delete CASCADE`.
- All status/difficulty fields use check constraints for allowed values.
- Indexes exist for user_id, teacher_id, assignment_id, and submission_id for fast lookups.

## Field Notes
- **analysis_result**: Stores the output of AI content analysis (JSON), e.g., language, word count, suitability, etc. Written after calling the AI `/analyze-content` endpoint.
- **content** (question_papers): Array of questions generated by AI.
- **marking_scheme**: JSON object with marking details for each question.
- **question_scores** (results): Per-question grading breakdown.

## Example: Update analysis_result in code
```ts
await supabaseAdmin
  .from('resources')
  .update({ analysis_result: analysis })
  .eq('id', resourceId);
```

## Example: Table Creation SQL
(see your actual SQL migrations for full details) 