// app/api/question-paper/route.ts
// REFACTORED: Using centralized auth middleware

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/db/supabase';
import { requireTeacherOrStudent, requireTeacher, getCurrentUser } from '../../../lib/auth/middleware';

// ===============================================================================
// 📋 GET QUESTION PAPERS HANDLER
// ===============================================================================
async function getQuestionPapersHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        
        const { searchParams } = new URL(request.url);
        const resource_id = searchParams.get('resource_id');
        const teacher_id = searchParams.get('teacher_id');

        console.log(`📋 Getting question papers for ${user.role}: ${user.full_name}`);

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

        // Role-based filtering
        if (user.role === 'teacher') {
            query = query.eq('teacher_id', user.id);
        } else if (user.role === 'student') {
            query = query.eq('status', 'published');
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        console.log(`✅ Found ${data?.length || 0} question papers for ${user.role}`);

        return NextResponse.json({
            success: true,
            question_papers: data || [],
            user: {
                role: user.role,
                name: user.full_name,
                test_mode: user.isTestMode
            }
        });

    } catch (error) {
        console.error('Error fetching question papers:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// ===============================================================================
// 📝 CREATE QUESTION PAPER HANDLER
// ===============================================================================
async function createQuestionPaperHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`📝 Creating question paper for teacher: ${user.full_name}`);

        const {
            resource_id,
            teacher_id = user.id,
            title,
            description,
            questions,
            difficulty_level = 'medium',
            time_limit,
            marking_scheme
        } = await request.json();

        // Validation
        if (!resource_id || !title || !questions) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: resource_id, title, questions'
            }, { status: 400 });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Questions must be a non-empty array'
            }, { status: 400 });
        }

        // Ensure teacher can only create for themselves
        if (teacher_id !== user.id) {
            return NextResponse.json({
                success: false,
                error: 'Access denied. You can only create question papers for yourself.'
            }, { status: 403 });
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
                time_limit_minutes: time_limit || (questions.length * 3),
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

        // Verify resource exists and user owns it
        const { data: resource, error: resourceError } = await supabaseAdmin
            .from('resources')
            .select('id, title, user_id')
            .eq('id', resource_id)
            .eq('user_id', user.id)
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({
                success: false,
                error: 'Resource not found or access denied',
                resource_id: resource_id
            }, { status: 404 });
        }

        // Insert question paper
        const { data: questionPaper, error: insertError } = await supabaseAdmin
            .from('question_papers')
            .insert({
                resource_id,
                teacher_id: user.id,
                title,
                description: description || '',
                content: questions,
                marking_scheme: finalMarkingScheme,
                total_marks,
                time_limit: time_limit || (questions.length * 3),
                difficulty_level,
                status: 'draft',
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
                teacher_name: user.full_name
            },
            message: 'Question paper created successfully',
            created_by: user.full_name,
            test_mode: user.isTestMode
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

// ===============================================================================
// ✏️ UPDATE QUESTION PAPER HANDLER
// ===============================================================================
async function updateQuestionPaperHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        
        const { searchParams } = new URL(request.url);
        const questionPaperId = searchParams.get('id');

        if (!questionPaperId) {
            return NextResponse.json({
                success: false,
                error: 'Question paper ID is required'
            }, { status: 400 });
        }

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

        console.log(`✅ Question paper updated: ${data.title} by ${user.full_name}`);

        return NextResponse.json({
            success: true,
            question_paper: data,
            message: 'Question paper updated successfully',
            updated_by: user.full_name,
            test_mode: user.isTestMode
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

// ===============================================================================
// 🗑️ DELETE QUESTION PAPER HANDLER
// ===============================================================================
async function deleteQuestionPaperHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        
        const { searchParams } = new URL(request.url);
        const questionPaperId = searchParams.get('id');

        if (!questionPaperId) {
            return NextResponse.json({
                success: false,
                error: 'Question paper ID is required'
            }, { status: 400 });
        }

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
        console.error('Question paper deletion failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Question paper deletion failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireTeacherOrStudent(getQuestionPapersHandler);
export const POST = requireTeacher(createQuestionPaperHandler);
export const PUT = requireTeacher(updateQuestionPaperHandler);
export const DELETE = requireTeacher(deleteQuestionPaperHandler);