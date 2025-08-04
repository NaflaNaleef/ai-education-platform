// tests/marking-scheme/marking-scheme.test.ts
import { GET as getMarkingScheme } from '@/app/api/marking-scheme/route';  // ✅ Fixed path
import { NextRequest } from 'next/server';

// Mock Supabase Admin
jest.mock('@/lib/db/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({
                        data: {
                            marking_scheme: {
                                total_points: 15,
                                grading_criteria: ['accuracy', 'completeness']
                            }
                        },
                        error: null
                    }))
                }))
            }))
        }))
    }
}));

describe('Marking Scheme API', () => {
    it('should generate marking scheme for questions', async () => {
        const mockRequest = new NextRequest('http://localhost:3001/api/marking-scheme?question_paper_id=paper-123', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': 'teacher-123',
                'x-user-role': 'teacher',
                'x-user-email': 'teacher@example.com'
            }
        });

        const response = await getMarkingScheme(mockRequest);
        const data = await response.json();

        console.log('Response status:', response.status);
        console.log('Response data:', data);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.marking_scheme).toBeDefined();
    });

    it('should handle missing question paper ID', async () => {
        const mockRequest = new NextRequest('http://localhost:3001/api/marking-scheme', {
            method: 'GET'
        });

        const response = await getMarkingScheme(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('required');
    });
});