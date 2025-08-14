// tests/guardian/dashboard.test.ts
import { GET as guardianDashboard } from '../../app/api/guardian/dashboard/route';
import { NextRequest } from 'next/server';

// Disable TypeScript checking for mocks (simpler approach)
// @ts-ignore
const mockRequireRole = jest.fn((roles) => jest.fn(() => null));
// @ts-ignore  
const mockGetCurrentUser = jest.fn(() => ({ id: 'guardian-123' }));

// Mock the middleware 
jest.mock('../../../../lib/auth/middleware', () => ({
  requireRole: mockRequireRole,
  getCurrentUser: mockGetCurrentUser
}));

// Mock Supabase with simple responses
jest.mock('../../../../lib/db/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      // Default resolved promise
      then: jest.fn((callback) => callback({ 
        data: [
          {
            student_id: 'student-1',
            relationship: 'parent',
            users: { id: 'student-1', full_name: 'John Doe', grade_level: '5th' }
          }
        ], 
        error: null 
      }))
    })
  }
}));

// Mock validation utilities
jest.mock('../../../../lib/utils/validation');

describe('Guardian Dashboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks to default behavior
    mockRequireRole.mockImplementation((roles) => jest.fn(() => null));
    mockGetCurrentUser.mockReturnValue({ id: 'guardian-123' });
  });

  test('should return dashboard overview for guardian with students', async () => {
    const mockRequest = new NextRequest('http://localhost:3001/api/guardian/dashboard');

    const response = await guardianDashboard(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.overview).toBeDefined();
  });

  test('should handle guardian with no students', async () => {
    // Mock empty response for this test
    const { supabaseAdmin } = require('../../../../lib/db/supabase');
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: jest.fn((callback) => callback({ data: [], error: null }))
    });

    const mockRequest = new NextRequest('http://localhost:3001/api/guardian/dashboard');
    const response = await guardianDashboard(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.overview.total_students).toBe(0);
  });

  test('should handle notifications request', async () => {
    const mockRequest = new NextRequest('http://localhost:3001/api/guardian/dashboard?type=notifications');
    
    const response = await guardianDashboard(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.notifications).toBeDefined();
  });
});