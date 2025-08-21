// app/api/student/dashboard/route.ts
// REFACTORED: Using centralized auth middleware

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { requireStudent, getCurrentUser } from '../../../../lib/auth/middleware';

// ===============================================================================
// 📊 GET STUDENT DASHBOARD HANDLER
// ===============================================================================
async function getStudentDashboardHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;

        const { searchParams } = new URL(request.url);
        const student_id = searchParams.get('student_id') || user.id;

        console.log(`📊 Getting dashboard for student: ${user.full_name}`);

        // Verify user can access this student's data (must be same user)
        if (student_id !== user.id) {
            return NextResponse.json({
                error: 'Access denied - can only view your own dashboard'
            }, { status: 403 });
        }

        // Type-safe helper for handling Supabase join responses
        const extractQuestionPaper = (qp: any) => {
            return Array.isArray(qp) ? qp[0] : qp;
        };

        const extractTeacherName = (users: any): string => {
            if (Array.isArray(users) && users.length > 0) {
                return users[0].full_name || 'Unknown Teacher';
            }
            if (users && typeof users === 'object' && 'full_name' in users) {
                return users.full_name || 'Unknown Teacher';
            }
            return 'Unknown Teacher';
        };

        // Get student's enrollments first
        const { data: enrollments, error: enrollError } = await supabaseAdmin
            .from('enrollments')
            .select('class_id')
            .eq('student_id', student_id)
            .eq('status', 'active');

        if (enrollError) {
            console.error('Error fetching enrollments:', enrollError);
            return NextResponse.json({ 
                error: 'Failed to fetch enrollments' 
            }, { status: 500 });
        }

        const classIds = enrollments?.map(e => e.class_id) || [];
        console.log(`📚 Student ${user.full_name} enrolled in ${classIds.length} classes:`, classIds);

        // Handle case where student is not enrolled in any classes
        if (classIds.length === 0) {
            console.log('📝 Student not enrolled in any classes');
            return NextResponse.json({
                success: true,
                student_dashboard: {
                    student_id,
                    student_name: user.full_name,
                    statistics: {
                        total_assignments_available: 0,
                        total_assignments_completed: 0,
                        assignments_pending: 0,
                        pending_grading: 0,
                        average_score: "0%",
                        last_activity: null
                    },
                    available_assignments: [],
                    recent_submissions: [],
                    recent_results: [],
                    message: "You're not enrolled in any classes yet. Contact your teacher to get enrolled."
                },
                student: {
                    name: user.full_name,
                    test_mode: user.isTestMode
                }
            });
        }

        // Get assignments from enrolled classes (not all published papers!)
        const { data: availableAssignments, error: assignmentsError } = await supabaseAdmin
            .from('assignments')
            .select(`
                id,
                title,
                instructions,
                due_date,
                max_attempts,
                status,
                question_paper_id,
                class_id,
                created_at,
                question_papers!inner(
                    id,
                    title,
                    description,
                    total_marks,
                    time_limit,
                    difficulty_level,
                    status,
                    users!question_papers_teacher_id_fkey(full_name)
                )
            `)
            .in('class_id', classIds)
            .eq('status', 'active')
            .eq('question_papers.status', 'published')
            .order('due_date', { ascending: true });

        if (assignmentsError) {
            console.error('Error fetching assignments:', assignmentsError);
            return NextResponse.json({
                error: 'Failed to fetch available assignments'
            }, { status: 500 });
        }

        console.log(`🎯 Found ${(availableAssignments || []).length} assignments for ${user.full_name}`);

        // Get student's submission history (updated to work with assignments)
        const assignmentQuestionPaperIds = (availableAssignments || []).map(a => a.question_paper_id);
        
        const { data: submissions, error: submissionsError } = await supabaseAdmin
            .from('submissions')
            .select(`
                id,
                question_paper_id,
                submitted_at,
                time_taken,
                status,
                question_papers(title, total_marks),
                results(total_score, percentage, grade, feedback)
            `)
            .eq('student_id', student_id)
            .in('question_paper_id', assignmentQuestionPaperIds)
            .order('submitted_at', { ascending: false });

        if (submissionsError) {
            console.error('Error fetching submissions:', submissionsError);
        }

        // Get recent results (updated to work with assignments)
        const { data: recentResults, error: resultsError } = await supabaseAdmin
            .from('results')
            .select(`
                id,
                total_score,
                percentage,
                grade,
                feedback,
                graded_at,
                submissions!inner(
                    question_paper_id,
                    submitted_at,
                    question_papers(title, total_marks)
                )
            `)
            .eq('submissions.student_id', student_id)
            .in('submissions.question_paper_id', assignmentQuestionPaperIds)
            .order('graded_at', { ascending: false })
            .limit(5);

        if (resultsError) {
            console.error('Error fetching recent results:', resultsError);
        }

        // Calculate statistics based on assignments (not all question papers)
        const submittedQuestionPaperIds = (submissions || []).map(s => s.question_paper_id);
        const availableNotTaken = (availableAssignments || []).filter(
            assignment => !submittedQuestionPaperIds.includes(assignment.question_paper_id)
        );

        const averageScore = (recentResults || []).length > 0
            ? (recentResults.reduce((sum, result) => sum + (result.percentage || 0), 0) / recentResults.length).toFixed(1)
            : 0;

        const totalAssignmentsCompleted = (submissions || []).length;
        const pendingGrading = (submissions || []).filter(s => s.status === 'submitted').length;

        console.log(`✅ Dashboard loaded for ${user.full_name}: ${(availableAssignments || []).length} assignments available, ${totalAssignmentsCompleted} completed`);

        // Return assignments with proper assignment info
        return NextResponse.json({
            success: true,
            student_dashboard: {
                student_id,
                student_name: user.full_name,
                statistics: {
                    total_assignments_available: (availableAssignments || []).length,
                    total_assignments_completed: totalAssignmentsCompleted,
                    assignments_pending: availableNotTaken.length,
                    pending_grading: pendingGrading,
                    average_score: `${averageScore}%`,
                    last_activity: (submissions || [])[0]?.submitted_at || null
                },
                // Return assignments with due dates and instructions
                available_assignments: availableNotTaken.map(assignment => {
                    const questionPaper = extractQuestionPaper(assignment.question_papers);
                    const teacherName = extractTeacherName(questionPaper?.users);

                    return {
                        assignment_id: assignment.id,
                        assignment_title: assignment.title,
                        assignment_instructions: assignment.instructions,
                        due_date: assignment.due_date,
                        max_attempts: assignment.max_attempts,
                        // Question paper details
                        question_paper_id: assignment.question_paper_id,
                        quiz_title: questionPaper?.title,
                        description: questionPaper?.description,
                        total_marks: questionPaper?.total_marks,
                        time_limit: questionPaper?.time_limit,
                        difficulty_level: questionPaper?.difficulty_level,
                        teacher_name: teacherName,
                        created_at: assignment.created_at,
                        status: 'available'
                    };
                }),
                recent_submissions: (submissions || []).slice(0, 5).map(sub => {
                    const questionPaper = extractQuestionPaper(sub.question_papers);
                    return {
                        id: sub.id,
                        quiz_title: questionPaper?.title,
                        submitted_at: sub.submitted_at,
                        time_taken: sub.time_taken,
                        status: sub.status,
                        score: sub.results?.[0]?.total_score || null,
                        percentage: sub.results?.[0]?.percentage || null,
                        grade: sub.results?.[0]?.grade || null
                    };
                }),
                recent_results: (recentResults || []).map(result => {
                    // Extract submission and question paper data safely
                    const submission = extractQuestionPaper(result.submissions);
                    const questionPaper = extractQuestionPaper(submission?.question_papers);
                    
                    return {
                        quiz_title: questionPaper?.title,
                        total_score: result.total_score,
                        total_marks: questionPaper?.total_marks,
                        percentage: result.percentage,
                        grade: result.grade,
                        graded_at: result.graded_at,
                        has_feedback: !!result.feedback
                    };
                })
            },
            student: {
                name: user.full_name,
                test_mode: user.isTestMode
            }
        });

    } catch (error) {
        console.error('💥 Student dashboard error:', error);
        return NextResponse.json({
            error: 'Failed to load student dashboard',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// ===============================================================================
// 📋 GET OPTIONS INFO HANDLER
// ===============================================================================
function getOptionsHandler() {
    return NextResponse.json({
        endpoint: 'Student Dashboard (Refactored)',
        methods: ['GET'],
        description: 'Get student dashboard with assignments from enrolled classes',
        authentication: 'Required - Centralized Auth Middleware',
        query_parameters: {
            student_id: 'Optional - defaults to authenticated user'
        },
        response_includes: [
            'Assignments from enrolled classes only',
            'Student statistics based on assignments',
            'Recent submissions for assignments',
            'Recent results for assignments',
            'Assignment details (due dates, instructions, attempts)'
        ],
        improvements: [
            'Uses centralized auth middleware',
            'Consistent with other APIs',
            'Faster performance',
            'Better error handling',
            'Unified test mode support'
        ]
    });
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireStudent(getStudentDashboardHandler);
export const OPTIONS = getOptionsHandler;