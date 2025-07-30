// app/api/ai/generate-questions/route.ts
// FIXED VERSION - Handles both file_url and file_path scenarios

import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '../../../../lib/ai/ai-client';
import { supabaseAdmin as supabase } from '../../../../lib/db/supabase';

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

        console.log(`🔍 Looking for resource: ${resourceId}`);

        // Get resource and its content
        const { data: resource, error } = await supabase
            .from('resources')
            .select('*')
            .eq('id', resourceId)
            .single();

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: 'Resource not found', details: error.message },
                { status: 404 }
            );
        }

        if (!resource) {
            return NextResponse.json(
                { error: 'Resource not found' },
                { status: 404 }
            );
        }

        console.log(`✅ Found resource: ${resource.title}`);
        console.log(`📁 Available fields:`, Object.keys(resource));

        // Get file content - try multiple methods
        let fileContent = '';

        // Method 1: Try content_preview first (fastest)
        if (resource.content_preview && resource.content_preview.length > 100) {
            fileContent = resource.content_preview;
            console.log(`✅ Using content_preview (${fileContent.length} chars)`);
        }
        // Method 2: Try direct URL fetch if file_url exists
        else if (resource.file_url && resource.file_url.startsWith('http')) {
            try {
                console.log(`🌐 Fetching from URL: ${resource.file_url}`);
                const response = await fetch(resource.file_url);
                if (response.ok) {
                    fileContent = await response.text();
                    console.log(`✅ Fetched from URL (${fileContent.length} chars)`);
                } else {
                    console.error(`❌ URL fetch failed: ${response.status}`);
                }
            } catch (urlError) {
                console.error('URL fetch error:', urlError);
            }
        }
        // Method 3: Try Supabase storage download if file_path exists
        else if (resource.file_path) {
            try {
                console.log(`📂 Downloading from storage: ${resource.file_path}`);
                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('resources')
                    .download(resource.file_path);

                if (downloadError) {
                    console.error('Storage download error:', downloadError);
                } else if (fileData) {
                    fileContent = await fileData.text();
                    console.log(`✅ Downloaded from storage (${fileContent.length} chars)`);
                }
            } catch (storageError) {
                console.error('Storage error:', storageError);
            }
        }

        // Check if we got content
        if (!fileContent || fileContent.length < 50) {
            console.error('❌ No valid file content found');
            return NextResponse.json(
                { 
                    error: 'File content not accessible',
                    debug_info: {
                        has_content_preview: !!resource.content_preview,
                        has_file_url: !!resource.file_url,
                        has_file_path: !!resource.file_path,
                        content_preview_length: resource.content_preview?.length || 0,
                        file_url: resource.file_url,
                        file_path: resource.file_path
                    }
                },
                { status: 404 }
            );
        }

        console.log(`🤖 Generating questions with AI service...`);

        // Generate questions using AI service
        const questionResult = await aiClient.generateQuestions({
            content: fileContent,
            question_count: questionCount,
            difficulty_level: difficultyLevel,
            question_types: questionTypes
        });

        console.log(`✅ Question generation complete`);

        return NextResponse.json({
            success: true,
            resource_id: resourceId,
            resource_title: resource.title,
            content_length: fileContent.length,
            questions: questionResult
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Question generation failed:', error);
        
        return NextResponse.json(
            { 
                error: 'Question generation failed', 
                details: message,
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

// Add GET handler for debugging
export async function GET(request: NextRequest) {
    return NextResponse.json({
        message: "Question Generation API is running",
        method_allowed: "POST",
        example_request: {
            resourceId: "your-resource-uuid",
            questionCount: 3,
            difficultyLevel: "medium",
            questionTypes: ["multiple_choice", "short_answer"]
        }
    });
}