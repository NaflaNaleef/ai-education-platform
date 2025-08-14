// app/api/teacher/create-question-paper/route.ts
// UPDATED: Now supports test mode for end-to-end testing

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { aiClient } from '../../../../lib/ai/ai-client';
import { supabaseAdmin } from '../../../../lib/db/supabase';

// ✅ UPDATE IN ALL APIs - Replace old UUIDs with these:
const TEST_TEACHER_ID = '73596418-7572-485a-929d-6f9688cb8a36';
const TEST_STUDENT_ID = '87654321-4321-4321-4321-210987654321';
const TEST_CLASS_ID = 'abcdef12-abcd-4321-abcd-123456789abc';

// Helper function to safely check if Clerk is available
function isClerkAvailable() {
    return !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

// Helper function to get authenticated user
async function getAuthenticatedUser(request: NextRequest) {
    const isTestMode = process.env.NODE_ENV !== 'production' &&
        (request.headers.get('x-test-mode') === 'true' || !isClerkAvailable());

    if (isTestMode) {
        return {
            user: { id: TEST_TEACHER_ID },
            userProfile: { full_name: 'Test Teacher User', role: 'teacher' },
            isTestMode: true
        };
    }

    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { error: 'Unauthorized', status: 401 };
        }

        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('role, full_name')
            .eq('id', user.id)
            .single();

        if (profileError || userProfile?.role !== 'teacher') {
            return { error: 'Access denied. Only teachers can create question papers.', status: 403 };
        }

        return { user, userProfile, isTestMode: false };
    } catch (error) {
        console.warn('Auth check failed, falling back to test mode:', error);
        return {
            user: { id: TEST_TEACHER_ID },
            userProfile: { full_name: 'Test Teacher User', role: 'teacher' },
            isTestMode: true
        };
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log('🚀 Starting complete question paper creation flow...');

        // ✅ SMART AUTHENTICATION
        const authResult = await getAuthenticatedUser(request);
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { user, userProfile, isTestMode } = authResult;
        console.log(`${isTestMode ? '🧪' : '🔐'} Question paper creation: ${isTestMode ? 'Test Mode' : 'Production'}`);

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
        const { data: resource, error: resourceError } = await supabaseAdmin
            .from('resources')
            .select('*')
            .eq('id', resource_id)
            .eq('user_id', user.id) // Ensure teacher owns the resource
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({
                success: false,
                error: 'Resource not found or access denied',
                details: process.env.NODE_ENV !== 'production' ? resourceError?.message : undefined
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

                if (!isTestMode) {
                    const response = await fetch(resource.file_url);
                    if (response.ok) {
                        fileContent = await response.text();
                        console.log(`✅ Fetched from URL (${fileContent.length} chars)`);
                    }
                } else {
                    // Mock content for test mode
                    fileContent = `This is mock educational content about ${resource.subject} for ${resource.grade_level}. 
                    
                    Chapter 1: Introduction to ${resource.title}
                    
                    In this chapter, we will cover the fundamental concepts including:
                    1. Basic definitions and terminology
                    2. Key principles and theorems
                    3. Practical applications and examples
                    4. Problem-solving techniques
                    
                    Section 1.1: Definitions
                    [Mock content continues...]
                    
                    Section 1.2: Examples
                    [Mock examples and problems...]`;
                    console.log('🧪 Using mock content for test mode');
                }
            } catch (urlError) {
                console.error('URL fetch error:', urlError);
            }
        }
        // Try file_path
        else if (!isTestMode && resource.file_path) {
            try {
                console.log(`📂 Downloading from storage: ${resource.file_path}`);
                const supabase = createRouteHandlerClient({ cookies });
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
            if (isTestMode) {
                // Provide fallback content for testing
                fileContent = `Mock educational content for testing question generation about ${resource.title}. This covers topics in ${resource.subject} suitable for ${resource.grade_level} students.`;
                console.log('🧪 Using fallback mock content for testing');
            } else {
                return NextResponse.json({
                    success: false,
                    error: 'File content not accessible. Please ensure the file was uploaded correctly.'
                }, { status: 400 });
            }
        }

        // Step 3: AI Content Analysis
        console.log('🔍 Starting AI content analysis...');
        let analysisResult = null;
        try {
            analysisResult = await aiClient.analyzeContent({
                file_content: fileContent,
                file_type: resource.file_type || 'text/plain',
                resource_id: resource_id
            }, {
                user_id: user.id // ✅ Pass the actual user ID
            });

            if (analysisResult.success) {
                console.log(`✅ Content analysis complete: ${analysisResult.word_count} words, suitable: ${analysisResult.suitable_for_questions}`);

                // Update resource with analysis results
                await supabaseAdmin
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
        }, {
            user_id: user.id, // ✅ Pass the actual user ID
            resource_id: resource_id
        });

        if (!questionResult.success) {
            return NextResponse.json({
                success: false,
                error: 'Question generation failed',
                details: questionResult.error,
                ai_error: questionResult.error
            }, { status: 500 });
        }

        console.log(`✅ Generated ${questionResult.total_questions} questions`);

        // Step 5: Generate AI Marking Scheme
        console.log('📋 Generating AI marking scheme...');
        const markingSchemeResult = await aiClient.generateMarkingScheme(
            questionResult.questions,
            {
                user_id: user.id // ✅ Pass the actual user ID
            }
        );

        if (!markingSchemeResult.success) {
            return NextResponse.json({
                success: false,
                error: 'Marking scheme generation failed',
                details: markingSchemeResult.message || markingSchemeResult.error
            }, { status: 500 });
        }

        console.log(`✅ Generated marking scheme with ${markingSchemeResult.scheme.criteria?.length || 0} criteria`);

        // Step 6: Calculate total marks and time limit
        const total_marks = questionResult.questions.reduce((sum, q) => {
            return sum + (q.points || q.marks || 2);
        }, 0);

        const final_time_limit = time_limit || markingSchemeResult.scheme.time_limit_minutes || (questionResult.total_questions * 3);

        // Step 7: Save Question Paper to Database
        console.log('💾 Saving question paper to database...');
        const { data: questionPaper, error: insertError } = await supabaseAdmin
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
                status: 'published', // Auto-publish for testing
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
                teacher_name: questionPaper.users?.full_name || userProfile.full_name
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
            environment: process.env.NODE_ENV,
            test_mode: isTestMode,
            clerk_available: isClerkAvailable(),
            next_steps: [
                'Question paper is published and ready for assignments',
                'Create assignment to assign to classes',
                'Students can take the quiz once assigned',
                'Results will be auto-graded with AI feedback'
            ]
        });

    } catch (error) {
        console.error('💥 Question paper creation failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Question paper creation failed',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const authResult = await getAuthenticatedUser(request);
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { user, isTestMode } = authResult;

        const { searchParams } = new URL(request.url);
        const resource_id = searchParams.get('resource_id');

        if (!resource_id) {
            return NextResponse.json({
                success: false,
                error: 'resource_id is required'
            }, { status: 400 });
        }

        // Get question papers for this resource
        const { data: questionPapers, error } = await supabaseAdmin
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
            question_papers: questionPapers || [],
            environment: process.env.NODE_ENV,
            test_mode: isTestMode
        });

    } catch (error) {
        console.error('Error fetching question papers:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}