import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '@lib/ai/ai-client';

export async function GET() {
    try {
        const isConnected = await aiClient.testConnection();

        if (isConnected) {
            return NextResponse.json({
                success: true,
                message: 'AI service connection successful',
                status: 'connected'
            });
        } else {
            return NextResponse.json({
                success: false,
                message: 'AI service connection failed',
                status: 'disconnected'
            }, { status: 503 });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            success: false,
            message: 'AI service connection error',
            error: message,
            status: 'error'
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const result = await aiClient.testAiConnection({
            ...body,
            test_from: 'Next.js API Route',
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            ai_response: result
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            success: false,
            message: 'AI test connection failed',
            error: message
        }, { status: 500 });
    }
} 