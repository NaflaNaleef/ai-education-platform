import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireRole } from '../../../../lib/auth/middleware';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { ApiResponse } from '../../../../lib/utils/validation';

interface DashboardOverview {
    total_students: number;
    total_quizzes_completed: number;
    average_score: number;
    students_improving: number;
    students_need_attention: number;
}

interface RecentActivity {
    student_name: string;
    activity: string;
    score?: number;
    subject?: string;
    date: string;
}

interface Notification {
    id: string;
    type: 'low_score' | 'overdue' | 'completed' | 'info';
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    student_name?: string;
    date: string;
}

interface DashboardResponse {
    overview: DashboardOverview;
    recent_activities: RecentActivity[];
    notifications: Notification[];
    students_summary: Array<{
        id: string;
        name: string;
        grade: string;
        avg_score: number;
        total_quizzes: number;
        trend: 'improving' | 'declining' | 'stable';
    }>;
}

// GET /api/guardian/dashboard - Guardian dashboard overview
// GET /api/guardian/dashboard?type=notifications - Get notifications only
// GET /api/guardian/dashboard?student_id=xxx - Get specific student details
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<DashboardResponse | any>>> {
    try {
        // Check guardian role
        const roleCheck = requireRole(['guardian'])(request);
        if (roleCheck) return roleCheck;

        const currentUser = getCurrentUser(request);
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const studentId = searchParams.get('student_id');

        if (!currentUser.id) {
            return NextResponse.json({
                success: false,
                error: 'User ID not found'
            }, { status: 401 });
        }

        // Get guardian's students
        const { data: guardianships } = await supabaseAdmin
            .from('guardianships')
            .select(`
        student_id,
        relationship,
        users!guardianships_student_id_fkey (
          id, full_name, grade_level
        )
      `)
            .eq('guardian_id', currentUser.id);

        const studentIds = guardianships?.map(g => g.student_id) || [];

        if (studentIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    overview: {
                        total_students: 0,
                        total_quizzes_completed: 0,
                        average_score: 0,
                        students_improving: 0,
                        students_need_attention: 0
                    },
                    recent_activities: [],
                    notifications: [{
                        id: 'welcome',
                        type: 'info' as const,
                        title: 'Welcome to Guardian Dashboard',
                        message: 'Create your first student to start monitoring their progress.',
                        priority: 'low' as const,
                        date: new Date().toISOString()
                    }],
                    students_summary: []
                }
            });
        }

        if (type === 'notifications') {
            // Return notifications only
            const notifications = await generateNotifications(studentIds, guardianships);
            return NextResponse.json({
                success: true,
                data: { notifications }
            });
        }

        if (studentId) {
            // Return specific student details
            const studentDetails = await getStudentDetails(studentId, currentUser.id!);
            return NextResponse.json({
                success: true,
                data: studentDetails
            });
        }

        // Full dashboard overview
        const [submissions, notifications] = await Promise.all([
            // Get all quiz submissions
            supabaseAdmin
                .from('quiz_submissions')
                .select(`
          id, score, submitted_at, time_taken, student_id,
          quiz_papers (title, subject, total_questions)
        `)
                .in('student_id', studentIds)
                .order('submitted_at', { ascending: false }),

            // Get notifications
            generateNotifications(studentIds, guardianships)
        ]);

        const allSubmissions = submissions.data || [];

        // Calculate overview stats
        const totalQuizzes = allSubmissions.length;
        const averageScore = totalQuizzes > 0
            ? Math.round(allSubmissions.reduce((sum, sub) => sum + (sub.score || 0), 0) / totalQuizzes)
            : 0;

        // Calculate student trends
        const studentStats = calculateStudentTrends(allSubmissions, guardianships || []);

        const studentsImproving = studentStats.filter(s => s.trend === 'improving').length;
        const studentsNeedAttention = studentStats.filter(s => s.avg_score < 60).length;

        // Recent activities
        const recentActivities: RecentActivity[] = allSubmissions
            .slice(0, 10)
            .map(sub => {
                const student = guardianships?.find(g => g.student_id === sub.student_id);
                const studentName = Array.isArray(student?.users) ? (student?.users[0] as any)?.full_name : (student?.users as any)?.full_name;
                return {
                    student_name: studentName || 'Unknown Student',
                    activity: 'Quiz completed',
                    score: sub.score,
                    subject: Array.isArray(sub.quiz_papers) ? (sub.quiz_papers[0] as any)?.subject : (sub.quiz_papers as any)?.subject || 'Unknown',
                    date: sub.submitted_at
                };
            });

        const dashboardData: DashboardResponse = {
            overview: {
                total_students: studentIds.length,
                total_quizzes_completed: totalQuizzes,
                average_score: averageScore,
                students_improving: studentsImproving,
                students_need_attention: studentsNeedAttention
            },
            recent_activities: recentActivities,
            notifications: notifications.slice(0, 5), // Latest 5 notifications
            students_summary: studentStats
        };

        return NextResponse.json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('Guardian dashboard error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// Helper function to generate notifications
async function generateNotifications(studentIds: string[], guardianships: any[]): Promise<Notification[]> {
    const notifications: Notification[] = [];

    // Get recent submissions for notifications
    const { data: recentSubmissions } = await supabaseAdmin
        .from('quiz_submissions')
        .select(`
      score, submitted_at, student_id,
      quiz_papers (title, subject)
    `)
        .in('student_id', studentIds)
        .gte('submitted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('submitted_at', { ascending: false });

    // Create student name map
    const studentMap = guardianships.reduce((acc, g) => {
        acc[g.student_id] = g.users?.full_name || 'Unknown Student';
        return acc;
    }, {} as Record<string, string>);

    // Low score notifications
    const lowScores = recentSubmissions?.filter(sub => sub.score < 60) || [];
    lowScores.forEach((sub, index) => {
        notifications.push({
            id: `low_score_${index}`,
            type: 'low_score',
            title: 'Low Quiz Score',
            message: `${studentMap[sub.student_id]} scored ${sub.score}% on ${(sub.quiz_papers as any)?.subject || 'a quiz'}`,
            priority: 'medium',
            student_name: studentMap[sub.student_id],
            date: sub.submitted_at
        });
    });

    // Recent completions
    const recentCompletions = recentSubmissions?.filter(sub => sub.score >= 80) || [];
    recentCompletions.slice(0, 3).forEach((sub, index) => {
        notifications.push({
            id: `completed_${index}`,
            type: 'completed',
            title: 'Great Performance!',
            message: `${studentMap[sub.student_id]} scored ${sub.score}% on ${(sub.quiz_papers as any)?.subject || 'a quiz'}`,
            priority: 'low',
            student_name: studentMap[sub.student_id],
            date: sub.submitted_at
        });
    });

    return notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Helper function to calculate student trends
function calculateStudentTrends(submissions: any[], guardianships: any[]) {
    return guardianships.map(guardianship => {
        const studentSubmissions = submissions.filter(sub => sub.student_id === guardianship.student_id);
        const totalQuizzes = studentSubmissions.length;
        const avgScore = totalQuizzes > 0
            ? Math.round(studentSubmissions.reduce((sum, sub) => sum + (sub.score || 0), 0) / totalQuizzes)
            : 0;

        // Calculate trend (last 3 vs previous 3)
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (totalQuizzes >= 6) {
            const recent3 = studentSubmissions.slice(-3);
            const previous3 = studentSubmissions.slice(-6, -3);
            const recentAvg = recent3.reduce((sum, sub) => sum + (sub.score || 0), 0) / 3;
            const previousAvg = previous3.reduce((sum, sub) => sum + (sub.score || 0), 0) / 3;
            const difference = recentAvg - previousAvg;

            trend = difference > 5 ? 'improving' : difference < -5 ? 'declining' : 'stable';
        }

        return {
            id: guardianship.student_id,
            name: guardianship.users?.full_name || 'Unknown Student',
            grade: guardianship.users?.grade_level || 'Unknown',
            avg_score: avgScore,
            total_quizzes: totalQuizzes,
            trend
        };
    });
}

// Helper function to get detailed student info
async function getStudentDetails(studentId: string, guardianId: string) {
    // Verify access
    const { data: guardianship } = await supabaseAdmin
        .from('guardianships')
        .select('id')
        .eq('guardian_id', guardianId)
        .eq('student_id', studentId)
        .single();

    if (!guardianship) {
        throw new Error('Access denied');
    }

    // Get student info and quiz history
    const [studentResult, quizHistoryResult] = await Promise.all([
        supabaseAdmin
            .from('users')
            .select('id, full_name, email, grade_level, school')
            .eq('id', studentId)
            .single(),

        supabaseAdmin
            .from('quiz_submissions')
            .select(`
        id, score, submitted_at, time_taken,
        quiz_papers (title, subject, total_questions)
      `)
            .eq('student_id', studentId)
            .order('submitted_at', { ascending: false })
            .limit(20)
    ]);

    return {
        student: studentResult.data,
        quiz_history: quizHistoryResult.data || [],
        analytics: calculateStudentAnalytics(quizHistoryResult.data || [])
    };
}

function calculateStudentAnalytics(quizHistory: any[]) {
    if (quizHistory.length === 0) {
        return {
            total_quizzes: 0,
            average_score: 0,
            best_score: 0,
            recent_trend: 'no_data',
            subject_performance: []
        };
    }

    const totalQuizzes = quizHistory.length;
    const scores = quizHistory.map(q => q.score || 0);
    const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / totalQuizzes);
    const bestScore = Math.max(...scores);

    // Recent trend (last 5 vs all)
    let recentTrend = 'stable';
    if (totalQuizzes >= 5) {
        const recent5 = scores.slice(0, 5); // Most recent 5
        const recent5Avg = recent5.reduce((sum, score) => sum + score, 0) / 5;
        const difference = recent5Avg - averageScore;
        recentTrend = difference > 5 ? 'improving' : difference < -5 ? 'declining' : 'stable';
    }

    // Subject performance
    const subjectStats = quizHistory.reduce((acc, quiz) => {
        const subject = quiz.quiz_papers?.subject || 'Unknown';
        if (!acc[subject]) {
            acc[subject] = { scores: [], count: 0 };
        }
        acc[subject].scores.push(quiz.score || 0);
        acc[subject].count++;
        return acc;
    }, {} as Record<string, { scores: number[], count: number }>);

    const subjectPerformance = Object.entries(subjectStats).map(([subject, data]) => ({
        subject,
        average: Math.round((data as any).scores.reduce((sum: number, score: number) => sum + score, 0) / (data as any).count),
        total_quizzes: (data as any).count
    }));

    return {
        total_quizzes: totalQuizzes,
        average_score: averageScore,
        best_score: bestScore,
        recent_trend: recentTrend,
        subject_performance: subjectPerformance
    };
}