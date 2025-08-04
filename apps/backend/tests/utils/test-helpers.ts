// tests/utils/test-helpers.ts
import { NextRequest } from 'next/server';

export const createMockRequest = (url: string, method: string = 'GET', body?: any) => {
    return new NextRequest(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { 'Content-Type': 'application/json' } : undefined
    });
};

export const createMockUser = (role: 'teacher' | 'student' | 'guardian' = 'teacher') => ({
    id: `${role}-123`,
    email: `${role}@example.com`,
    user_metadata: { full_name: `Test ${role}` }
});

// tests/utils/mock-data.ts
export const mockQuestionPaper = {
    id: 'paper-123',
    title: 'Math Quiz',
    description: 'Basic algebra questions',
    total_marks: 50,
    time_limit: 30,
    difficulty_level: 'medium',
    questions: [
        {
            id: 'q1',
            question: 'What is 2+2?',
            type: 'multiple_choice',
            options: ['3', '4', '5', '6'],
            correct_answer: '4',
            points: 5
        }
    ]
};

export const mockStudent = {
    id: 'student-123',
    full_name: 'John Doe',
    email: 'john@example.com',
    grade_level: '5th'
};