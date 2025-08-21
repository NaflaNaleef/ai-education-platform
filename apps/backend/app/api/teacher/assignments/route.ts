// app/api/teacher/assignments/route.ts
// PRODUCTION SAFE - Now using centralized auth middleware

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { requireTeacher, getCurrentUser } from '../../../../lib/auth/middleware';

// ===============================================================================
// 📋 GET ASSIGNMENTS HANDLER
// ===============================================================================
async function getAssignmentsHandler(request: NextRequest) {
    try {
        console.log('📋 Loading teacher assignments...');
        
        // ✅ USER IS GUARANTEED TO BE A TEACHER
        const user = getCurrentUser(request)!;
        console.log(`✅ Teacher ${user.full_name} loading assignments`);

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
            teacher: user.full_name,
            test_mode: user.isTestMode,
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

// ===============================================================================
// 📝 CREATE ASSIGNMENT HANDLER
// ===============================================================================
async function createAssignmentHandler(request: NextRequest) {
    try {
        console.log('📝 Creating new assignment...');
        
        // ✅ USER IS GUARANTEED TO BE A TEACHER
        const user = getCurrentUser(request)!;
        console.log(`✅ Teacher ${user.full_name} creating assignment`);

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

        // Verify teacher owns this class
        const { data: teacherClass, error: classError } = await supabaseAdmin
            .from('classes')
            .select('id')
            .eq('id', class_id)
            .eq('teacher_id', user.id)
            .single();

        if (classError || !teacherClass) {
            return NextResponse.json({
                success: false,
                error: 'Class not found or access denied'
            }, { status: 404 });
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
            message: 'Assignment created successfully',
            teacher: user.full_name,
            test_mode: user.isTestMode
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

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireTeacher(getAssignmentsHandler);
export const POST = requireTeacher(createAssignmentHandler);