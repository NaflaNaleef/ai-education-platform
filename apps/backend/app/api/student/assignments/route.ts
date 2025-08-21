// app/api/student/assignments/route.ts
// REFACTORED: Using centralized auth middleware

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { requireStudent, getCurrentUser } from '../../../../lib/auth/middleware';

// ===============================================================================
// 📚 GET STUDENT ASSIGNMENTS HANDLER
// ===============================================================================
async function getStudentAssignmentsHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;

        const { searchParams } = new URL(request.url);
        const student_id = searchParams.get('student_id') || user.id;
        const status = searchParams.get('status') || 'all'; // 'available', 'completed', 'all'
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Verify user can access this student's data
        if (student_id !== user.id) {
            return NextResponse.json({
                error: 'Access denied - can only view your own assignments'
            }, { status: 403 });
        }

        console.log(`📚 Getting assignments for student: ${user.full_name}, status: ${status}`);

        // Get all published question papers (available assignments)
        const { data: allAssignments, error: assignmentsError } = await supabaseAdmin
            .from('question_papers')
            .select(`
                id,
                title,
                description,
                total_marks,
                time_limit,
                difficulty_level,
                created_at,
                status,
                teacher_id,
                users!question_papers_teacher_id_fkey(full_name, email)
            `)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (assignmentsError) {
            console.error('Error fetching assignments:', assignmentsError);
            return NextResponse.json({
                error: 'Failed to fetch assignments',
                details: process.env.NODE_ENV !== 'production' ? assignmentsError.message : undefined
            }, { status: 500 });
        }

        // Get student's submissions to determine completion status
        const { data: submissions, error: submissionsError } = await supabaseAdmin
            .from('submissions')
            .select(`
                id,
                question_paper_id,
                submitted_at,
                time_taken,
                status,
                total_questions,
                answered_questions,
                results(
                    id,
                    total_score,
                    max_score,
                    percentage,
                    grade,
                    graded_at
                )
            `)
            .eq('student_id', student_id);

        if (submissionsError) {
            console.error('Error fetching submissions:', submissionsError);
        }

        // Create a map of submissions by question_paper_id for quick lookup
        const submissionMap = new Map();
        (submissions || []).forEach(sub => {
            submissionMap.set(sub.question_paper_id, sub);
        });

        // Process assignments and add completion status
        let processedAssignments = (allAssignments || []).map(assignment => {
            const submission = submissionMap.get(assignment.id);
            const isCompleted = !!submission;
            const result = submission?.results?.[0];

            return {
                id: assignment.id,
                title: assignment.title,
                description: assignment.description,
                total_marks: assignment.total_marks,
                time_limit: assignment.time_limit,
                difficulty_level: assignment.difficulty_level,
                created_at: assignment.created_at,
                teacher: {
                    name: assignment.users?.[0]?.full_name || 'Unknown Teacher',
                    email: assignment.users?.[0]?.email
                },
                status: isCompleted ? 'completed' : 'available',
                completion: isCompleted ? {
                    submission_id: submission.id,
                    submitted_at: submission.submitted_at,
                    time_taken: submission.time_taken,
                    questions_answered: `${submission.answered_questions}/${submission.total_questions}`,
                    grading_status: submission.status,
                    score: result ? {
                        points: `${result.total_score}/${result.max_score}`,
                        percentage: result.percentage,
                        grade: result.grade,
                        graded_at: result.graded_at
                    } : null
                } : null
            };
        });

        // Filter by status if specified
        if (status === 'available') {
            processedAssignments = processedAssignments.filter(a => a.status === 'available');
        } else if (status === 'completed') {
            processedAssignments = processedAssignments.filter(a => a.status === 'completed');
        }

        // Apply pagination
        const totalAssignments = processedAssignments.length;
        const paginatedAssignments = processedAssignments.slice(offset, offset + limit);

        // Calculate summary statistics
        const availableCount = processedAssignments.filter(a => a.status === 'available').length;
        const completedCount = processedAssignments.filter(a => a.status === 'completed').length;
        const completedWithScores = processedAssignments.filter(a =>
            a.status === 'completed' && a.completion?.score?.percentage !== null
        );
        const averageScore = completedWithScores.length > 0
            ? (completedWithScores.reduce((sum, a) => sum + (a.completion?.score?.percentage || 0), 0) / completedWithScores.length).toFixed(1)
            : null;

        console.log(`✅ Found ${totalAssignments} assignments for ${user.full_name} (${availableCount} available, ${completedCount} completed)`);

        return NextResponse.json({
            success: true,
            assignments: {
                student_id,
                student_name: user.full_name,
                status_filter: status,
                pagination: {
                    total: totalAssignments,
                    offset,
                    limit,
                    has_more: offset + limit < totalAssignments
                },
                summary: {
                    total_assignments: totalAssignments,
                    available: availableCount,
                    completed: completedCount,
                    completion_rate: totalAssignments > 0 ? `${((completedCount / totalAssignments) * 100).toFixed(1)}%` : '0%',
                    average_score: averageScore ? `${averageScore}%` : 'No scores yet'
                },
                assignments: paginatedAssignments
            },
            user: {
                name: user.full_name,
                test_mode: user.isTestMode
            }
        });

    } catch (error) {
        console.error('💥 Student assignments error:', error);
        return NextResponse.json({
            error: 'Failed to load assignments',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// 📋 GET ASSIGNMENT OPTIONS INFO
// ===============================================================================
function getAssignmentOptionsHandler() {
    return NextResponse.json({
        endpoint: 'Student Assignments',
        methods: ['GET'],
        description: 'Get all assignments/quizzes available to a student',
        authentication: 'Required - Automatic (Clerk or Test Mode)',
        query_parameters: {
            student_id: 'Optional - defaults to authenticated user',
            status: 'Optional - filter by "available", "completed", or "all" (default)',
            limit: 'Optional - number of results (default: 50)',
            offset: 'Optional - pagination offset (default: 0)'
        },
        response_includes: [
            'Assignment details',
            'Completion status',
            'Scores and grading info',
            'Teacher information',
            'Summary statistics'
        ],
        test_mode: {
            description: 'Automatically enabled when Clerk is not configured',
            headers: {
                'x-test-mode': 'true (optional - auto-detected)',
                'x-test-student': 'student-id (optional - defaults to TEST_STUDENT_ID)'
            }
        }
    });
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireStudent(getStudentAssignmentsHandler);
export const OPTIONS = getAssignmentOptionsHandler;