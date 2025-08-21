// app/api/teacher/students/route.ts
// REFACTORED: Using centralized auth middleware

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { requireTeacher, getCurrentUser } from '../../../../lib/auth/middleware';

// ===============================================================================
// 👥 GET TEACHER STUDENTS HANDLER
// ===============================================================================
async function getTeacherStudentsHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`👥 Loading students for teacher: ${user.full_name}`);

        // Step 1: Get teacher's classes
        const { data: teacherClasses, error: classesError } = await supabaseAdmin
            .from('classes')
            .select('id, name')
            .eq('teacher_id', user.id)
            .eq('is_active', true);

        if (classesError) {
            console.error('Error fetching teacher classes:', classesError);
            return NextResponse.json({
                success: false,
                error: 'Failed to load teacher classes'
            }, { status: 500 });
        }

        console.log(`Found ${teacherClasses?.length || 0} classes for teacher`);

        if (!teacherClasses || teacherClasses.length === 0) {
            console.log('No active classes found for teacher');
            return NextResponse.json({
                success: true,
                data: {
                    overview: {
                        total_students: 0,
                        average_gpa: '0.0',
                        completion_rate: 0,
                        new_this_month: 0
                    },
                    students: []
                },
                teacher: {
                    name: user.full_name,
                    test_mode: user.isTestMode
                }
            });
        }

        const classIds = teacherClasses.map(c => c.id);

        // Step 2: Get enrolled students in these classes
        const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
            .from('enrollments')
            .select(`
                student_id,
                enrolled_at,
                status,
                users!enrollments_student_id_fkey (
                    id,
                    full_name,
                    email,
                    created_at
                )
            `)
            .in('class_id', classIds)
            .eq('status', 'active');

        if (enrollmentsError) {
            console.error('Error fetching enrollments:', enrollmentsError);
            return NextResponse.json({
                success: false,
                error: 'Failed to load student enrollments'
            }, { status: 500 });
        }

        console.log(`Found ${enrollments?.length || 0} active enrollments`);

        // Step 3: Get assignments for these classes
        const { data: assignments, error: assignmentsError } = await supabaseAdmin
            .from('assignments')
            .select('id, title, question_paper_id')
            .in('class_id', classIds)
            .in('status', ['active', 'closed']);

        if (assignmentsError) {
            console.error('Error fetching assignments:', assignmentsError);
        }

        const assignmentIds = assignments?.map(a => a.id) || [];
        console.log(`Found ${assignments?.length || 0} assignments`);

        // Step 4: Get submissions and results
        const { data: submissions, error: submissionsError } = await supabaseAdmin
            .from('submissions')
            .select(`
                id,
                student_id,
                assignment_id,
                status,
                submitted_at,
                results (
                    total_score,
                    max_score,
                    percentage
                )
            `)
            .in('assignment_id', assignmentIds);

        if (submissionsError) {
            console.error('Error fetching submissions:', submissionsError);
        }

        console.log(`Found ${submissions?.length || 0} submissions`);

        // Step 5: Process student data
        const studentMap = new Map();

        enrollments?.forEach(enrollment => {
            // Handle both array and single object cases
            let student;

            if (Array.isArray(enrollment.users)) {
                // If it's an array, take the first element
                student = enrollment.users[0];
                console.log(`📝 Processing student from array: ${student?.full_name || 'unknown'}`);
            } else {
                // If it's a single object
                student = enrollment.users;
                console.log(`📝 Processing student from object: ${student?.full_name || 'unknown'}`);
            }

            if (!student) {
                console.log('⚠️ Missing student data for enrollment:', enrollment.student_id);
                return;
            }

            const studentId = enrollment.student_id;

            if (!studentMap.has(studentId)) {
                studentMap.set(studentId, {
                    id: student.id,
                    name: student.full_name,
                    email: student.email,
                    grade: 'N/A', // Your schema doesn't have grade_level
                    enrolled_date: enrollment.enrolled_at,
                    submissions: [],
                    total_score: 0,
                    total_possible: 0,
                    completion_count: 0
                });
                console.log(`✅ Added student to map: ${student.full_name}`);
            }
        });

        console.log(`Processed ${studentMap.size} unique students`);

        // Add submission data to students
        submissions?.forEach(submission => {
            if (studentMap.has(submission.student_id)) {
                const studentData = studentMap.get(submission.student_id);
                studentData.submissions.push(submission);

                const result = submission.results?.[0];
                if (result) {
                    studentData.total_score += result.total_score || 0;
                    studentData.total_possible += result.max_score || 0;
                    if (submission.status === 'graded') {
                        studentData.completion_count++;
                    }
                }
            }
        });

        // Step 6: Format response
        const studentsArray = Array.from(studentMap.values()).map(student => {
            const totalSubmissions = student.submissions.length;
            const completedSubmissions = student.completion_count;

            const averagePercentage = student.total_possible > 0
                ? (student.total_score / student.total_possible) * 100
                : 0;
            const gpa = (averagePercentage / 100) * 4;

            const status = totalSubmissions > 0 ? 'active' : 'inactive';
            const progressPercentage = totalSubmissions > 0
                ? Math.round((completedSubmissions / totalSubmissions) * 100)
                : 0;

            return {
                id: student.id,
                name: student.name,
                email: student.email,
                grade: student.grade,
                gpa: gpa.toFixed(1),
                progress: {
                    completed: completedSubmissions,
                    total: totalSubmissions,
                    percentage: progressPercentage
                },
                status: status,
                enrolled_date: student.enrolled_date
            };
        });

        // Calculate overview
        const totalStudents = studentsArray.length;
        const averageGpa = totalStudents > 0
            ? (studentsArray.reduce((sum, s) => sum + parseFloat(s.gpa), 0) / totalStudents).toFixed(1)
            : '0.0';

        const completionRate = totalStudents > 0
            ? Math.round(studentsArray.reduce((sum, s) => sum + s.progress.percentage, 0) / totalStudents)
            : 0;

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const newThisMonth = studentsArray.filter(student =>
            new Date(student.enrolled_date) > oneMonthAgo
        ).length;

        const overview = {
            total_students: totalStudents,
            average_gpa: averageGpa,
            completion_rate: completionRate,
            new_this_month: newThisMonth
        };

        console.log(`✅ Students loaded for ${user.full_name}: ${totalStudents} students, avg GPA: ${averageGpa}`);

        return NextResponse.json({
            success: true,
            data: {
                overview,
                students: studentsArray
            },
            teacher: {
                name: user.full_name,
                test_mode: user.isTestMode
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('💥 Teacher students loading failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to load students',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// 👨‍🎓 CREATE STUDENT HANDLER
// ===============================================================================
async function createStudentHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`👨‍🎓 Creating student for teacher: ${user.full_name}`);

        const { full_name, email, grade_level } = await request.json();

        // Validation
        if (!full_name || !email) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: full_name, email'
            }, { status: 400 });
        }

        // Create new student user
        const { data: newStudent, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
                full_name,
                email,
                role: 'student',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json({
                success: false,
                error: 'Failed to create student',
                details: insertError.message
            }, { status: 500 });
        }

        console.log(`✅ Student created: ${newStudent.full_name} by ${user.full_name}`);

        return NextResponse.json({
            success: true,
            student: {
                id: newStudent.id,
                name: newStudent.full_name,
                email: newStudent.email,
                grade: 'N/A',
                gpa: '0.0',
                progress: {
                    completed: 0,
                    total: 0,
                    percentage: 0
                },
                status: 'inactive',
                enrolled_date: newStudent.created_at
            },
            message: 'Student created successfully',
            created_by: user.full_name,
            test_mode: user.isTestMode
        });

    } catch (error) {
        console.error('💥 Student creation failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to create student',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireTeacher(getTeacherStudentsHandler);
export const POST = requireTeacher(createStudentHandler);