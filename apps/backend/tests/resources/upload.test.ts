// tests/upload/upload.test.ts
import { POST as uploadRoute } from '@/app/api/resources/upload/route';
import { NextRequest } from 'next/server';

// Mock Supabase
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => ({
    auth: {
      getUser: () => Promise.resolve({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      })
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({
          data: { path: 'user-123/1234567890-test.pdf' },
          error: null
        }),
        getPublicUrl: () => ({
          data: { publicUrl: 'https://storage.supabase.co/test.pdf' }
        })
      })
    },
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({
            data: {
              id: 'resource-123',
              title: 'Test Document',
              file_url: 'https://storage.supabase.co/test.pdf'
            },
            error: null
          })
        })
      })
    })
  })
}));

describe('File Upload API', () => {
  it('should handle JSON upload request', async () => {
    const requestBody = {
      title: 'Test Document',
      description: 'Test description',
      file_url: 'https://example.com/test.pdf',
      file_type: 'application/pdf',
      user_id: '550e8400-e29b-41d4-a716-446655440000'
    };

    const mockRequest = new NextRequest('http://localhost:3001/api/upload', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await uploadRoute(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Resource created successfully');
    expect(data.resource.title).toBe('Test Document');
  });

  it('should validate required fields', async () => {
    const requestBody = { title: 'Test' }; // Missing required fields

    const mockRequest = new NextRequest('http://localhost:3001/api/upload', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await uploadRoute(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });
});