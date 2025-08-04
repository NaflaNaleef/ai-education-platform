import request from 'supertest';
import { createServer } from 'http';
import { NextRequest, NextResponse } from 'next/server';
import { GET as healthRoute } from '../../app/api/health/route';

describe('GET /api/health', () => {
  it('should return 200 with status message', async () => {
    // Simulate calling the route handler
    const res = await healthRoute();

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(json.status).toBe('Backend is working!');
    expect(json.message).toBe('AI Education Platform Backend');
    expect(json.timestamp).toBeDefined();
  });
});
