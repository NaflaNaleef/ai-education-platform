import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '@lib/ai/ai-client';
import { supabaseAdmin as supabase } from '@lib/db/supabase';

export async function POST(request: NextRequest) {
    try {
        const {
            resourceId,
            questionCount = 10,
            difficultyLevel = 'medium',
            questionTypes = ['multiple_choice', 'short_answer']
        } = await request.json();

        if (!resourceId) {
            return NextResponse.json(
                { error: 'Resource ID is required' },
                { status: 400 }
            );
        }

        // Get resource and its content
        const { data: resource, error } = await supabase
            .from('resources')
            .select('*')
            .eq('id', resourceId)
            .single();

        if (error || !resource) {
            return NextResponse.json(
                { error: 'Resource not found' },
                { status: 404 }
            );
        }

        // Get file content
        const { data: fileData } = await supabase.storage
            .from('resources')
            .download(resource.file_path);

        if (!fileData) {
            return NextResponse.json(
                { error: 'File content not found' },
                { status: 404 }
            );
        }

        const fileContent = await fileData.text();

        // Generate questions using AI service
        const questionResult = await aiClient.generateQuestions({
            content: fileContent,
            question_count: questionCount,
            difficulty_level: difficultyLevel,
            question_types: questionTypes
        });

        // For Day 6-7: This will return a "pending" response
        // For Day 8+: This will return actual generated questions

        return NextResponse.json({
            success: true,
            resource_id: resourceId,
            questions: questionResult
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Question generation failed:', error);
        return NextResponse.json(
            { error: 'Question generation failed', details: message },
            { status: 500 }
        );
    }
} 