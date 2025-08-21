// app/api/question-paper/[id]/route.ts
// REFACTORED: Using centralized auth middleware

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { requireTeacherOrStudent, requireTeacher, getCurrentUser } from '../../../../lib/auth/middleware';

// ===============================================================================
// 📄 GET QUESTION PAPER HANDLER
// ===============================================================================
async function getQuestionPaperHandler(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser(request)!;
        const questionPaperId = params.id;

        if (!questionPaperId) {
            return NextResponse.json({
                success: false,
                error: 'Question paper ID is required'
            }, { status: 400 });
        }

        console.log(`🔍 Fetching question paper: ${questionPaperId} for ${user.role}: ${user.full_name}`);

        // Get question paper with related data
        const { data: questionPaper, error } = await supabaseAdmin
            .from('question_papers')
            .select(`
                *,
                resources(
                    id,
                    title,
                    description,
                    file_type,
                    subject,
                    grade_level
                ),
                users(
                    id,
                    full_name,
                    email
                )
            `)
            .eq('id', questionPaperId)
            .single();

        if (error || !questionPaper) {
            console.error('Database error:', error);
            return NextResponse.json({
                success: false,
                error: 'Question paper not found',
                details: error?.message
            }, { status: 404 });
        }

        // Role-based access control
        if (user.role === 'teacher' && questionPaper.teacher_id !== user.id) {
            return NextResponse.json({
                success: false,
                error: 'Access denied. You can only view your own question papers.'
            }, { status: 403 });
        }

        console.log(`✅ Question paper found: ${questionPaper.title}`);

        // Format response for frontend
        return NextResponse.json({
            success: true,
            question_paper: {
                id: questionPaper.id,
                title: questionPaper.title,
                description: questionPaper.description,
                total_questions: Array.isArray(questionPaper.content) ? questionPaper.content.length : 0,
                total_marks: questionPaper.total_marks,
                time_limit: questionPaper.time_limit,
                difficulty_level: questionPaper.difficulty_level,
                status: questionPaper.status,
                questions: questionPaper.content || [],
                marking_scheme: questionPaper.marking_scheme,
                
                // Related data
                resource: questionPaper.resources ? {
                    id: questionPaper.resources.id,
                    title: questionPaper.resources.title,
                    description: questionPaper.resources.description,
                    file_type: questionPaper.resources.file_type,
                    subject: questionPaper.resources.subject,
                    grade_level: questionPaper.resources.grade_level
                } : null,
                
                teacher: questionPaper.users ? {
                    id: questionPaper.users.id,
                    name: questionPaper.users.full_name,
                    email: questionPaper.users.email
                } : null,
                
                // Metadata
                created_at: questionPaper.created_at,
                updated_at: questionPaper.updated_at,
                ai_generated_at: questionPaper.ai_generated_at
            },
            user: {
                role: user.role,
                name: user.full_name,
                test_mode: user.isTestMode
            }
        });

    } catch (error) {
        console.error('Question paper fetch error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// ===============================================================================
// ✏️ UPDATE QUESTION PAPER HANDLER
// ===============================================================================
async function updateQuestionPaperHandler(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser(request)!;
        const questionPaperId = params.id;
        const updateData = await request.json();

        // Verify ownership
        const { data: existingPaper, error: ownershipError } = await supabaseAdmin
            .from('question_papers')
            .select('teacher_id')
            .eq('id', questionPaperId)
            .single();

        if (ownershipError || !existingPaper || existingPaper.teacher_id !== user.id) {
            return NextResponse.json({
                success: false,
                error: 'Question paper not found or access denied'
            }, { status: 404 });
        }

        // Allowed fields for update
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

        console.log(`✅ Question paper updated: ${data.title} by ${user.full_name}`);

        return NextResponse.json({
            success: true,
            question_paper: data,
            message: 'Question paper updated successfully',
            updated_by: user.full_name,
            test_mode: user.isTestMode
        });

    } catch (error) {
        console.error('Question paper update error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// ===============================================================================
// 🗑️ DELETE QUESTION PAPER HANDLER
// ===============================================================================
async function deleteQuestionPaperHandler(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser(request)!;
        const questionPaperId = params.id;

        // Verify ownership
        const { data: existingPaper, error: ownershipError } = await supabaseAdmin
            .from('question_papers')
            .select('teacher_id, title')
            .eq('id', questionPaperId)
            .single();

        if (ownershipError || !existingPaper || existingPaper.teacher_id !== user.id) {
            return NextResponse.json({
                success: false,
                error: 'Question paper not found or access denied'
            }, { status: 404 });
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

        console.log(`✅ Question paper deleted: ${existingPaper.title} by ${user.full_name}`);

        return NextResponse.json({
            success: true,
            message: 'Question paper deleted successfully',
            deleted_title: existingPaper.title,
            deleted_by: user.full_name,
            test_mode: user.isTestMode
        });

    } catch (error) {
        console.error('Question paper delete error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireTeacherOrStudent(getQuestionPaperHandler);
export const PUT = requireTeacher(updateQuestionPaperHandler);
export const DELETE = requireTeacher(deleteQuestionPaperHandler);