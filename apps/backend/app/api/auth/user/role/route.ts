import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/db/supabase';
import { ApiResponse } from '../../../../../lib/utils/validation';

interface RoleResponse {
    role: string;
    full_name: string;
    permissions: string[];
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<RoleResponse>>> {
    try {
        const clerkId = request.headers.get('x-clerk-user-id');

        if (!clerkId) {
            return NextResponse.json({
                success: false,
                error: 'User not authenticated'
            }, { status: 401 });
        }

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('role, full_name')
            .eq('clerk_id', clerkId)
            .single();

        if (error || !user) {
            return NextResponse.json({
                success: false,
                error: 'User not found'
            }, { status: 404 });
        }

        // Define role-based permissions
        const permissions = {
            teacher: ['create_resources', 'create_question_papers', 'manage_classes', 'view_analytics'],
            student: ['take_assignments', 'view_results', 'submit_answers'],
            guardian: ['view_student_progress', 'manage_student_accounts']
        };

        return NextResponse.json({
            success: true,
            data: {
                role: user.role,
                full_name: user.full_name,
                permissions: permissions[user.role as keyof typeof permissions] || []
            }
        });

    } catch (error) {
        console.error('Get user role error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to get user role'
        }, { status: 500 });
    }
} 