// tests/ai/generate-questions.test.ts
import { POST as generateQuestions } from '@/app/api/ai/generate-questions/route';
import { NextRequest } from 'next/server';

// Mock Supabase
jest.mock('@/lib/db/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({
                        data: {
                            id: 'resource-123',
                            title: 'Test Resource',
                            content_preview: 'This is a test content for generating questions. It contains enough text to generate meaningful questions.',
                            file_type: 'txt'
                        },
                        error: null
                    }))
                }))
            }))
        }))
    }
}));

// Mock your AI client
jest.mock('@/lib/ai/ai-client', () => ({
    aiClient: {
        generateQuestions: jest.fn(() => Promise.resolve({
            success: true,
            total_questions: 5,
            questions: [
                {
                    id: 'q1',
                    question: 'What is 2+2?',
                    type: 'multiple_choice',
                    options: ['3', '4', '5', '6'],
                    correct_answer: '4',
                    points: 2
                }
            ],
            generation_time: '3.2 seconds'
        }))
    }
}));

describe('AI Question Generation', () => {
    it('should generate questions successfully', async () => {
        const requestBody = {
            resourceId: 'resource-123',
            questionCount: 5,
            difficultyLevel: 'medium',
            questionTypes: ['multiple_choice']
        };

        const mockRequest = new NextRequest('http://localhost:3001/api/ai/generate-questions', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await generateQuestions(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.questions.total_questions).toBe(5);
        expect(data.questions.questions).toHaveLength(1);
        expect(data.questions.questions[0].question).toBe('What is 2+2?');
    });

    it('should handle missing resourceId', async () => {
        const requestBody = { questionCount: 5 }; // Missing resourceId

        const mockRequest = new NextRequest('http://localhost:3001/api/ai/generate-questions', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await generateQuestions(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Resource ID is required');
    });
});