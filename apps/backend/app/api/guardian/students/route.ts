// /api/guardian/students/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireRole } from '../../../../lib/auth/middleware';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { ApiResponse } from '../../../../lib/utils/validation';
import { z } from 'zod';

// Student creation schema
const CreateStudentSchema = z.object({
    full_name: z.string().min(1, 'Full name is required'),
    email: z.string().email('Valid email is required'),
    grade_level: z.string().min(1, 'Grade level is required'),
    school: z.string().optional(),
    date_of_birth: z.string().optional(),
    relationship: z.string().default('parent'),
});

interface StudentResponse {
    id: string;
    full_name: string;
    email: string;
    grade_level: string;
    school?: string;
    relationship: string;
    stats?: {
        total_quizzes: number;
        average_score: number;
        last_activity?: string;
    };
}

// GET /api/guardian/students - List all students managed by guardian
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<StudentResponse[]>>> {
    try {
        // Check guardian role
        const roleCheck = requireRole(['guardian'])(request);
        if (roleCheck) return roleCheck;

        const currentUser = getCurrentUser(request);

        if (!currentUser.id) {
            return NextResponse.json({
                success: false,
                error: 'User ID not found'
            }, { status: 401 });
        }

        // Get students managed by this guardian
        const { data: students, error } = await supabaseAdmin
            .from('users')
            .select(`
        id,
        full_name,
        email,
        grade_level,
        school,
        date_of_birth,
        created_at,
        guardianships!inner (
          relationship,
          is_primary,
          permissions,
          created_at
        )
      `)
            .eq('role', 'student')
            .eq('guardianships.guardian_id', currentUser.id)
            .order('guardianships.created_at', { ascending: false });

        if (error) {
            console.error('Get guardian students error:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch students'
            }, { status: 500 });
        }

        // Add stats for each student
        const studentsWithStats: StudentResponse[] = await Promise.all(
            (students || []).map(async (student) => {
                // Get quiz submission stats
                const { data: quizStats } = await supabaseAdmin
                    .from('quiz_submissions')
                    .select('score, submitted_at')
                    .eq('student_id', student.id)
                    .order('submitted_at', { ascending: false });

                const totalQuizzes = quizStats?.length || 0;
                const averageScore = totalQuizzes > 0
                    ? Math.round(quizStats.reduce((sum, quiz) => sum + (quiz.score || 0), 0) / totalQuizzes)
                    : 0;
                const lastActivity = quizStats?.[0]?.submitted_at;

                return {
                    id: student.id,
                    full_name: student.full_name,
                    email: student.email,
                    grade_level: student.grade_level,
                    school: student.school,
                    relationship: student.guardianships[0]?.relationship || 'parent',
                    stats: {
                        total_quizzes: totalQuizzes,
                        average_score: averageScore,
                        last_activity: lastActivity
                    }
                };
            })
        );

        return NextResponse.json({
            success: true,
            data: studentsWithStats
        });

    } catch (error) {
        console.error('Get guardian students error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// POST /api/guardian/students - Create new student
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<StudentResponse> | { success: false; error: string; data?: any }>> {
    try {
        // Check guardian role
        const roleCheck = requireRole(['guardian'])(request);
        if (roleCheck) return roleCheck;

        const currentUser = getCurrentUser(request);

        if (!currentUser.id) {
            return NextResponse.json({
                success: false,
                error: 'User ID not found'
            }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = CreateStudentSchema.parse(body);

        // Check if email already exists
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', validatedData.email)
            .single();

        if (existingUser) {
            return NextResponse.json({
                success: false,
                error: 'Email already exists'
            }, { status: 409 });
        }

        // 🔧 FIX: Add clerk_id: null for guardian-created students
        const { data: student, error: studentError } = await supabaseAdmin
            .from('users')
            .insert({
                email: validatedData.email,
                full_name: validatedData.full_name,
                role: 'student',
                grade_level: validatedData.grade_level,
                school: validatedData.school,
                date_of_birth: validatedData.date_of_birth,
                clerk_id: null, // 🔧 THIS IS THE FIX - Allow null for guardian-created accounts
                preferences: {
                    guardian_managed: true,
                    can_take_quizzes: true,
                    can_view_results: true
                }
            })
            .select()
            .single();

        if (studentError) {
            console.error('Create student error:', studentError);
            return NextResponse.json({
                success: false,
                error: 'Failed to create student'
            }, { status: 500 });
        }

        // Create guardianship relationship
        const { error: guardianshipError } = await supabaseAdmin
            .from('guardianships')
            .insert({
                guardian_id: currentUser.id,
                student_id: student.id,
                relationship: validatedData.relationship,
                is_primary: true,
                permissions: {
                    view_results: true,
                    manage_account: true,
                    receive_notifications: true,
                    can_reset_password: false
                }
            });

        if (guardianshipError) {
            console.error('Create guardianship error:', guardianshipError);
            // Rollback student creation
            await supabaseAdmin.from('users').delete().eq('id', student.id);
            return NextResponse.json({
                success: false,
                error: 'Failed to create guardianship relationship'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Student created successfully',
            data: {
                id: student.id,
                full_name: student.full_name,
                email: student.email,
                grade_level: student.grade_level,
                school: student.school,
                relationship: validatedData.relationship
            }
        }, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                success: false,
                error: 'Validation failed',
                data: { details: error.errors }
            }, { status: 400 });
        }

        console.error('Create student error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// PUT /api/guardian/students?id=student_id - Update student
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<{ message: string }>>> {
    try {
        const roleCheck = requireRole(['guardian'])(request);
        if (roleCheck) return roleCheck;

        const currentUser = getCurrentUser(request);
        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get('id');

        if (!studentId) {
            return NextResponse.json({
                success: false,
                error: 'Student ID is required'
            }, { status: 400 });
        }

        // Verify guardian has access to this student
        const { data: guardianship } = await supabaseAdmin
            .from('guardianships')
            .select('id, permissions')
            .eq('guardian_id', currentUser.id)
            .eq('student_id', studentId)
            .single();

        if (!guardianship) {
            return NextResponse.json({
                success: false,
                error: 'Access denied - student not under your guardianship'
            }, { status: 403 });
        }

        const body = await request.json();
        const { student_data, permissions } = body;

        // Update student data if provided
        if (student_data) {
            const updateData = CreateStudentSchema.partial().parse(student_data);
            const { error } = await supabaseAdmin
                .from('users')
                .update(updateData)
                .eq('id', studentId);

            if (error) {
                console.error('Update student data error:', error);
                return NextResponse.json({
                    success: false,
                    error: 'Failed to update student data'
                }, { status: 500 });
            }
        }

        // Update guardianship permissions if provided
        if (permissions) {
            const { error } = await supabaseAdmin
                .from('guardianships')
                .update({ permissions })
                .eq('guardian_id', currentUser.id)
                .eq('student_id', studentId);

            if (error) {
                console.error('Update permissions error:', error);
                return NextResponse.json({
                    success: false,
                    error: 'Failed to update permissions'
                }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            data: { message: 'Student updated successfully' }
        });

    } catch (error) {
        console.error('Update student error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}