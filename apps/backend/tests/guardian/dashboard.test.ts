// tests/guardian/dashboard.test.ts
import { GET as guardianDashboard } from '@/app/api/guardian/dashboard/route';
import { NextRequest } from 'next/server';

// Mock Supabase
jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: [
            {
              student_id: 'student-1',
              relationship: 'parent',
              users: { id: 'student-1', full_name: 'John Doe', grade_level: '5th' }
            }
          ],
          error: null
        }))
      }))
    }))
  }
}));

describe('Guardian Dashboard API', () => {
  it('should return dashboard overview for guardian', async () => {
    const mockRequest = new NextRequest('http://localhost:3001/api/guardian/dashboard');
    
    // Mock getCurrentUser to return a guardian
    jest.mock('@/lib/auth/middleware', () => ({
      getCurrentUser: () => ({ id: 'guardian-123', role: 'guardian' }),
      requireRole: () => null
    }));

    const response = await guardianDashboard(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.overview).toBeDefined();
    expect(data.data.overview.total_students).toBeGreaterThanOrEqual(0);
    expect(data.data.students_summary).toBeInstanceOf(Array);
  });

  it('should handle guardian with no students', async () => {
    // Mock empty guardianship
    const mockRequest = new NextRequest('http://localhost:3001/api/guardian/dashboard');
    
    const response = await guardianDashboard(mockRequest);
    const data = await response.json();

    expect(data.data.overview.total_students).toBe(0);
    expect(data.data.notifications).toHaveLength(1);
    expect(data.data.notifications[0].type).toBe('info');
  });
});