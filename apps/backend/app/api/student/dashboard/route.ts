import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // Get current user (matching your auth pattern)
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const student_id = searchParams.get('student_id') || user.id;

        console.log(`📊 Getting dashboard for student: ${student_id}`);

        // Verify user can access this student's data (must be same user or admin)
        if (student_id !== user.id) {
            // Could add admin role check here later
            return NextResponse.json({
                error: 'Access denied - can only view your own dashboard'
            }, { status: 403 });
        }

        // Get available question papers for this student
        // In a real app, you'd have assignments/enrollments table
        // For now, get all published papers from all teachers
        const { data: availableQuizzes, error: quizzesError } = await supabase
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
                users!question_papers_teacher_id_fkey(full_name)
            `)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (quizzesError) {
            console.error('Error fetching quizzes:', quizzesError);
            return NextResponse.json({
                error: 'Failed to fetch available quizzes'
            }, { status: 500 });
        }

        // Get student's submission history
        const { data: submissions, error: submissionsError } = await supabase
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
            .order('submitted_at', { ascending: false });

        if (submissionsError) {
            console.error('Error fetching submissions:', submissionsError);
        }

        // Get recent results (top 5)
        const { data: recentResults, error: resultsError } = await supabase
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
            .order('graded_at', { ascending: false })
            .limit(5);

        if (resultsError) {
            console.error('Error fetching recent results:', resultsError);
        }

        // Calculate student statistics
        const submittedPaperIds = (submissions || []).map(s => s.question_paper_id);
        const availableNotTaken = (availableQuizzes || []).filter(
            quiz => !submittedPaperIds.includes(quiz.id)
        );

        const averageScore = (recentResults || []).length > 0
            ? (recentResults.reduce((sum, result) => sum + (result.percentage || 0), 0) / recentResults.length).toFixed(1)
            : 0;

        const totalQuizzesCompleted = (submissions || []).length;
        const pendingGrading = (submissions || []).filter(s => s.status === 'submitted').length;

        return NextResponse.json({
            success: true,
            student_dashboard: {
                student_id,
                student_name: user.user_metadata?.full_name || user.email,
                statistics: {
                    total_quizzes_available: (availableQuizzes || []).length,
                    total_quizzes_completed: totalQuizzesCompleted,
                    quizzes_pending: availableNotTaken.length,
                    pending_grading: pendingGrading,
                    average_score: `${averageScore}%`,
                    last_activity: (submissions || [])[0]?.submitted_at || null
                },
                available_quizzes: availableNotTaken.map(quiz => ({
                    id: quiz.id,
                    title: quiz.title,
                    description: quiz.description,
                    total_marks: quiz.total_marks,
                    time_limit: quiz.time_limit,
                    difficulty_level: quiz.difficulty_level,
                    teacher_name: Array.isArray(quiz.users) && quiz.users.length > 0
                        ? quiz.users[0].full_name
                        : (quiz.users && typeof quiz.users === 'object' && 'full_name' in quiz.users ? quiz.users.full_name : 'Unknown Teacher'),
                    created_at: quiz.created_at,
                    status: 'available'
                })),
                recent_submissions: (submissions || []).slice(0, 5).map(sub => ({
                    id: sub.id,
                    quiz_title: Array.isArray(sub.question_papers) && sub.question_papers.length > 0
                        ? sub.question_papers[0].title
                        : (sub.question_papers && typeof sub.question_papers === 'object' && 'title' in sub.question_papers ? sub.question_papers.title : undefined),
                    submitted_at: sub.submitted_at,
                    time_taken: sub.time_taken,
                    status: sub.status,
                    score: sub.results?.[0]?.total_score || null,
                    percentage: sub.results?.[0]?.percentage || null,
                    grade: sub.results?.[0]?.grade || null
                })),
                recent_results: (recentResults || []).map(result => {
                    let submissions = result.submissions;
                    let qpObj;
                    if (Array.isArray(submissions)) {
                        if (submissions.length > 0 && typeof submissions[0] === 'object' && !Array.isArray(submissions[0])) {
                            const qp = submissions[0].question_papers;
                            qpObj = Array.isArray(qp) && qp.length > 0 ? qp[0] : (typeof qp === 'object' ? qp : undefined);
                        } else {
                            qpObj = undefined;
                        }
                    } else if (submissions && typeof submissions === 'object') {
                        const qp = (submissions as { question_papers?: any }).question_papers;
                        qpObj = Array.isArray(qp) && qp.length > 0 ? qp[0] : (typeof qp === 'object' ? qp : undefined);
                    } else {
                        qpObj = undefined;
                    }
                    return {
                        quiz_title: qpObj?.title || undefined,
                        total_score: result.total_score,
                        total_marks: qpObj?.total_marks || undefined,
                        percentage: result.percentage,
                        grade: result.grade,
                        graded_at: result.graded_at,
                        has_feedback: !!result.feedback
                    };
                })
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

export async function OPTIONS() {
    return NextResponse.json({
        endpoint: 'Student Dashboard',
        methods: ['GET'],
        description: 'Get student dashboard with available quizzes, statistics, and recent activity',
        authentication: 'Required - Supabase Auth',
        query_parameters: {
            student_id: 'Optional - defaults to authenticated user'
        },
        response_includes: [
            'Available quizzes (not yet taken)',
            'Student statistics',
            'Recent submissions',
            'Recent results'
        ]
    });
}