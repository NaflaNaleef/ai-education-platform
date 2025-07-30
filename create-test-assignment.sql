-- Create Test Assignment in Supabase Database
-- Run this in your Supabase SQL Editor

-- First, let's create a test class (required for assignment)
INSERT INTO classes (
    id,
    teacher_id,
    name,
    description,
    class_code,
    is_active,
    created_at,
    updated_at
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  -- Class UUID
    '73596418-7572-485a-929d-6f9688cb8a36',  -- Teacher ID (from your existing data)
    'Test Science Class',
    'A test class for science assignments',
    'SCIENCE2024',                            -- Unique class code
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Now create an assignment that links the question paper
INSERT INTO assignments (
    id,
    question_paper_id,
    class_id,
    title,
    instructions,
    due_date,
    max_attempts,
    shuffle_questions,
    status,
    created_at,
    updated_at
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',  -- Assignment UUID
    '75caf4cd-2554-4ed1-b5a1-0392c57af44a',  -- Question Paper ID (from your existing data)
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  -- Class ID (from above)
    'Water Cycle Test Assignment',
    'Complete the water cycle test questions. You have 6 minutes.',
    NOW() + INTERVAL '7 days',                -- Due in 7 days
    3,                                        -- Max 3 attempts
    false,                                    -- Don't shuffle questions
    'active',                                 -- Active status
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    due_date = EXCLUDED.due_date,
    updated_at = NOW();

-- Enroll the test student in the class
INSERT INTO enrollments (
    class_id,
    student_id,
    enrolled_at,
    status
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  -- Class ID
    '12345678-1234-1234-1234-123456789abc',  -- Student ID
    NOW(),
    'active'
) ON CONFLICT (class_id, student_id) DO UPDATE SET
    status = 'active',
    enrolled_at = NOW();

-- Verify everything was created
SELECT 
    'Class' as type,
    id,
    name,
    class_code
FROM classes 
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

UNION ALL

SELECT 
    'Assignment' as type,
    a.id,
    a.title,
    qp.title as question_paper_title
FROM assignments a
JOIN question_papers qp ON a.question_paper_id = qp.id
WHERE a.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

UNION ALL

SELECT 
    'Enrollment' as type,
    e.id,
    u.full_name as student_name,
    c.name as class_name
FROM enrollments e
JOIN users u ON e.student_id = u.id
JOIN classes c ON e.class_id = c.id
WHERE e.student_id = '12345678-1234-1234-1234-123456789abc'; 