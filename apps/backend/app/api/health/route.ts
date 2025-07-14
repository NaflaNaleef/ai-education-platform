import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'Backend is working!',
        timestamp: new Date().toISOString(),
        message: 'AI Education Platform Backend'
    });
} 