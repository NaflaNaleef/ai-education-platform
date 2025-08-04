// tests/marking-scheme/marking-scheme.test.ts
import { GET as getMarkingScheme } from '@/app/api/marking-scheme/route';
import { NextRequest } from 'next/server';

describe('Marking Scheme API', () => {
    it('should generate marking scheme for questions', async () => {
        const mockQuestions = [
            { id: 'q1', type: 'multiple_choice', points: 5 },
            { id: 'q2', type: 'short_answer', points: 10 }
        ];

        // Test your marking scheme generation logic
        const mockRequest = new NextRequest('http://localhost:3000/api/marking-scheme', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const response = await getMarkingScheme(mockRequest);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.scheme).toBeDefined();
        expect(data.scheme.total_points).toBe(15);
    });
});