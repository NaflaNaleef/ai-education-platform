// app/api/teacher/create-question-paper/route.ts
// Complete flow: Resource Upload → AI Analysis → Question Generation → Marking Scheme → Save to DB

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { aiClient } from '../../../../lib/ai/ai-client';
import { supabaseAdmin } from '../../../../lib/db/supabase';

export async function POST(request: NextRequest) {
    try {
        console.log('🚀 Starting complete question paper creation flow...');

        const supabase = createRouteHandlerClient({ cookies });

        // Get current user (must be teacher)
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify user is a teacher
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || userProfile?.role !== 'teacher') {
            return NextResponse.json({
                error: 'Access denied. Only teachers can create question papers.'
            }, { status: 403 });
        }

        const {
            resource_id,
            title,
            description = '',
            question_count = 10,
            difficulty_level = 'medium',
            question_types = ['multiple_choice', 'short_answer'],
            time_limit = null
        } = await request.json();

        // Validation
        if (!resource_id || !title) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: resource_id, title'
            }, { status: 400 });
        }

        console.log(`📚 Processing resource: ${resource_id} for teacher: ${user.id}`);

        // Step 1: Get resource and verify ownership
        const { data: resource, error: resourceError } = await supabase
            .from('resources')
            .select('*')
            .eq('id', resource_id)
            .eq('user_id', user.id) // Ensure teacher owns the resource
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({
                success: false,
                error: 'Resource not found or access denied'
            }, { status: 404 });
        }

        console.log(`✅ Resource found: ${resource.title}`);

        // Step 2: Get file content
        let fileContent = '';

        // Try content_preview first
        if (resource.content_preview && resource.content_preview.length > 100) {
            fileContent = resource.content_preview;
            console.log(`✅ Using content_preview (${fileContent.length} chars)`);
        }
        // Try file_url
        else if (resource.file_url && resource.file_url.startsWith('http')) {
            try {
                console.log(`🌐 Fetching from URL: ${resource.file_url}`);
                const response = await fetch(resource.file_url);
                if (response.ok) {
                    fileContent = await response.text();
                    console.log(`✅ Fetched from URL (${fileContent.length} chars)`);
                }
            } catch (urlError) {
                console.error('URL fetch error:', urlError);
            }
        }
        // Try file_path
        else if (resource.file_path) {
            try {
                console.log(`📂 Downloading from storage: ${resource.file_path}`);
                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('resources')
                    .download(resource.file_path);

                if (!downloadError && fileData) {
                    fileContent = await fileData.text();
                    console.log(`✅ Downloaded from storage (${fileContent.length} chars)`);
                }
            } catch (storageError) {
                console.error('Storage error:', storageError);
            }
        }

        if (!fileContent || fileContent.length < 50) {
            return NextResponse.json({
                success: false,
                error: 'File content not accessible. Please ensure the file was uploaded correctly.'
            }, { status: 400 });
        }

        // Step 3: AI Content Analysis
        console.log('🔍 Starting AI content analysis...');
        let analysisResult = null;
        try {
            analysisResult = await aiClient.analyzeContent({
                file_content: fileContent,
                file_type: resource.file_type || 'txt',
                resource_id: resource_id
            });

            if (analysisResult.success) {
                console.log(`✅ Content analysis complete: ${analysisResult.word_count} words, suitable: ${analysisResult.suitable_for_questions}`);

                // Update resource with analysis results
                await supabase
                    .from('resources')
                    .update({
                        analysis_result: analysisResult,
                        analyzed_at: new Date().toISOString()
                    })
                    .eq('id', resource_id);
            }
        } catch (analysisError) {
            console.warn('⚠️ Content analysis failed, continuing with question generation:', analysisError);
        }

        // Step 4: Generate Questions with AI
        console.log('🤖 Generating questions with AI...');
        const questionResult = await aiClient.generateQuestions({
            content: fileContent,
            question_count: question_count,
            difficulty_level: difficulty_level,
            question_types: question_types
        });

        if (!questionResult.success) {
            return NextResponse.json({
                success: false,
                error: 'Question generation failed',
                details: questionResult.error
            }, { status: 500 });
        }

        console.log(`✅ Generated ${questionResult.total_questions} questions`);

        // Step 5: Generate AI Marking Scheme
        console.log('📋 Generating AI marking scheme...');
        const markingSchemeResult = await aiClient.generateMarkingScheme(
            questionResult.questions
        );

        if (!markingSchemeResult.success) {
            return NextResponse.json({
                success: false,
                error: 'Marking scheme generation failed',
                details: markingSchemeResult.message
            }, { status: 500 });
        }

        console.log(`✅ Generated marking scheme with ${markingSchemeResult.scheme.criteria?.length || 0} criteria`);

        // Log AI usage for marking scheme generation
        try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/usage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    service_type: 'marking_scheme',
                    tokens_used: (markingSchemeResult as any).tokens_used || 0,
                    cost_usd: (markingSchemeResult as any).cost_usd || 0,
                    question_paper_id: `qp_${Date.now()}`,
                    resource_id: resource_id
                }),
            });
        } catch (usageError) {
            console.warn('⚠️ Failed to log AI usage for marking scheme generation:', usageError);
        }

        // Step 6: Calculate total marks and time limit
        const total_marks = questionResult.questions.reduce((sum, q) => {
            return sum + (q.points || q.marks || 2);
        }, 0);

        const final_time_limit = time_limit || markingSchemeResult.scheme.time_limit_minutes || (questionResult.total_questions * 3);

        // Step 7: Save Question Paper to Database
        console.log('💾 Saving question paper to database...');
        const { data: questionPaper, error: insertError } = await supabase
            .from('question_papers')
            .insert({
                resource_id: resource_id,
                teacher_id: user.id,
                title: title,
                description: description,
                content: questionResult.questions, // Store questions in content field
                marking_scheme: markingSchemeResult.scheme, // Store AI-generated marking scheme
                total_marks: total_marks,
                time_limit: final_time_limit,
                difficulty_level: difficulty_level,
                status: 'draft', // Default to draft
                ai_generated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select(`
                *,
                resources(title, description),
                users!question_papers_teacher_id_fkey(full_name)
            `)
            .single();

        if (insertError) {
            console.error('Database insert error:', insertError);
            return NextResponse.json({
                success: false,
                error: 'Failed to save question paper',
                details: insertError.message
            }, { status: 500 });
        }

        console.log(`✅ Question paper saved successfully: ${questionPaper.id}`);

        // Step 8: Return complete result
        return NextResponse.json({
            success: true,
            message: `Question paper "${title}" created successfully with ${questionResult.total_questions} questions`,
            question_paper: {
                id: questionPaper.id,
                resource_id: questionPaper.resource_id,
                teacher_id: questionPaper.teacher_id,
                title: questionPaper.title,
                description: questionPaper.description,
                total_questions: questionResult.total_questions,
                total_marks: total_marks,
                time_limit: final_time_limit,
                difficulty_level: questionPaper.difficulty_level,
                status: questionPaper.status,
                created_at: questionPaper.created_at,
                resource_title: questionPaper.resources?.title || resource.title,
                teacher_name: questionPaper.users?.full_name || user.email
            },
            ai_generation: {
                questions_generated: questionResult.total_questions,
                marking_scheme_generated: true,
                ai_generated_scheme: markingSchemeResult.scheme.ai_generated || false,
                generation_time: questionResult.generation_time,
                content_analysis: analysisResult ? {
                    word_count: analysisResult.word_count,
                    suitable_for_questions: analysisResult.suitable_for_questions,
                    content_type: analysisResult.content_type
                } : null
            },
            next_steps: [
                'Review and edit questions if needed',
                'Publish the question paper when ready',
                'Share with students for taking the quiz',
                'Monitor submissions and results'
            ]
        });

    } catch (error) {
        console.error('💥 Question paper creation failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Question paper creation failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const resource_id = searchParams.get('resource_id');

        if (!resource_id) {
            return NextResponse.json({
                success: false,
                error: 'resource_id is required'
            }, { status: 400 });
        }

        // Get question papers for this resource
        const { data: questionPapers, error } = await supabase
            .from('question_papers')
            .select(`
                *,
                resources(title, description),
                users!question_papers_teacher_id_fkey(full_name)
            `)
            .eq('resource_id', resource_id)
            .eq('teacher_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch question papers',
                details: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            question_papers: questionPapers || []
        });

    } catch (error) {
        console.error('Error fetching question papers:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
} 