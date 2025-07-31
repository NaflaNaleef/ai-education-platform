// app/api/teacher/assignments/route.ts
// PRODUCTION SAFE - Auto-disables test mode in production

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../../lib/db/supabase';

// ASSIGNMENTS API FIX - app/api/teacher/assignments/route.ts
// Replace the main query section with this:

export async function GET(request: NextRequest) {
    try {
        console.log('📋 Loading teacher assignments...');

        // Your existing auth code stays the same...
        const isTestMode = process.env.NODE_ENV !== 'production' &&
            request.headers.get('x-test-mode') === 'true';

        let user = null;
        let userProfile = null;

        if (!isTestMode) {
            // Keep your existing auth code...
            const supabase = createRouteHandlerClient({ cookies });
            const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

            if (userError || !authUser) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const { data: userProfileData, error: profileError } = await supabase
                .from('users')
                .select('role, full_name')
                .eq('id', authUser.id)
                .single();

            if (profileError || userProfileData?.role !== 'teacher') {
                return NextResponse.json({
                    error: 'Access denied. Only teachers can access assignments.'
                }, { status: 403 });
            }

            user = authUser;
            userProfile = userProfileData;
        } else {
            user = { id: '73596418-7572-485a-929d-6f9688cb8a36' };
            userProfile = { full_name: 'Test Teacher User', role: 'teacher' };
        }

        // ✅ CORRECT QUERIES FOR YOUR SCHEMA

        // 1. Get teacher's classes
        const { data: teacherClasses, error: classesError } = await supabaseAdmin
            .from('classes')
            .select('id, name')
            .eq('teacher_id', user.id)
            .eq('is_active', true);

        if (classesError) {
            console.error('Error fetching classes:', classesError);
        }

        const classIds = teacherClasses?.map(c => c.id) || [];

        if (classIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    overview: {
                        total_assignments: 0,
                        pending_grading: 0,
                        total_students: 0,
                        avg_completion: 0
                    },
                    assignments: []
                },
                environment: process.env.NODE_ENV,
                timestamp: new Date().toISOString()
            });
        }

        // 2. Get assignments for these classes
        const { data: assignments, error: assignmentsError } = await supabaseAdmin
            .from('assignments')
            .select(`
                id,
                title,
                instructions,
                due_date,
                status,
                max_attempts,
                created_at,
                question_paper_id,
                class_id,
                classes!assignments_class_id_fkey (
                    name
                ),
                question_papers!assignments_question_paper_id_fkey (
                    title,
                    total_marks,
                    time_limit,
                    description
                )
            `)
            .in('class_id', classIds)
            .order('created_at', { ascending: false });

        if (assignmentsError) {
            console.error('Error fetching assignments:', assignmentsError);
            return NextResponse.json({
                success: false,
                error: 'Failed to load assignments'
            }, { status: 500 });
        }

        // 3. Get enrollment count for total possible students
        const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
            .from('enrollments')
            .select('student_id, class_id')
            .in('class_id', classIds)
            .eq('status', 'active');

        if (enrollmentsError) {
            console.error('Error fetching enrollments:', enrollmentsError);
        }

        // 4. Get submission data for each assignment
        const assignmentIds = assignments?.map(a => a.id) || [];

        const { data: submissions, error: submissionsError } = await supabaseAdmin
            .from('submissions')
            .select(`
                id,
                student_id,
                assignment_id,
                status,
                submitted_at,
                results (
                    id,
                    graded_at,
                    percentage
                )
            `)
            .in('assignment_id', assignmentIds);

        if (submissionsError) {
            console.error('Error fetching submissions:', submissionsError);
        }

        // 5. Process assignments with stats
        const assignmentsWithStats = assignments?.map(assignment => {
            const classEnrollments = enrollments?.filter(e => e.class_id === assignment.class_id) || [];
            const totalPossibleStudents = classEnrollments.length;

            const assignmentSubmissions = submissions?.filter(s => s.assignment_id === assignment.id) || [];
            const totalSubmissions = assignmentSubmissions.length;

            // Count graded submissions
            const gradedSubmissions = assignmentSubmissions.filter(sub =>
                sub.status === 'graded' && sub.results?.length > 0
            ).length;

            // Calculate percentages
            const submissionPercentage = totalPossibleStudents > 0
                ? Math.round((totalSubmissions / totalPossibleStudents) * 100)
                : 0;

            const gradingPercentage = totalSubmissions > 0
                ? Math.round((gradedSubmissions / totalSubmissions) * 100)
                : 0;

            // Determine assignment status
            let assignmentStatus = assignment.status; // Use the actual status from DB

            // Check if overdue
            const isOverdue = assignment.due_date &&
                new Date() > new Date(assignment.due_date) &&
                assignment.status === 'active';
            if (isOverdue) {
                assignmentStatus = 'overdue';
            }

            // Extract subject from question paper title
            const questionPaper = assignment.question_papers?.[0];
            const subject = questionPaper?.title ?
                questionPaper.title.split(' ')[0] :
                'General';

            return {
                id: assignment.id,
                title: assignment.title,
                subject: subject,
                class_name: assignment.classes?.[0]?.name || 'Unknown Class',
                due_date: assignment.due_date ?
                    new Date(assignment.due_date).toISOString().split('T')[0] :
                    null,
                submissions: {
                    submitted: totalSubmissions,
                    total: totalPossibleStudents,
                    percentage: submissionPercentage
                },
                grading_progress: {
                    graded: gradedSubmissions,
                    total: totalSubmissions,
                    percentage: gradingPercentage
                },
                status: assignmentStatus,
                total_points: questionPaper?.total_marks || 0,
                time_limit: questionPaper?.time_limit || 0,
                max_attempts: assignment.max_attempts || 1,
                created_at: assignment.created_at
            };
        }) || [];

        // 6. Calculate overview statistics
        const totalAssignments = assignmentsWithStats.length;
        const activeAssignments = assignmentsWithStats.filter(a =>
            a.status === 'active' || a.status === 'overdue'
        ).length;

        const totalPendingGrading = assignmentsWithStats.reduce((sum, assignment) => {
            return sum + (assignment.submissions.submitted - assignment.grading_progress.graded);
        }, 0);

        // Total unique students across all classes
        const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []);
        const totalStudents = uniqueStudents.size;

        const avgCompletion = totalAssignments > 0
            ? Math.round(assignmentsWithStats.reduce((sum, a) => sum + a.submissions.percentage, 0) / totalAssignments)
            : 0;

        const overview = {
            total_assignments: totalAssignments,
            pending_grading: totalPendingGrading,
            total_students: totalStudents,
            avg_completion: avgCompletion
        };

        console.log(`✅ Assignments loaded: ${totalAssignments} assignments, ${totalPendingGrading} pending grading`);

        return NextResponse.json({
            success: true,
            data: {
                overview,
                assignments: assignmentsWithStats
            },
            environment: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('💥 Teacher assignments loading failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to load assignments',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        }, { status: 500 });
    }
}

// POST method for creating assignments stays similar but creates assignment records
export async function POST(request: NextRequest) {
    try {
        // Your auth code stays the same...
        const isTestMode = process.env.NODE_ENV !== 'production' &&
            request.headers.get('x-test-mode') === 'true';

        let user = null;

        if (!isTestMode) {
            const supabase = createRouteHandlerClient({ cookies });
            const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

            if (userError || !authUser) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('role')
                .eq('id', authUser.id)
                .single();

            if (profileError || userProfile?.role !== 'teacher') {
                return NextResponse.json({
                    error: 'Access denied. Only teachers can create assignments.'
                }, { status: 403 });
            }

            user = authUser;
        } else {
            user = { id: 'test-teacher-123' };
        }

        const {
            question_paper_id,
            class_id,
            title,
            instructions,
            due_date,
            max_attempts = 1
        } = await request.json();

        // Validation
        if (!question_paper_id || !class_id || !title) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: question_paper_id, class_id, title'
            }, { status: 400 });
        }

        // Create new assignment
        const { data: newAssignment, error: insertError } = await supabaseAdmin
            .from('assignments')
            .insert({
                question_paper_id,
                class_id,
                title,
                instructions,
                due_date,
                max_attempts,
                status: 'active'
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json({
                success: false,
                error: 'Failed to create assignment',
                details: insertError.message
            }, { status: 500 });
        }

        console.log(`✅ Assignment created: ${newAssignment.title}`);

        return NextResponse.json({
            success: true,
            assignment: {
                id: newAssignment.id,
                title: newAssignment.title,
                status: 'active',
                due_date: newAssignment.due_date,
                instructions: newAssignment.instructions,
                max_attempts: newAssignment.max_attempts
            },
            message: 'Assignment created successfully'
        });

    } catch (error) {
        console.error('💥 Assignment creation failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to create assignment',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        }, { status: 500 });
    }
}