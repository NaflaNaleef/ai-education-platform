// app/api/question-paper/route.ts
// COMPLETE VERSION - Adds POST method for Day 9

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/db/supabase';
import { authMiddleware, requireRole, getCurrentUser } from '../../../lib/auth/middleware';

// GET method (you already have this - retrieve question papers)
export async function GET(request: NextRequest) {
    // Check if this is a test request (bypass auth for testing)
    const isTestMode = request.headers.get('x-test-mode') === 'true';

    if (!isTestMode) {
        // --- AUTH ---
        const authResult = await authMiddleware(request);
        if (authResult instanceof NextResponse) return authResult;
    }

    try {
        const { searchParams } = new URL(request.url);
        const resource_id = searchParams.get('resource_id');
        const teacher_id = searchParams.get('teacher_id');

        if (!resource_id && !teacher_id) {
            return NextResponse.json({
                success: false,
                error: 'resource_id or teacher_id required'
            }, { status: 400 });
        }

        let query = supabaseAdmin
            .from('question_papers')
            .select(`
                *,
                resources(title, description, file_type),
                users(full_name, email)
            `);

        if (resource_id) query = query.eq('resource_id', resource_id);
        if (teacher_id) query = query.eq('teacher_id', teacher_id);

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            question_papers: data || []
        });

    } catch (error) {
        console.error('Error fetching question papers:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// POST method (NEW - Day 9 functionality)
export async function POST(request: NextRequest) {
    // Check if this is a test request (bypass auth for testing)
    const isTestMode = request.headers.get('x-test-mode') === 'true';

    if (!isTestMode) {
        // --- AUTH ---
        const authResult = await authMiddleware(request);
        if (authResult instanceof NextResponse) return authResult;
        const roleResult = requireRole(['teacher'])(request);
        if (roleResult instanceof NextResponse) return roleResult;
    }

    try {
        const {
            resource_id,
            teacher_id,
            title,
            description,
            questions,
            difficulty_level = 'medium',
            time_limit,
            marking_scheme
        } = await request.json();

        // Validation
        if (!resource_id || !teacher_id || !title || !questions) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: resource_id, teacher_id, title, questions'
            }, { status: 400 });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Questions must be a non-empty array'
            }, { status: 400 });
        }

        console.log(`📝 Creating question paper: ${title} with ${questions.length} questions`);

        // Calculate total marks from questions
        const total_marks = questions.reduce((sum, q) => {
            return sum + (q.points || q.marks || 2);
        }, 0);

        // Generate marking scheme if not provided
        let finalMarkingScheme = marking_scheme;
        if (!finalMarkingScheme) {
            finalMarkingScheme = {
                total_points: total_marks,
                total_questions: questions.length,
                time_limit_minutes: time_limit || (questions.length * 3), // 3 minutes per question default
                question_breakdown: {
                    multiple_choice: questions.filter(q => q.type === 'multiple_choice').length,
                    short_answer: questions.filter(q => q.type === 'short_answer').length,
                    essay: questions.filter(q => q.type === 'essay').length
                },
                grading_instructions: {
                    multiple_choice: "Award full points for correct answer",
                    short_answer: "Award partial credit for partially correct answers",
                    essay: "Use rubric to evaluate key points"
                }
            };
        }

        // Verify resource exists
        const { data: resource, error: resourceError } = await supabaseAdmin
            .from('resources')
            .select('id, title')
            .eq('id', resource_id)
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({
                success: false,
                error: 'Resource not found',
                resource_id: resource_id
            }, { status: 404 });
        }

        // Verify teacher exists (optional - you might want to skip this check)
        const { data: teacher, error: teacherError } = await supabaseAdmin
            .from('users')
            .select('id, full_name, role')
            .eq('id', teacher_id)
            .single();

        if (teacherError || !teacher) {
            console.log(`⚠️ Teacher not found: ${teacher_id}, proceeding anyway`);
        } else if (teacher.role !== 'teacher') {
            console.log(`⚠️ User ${teacher_id} is not a teacher, role: ${teacher.role}`);
        }

        // Insert question paper
        const { data: questionPaper, error: insertError } = await supabaseAdmin
            .from('question_papers')
            .insert({
                resource_id,
                teacher_id,
                title,
                description: description || '',
                content: questions, // Store questions in content field (matches your schema)
                marking_scheme: finalMarkingScheme,
                total_marks,
                time_limit: time_limit || (questions.length * 3),
                difficulty_level,
                status: 'draft', // Default to draft
                ai_generated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('Database insert error:', insertError);
            return NextResponse.json({
                success: false,
                error: 'Failed to create question paper',
                details: insertError.message
            }, { status: 500 });
        }

        console.log(`✅ Question paper created successfully: ${questionPaper.id}`);

        return NextResponse.json({
            success: true,
            question_paper: {
                id: questionPaper.id,
                resource_id: questionPaper.resource_id,
                teacher_id: questionPaper.teacher_id,
                title: questionPaper.title,
                description: questionPaper.description,
                total_questions: questions.length,
                total_marks: total_marks,
                time_limit: questionPaper.time_limit,
                difficulty_level: questionPaper.difficulty_level,
                status: questionPaper.status,
                created_at: questionPaper.created_at,
                resource_title: resource.title,
                teacher_name: teacher?.full_name || 'Unknown'
            },
            message: 'Question paper created successfully'
        });

    } catch (error) {
        console.error('Question paper creation failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Question paper creation failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// PUT method (Optional - for updating question papers)
export async function PUT(request: NextRequest) {
    // --- AUTH ---
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) return authResult;
    const roleResult = requireRole(['teacher'])(request);
    if (roleResult instanceof NextResponse) return roleResult;

    try {
        const { searchParams } = new URL(request.url);
        const questionPaperId = searchParams.get('id');

        if (!questionPaperId) {
            return NextResponse.json({
                success: false,
                error: 'Question paper ID is required'
            }, { status: 400 });
        }

        const updateData = await request.json();

        // Remove fields that shouldn't be updated
        const allowedFields = [
            'title', 'description', 'content', 'marking_scheme',
            'total_marks', 'time_limit', 'difficulty_level', 'status'
        ];

        const filteredData = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updateData[key];
                return obj;
            }, {} as any);

        filteredData.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('question_papers')
            .update(filteredData)
            .eq('id', questionPaperId)
            .select()
            .single();

        if (error) {
            return NextResponse.json({
                success: false,
                error: 'Failed to update question paper',
                details: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            question_paper: data,
            message: 'Question paper updated successfully'
        });

    } catch (error) {
        console.error('Question paper update failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Question paper update failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// DELETE method (Optional - for deleting question papers)
export async function DELETE(request: NextRequest) {
    // --- AUTH ---
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) return authResult;
    const roleResult = requireRole(['teacher'])(request);
    if (roleResult instanceof NextResponse) return roleResult;

    try {
        const { searchParams } = new URL(request.url);
        const questionPaperId = searchParams.get('id');

        if (!questionPaperId) {
            return NextResponse.json({
                success: false,
                error: 'Question paper ID is required'
            }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('question_papers')
            .delete()
            .eq('id', questionPaperId);

        if (error) {
            return NextResponse.json({
                success: false,
                error: 'Failed to delete question paper',
                details: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Question paper deleted successfully'
        });

    } catch (error) {
        console.error('Question paper deletion failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Question paper deletion failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}