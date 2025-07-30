import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/db/supabase';
import { ApiResponse } from '../../../lib/utils/validation';

export async function POST(): Promise<NextResponse<ApiResponse>> {
    try {
        // Test creating a user
        const testUser = {
            clerk_id: `test_clerk_${Date.now()}`,
            email: `test-${Date.now()}@example.com`,
            full_name: 'Test Teacher User',
            role: 'teacher' as const
        };

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .insert(testUser)
            .select()
            .single();

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Test user created successfully',
            data: {
                user_id: user.id,
                clerk_id: user.clerk_id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Test user creation error:', error);
        return NextResponse.json({
            success: false,
            error: 'Test failed'
        }, { status: 500 });
    }
}

export async function GET(): Promise<NextResponse<ApiResponse>> {
    try {
        // Test getting users count
        const { count, error } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Database connection healthy',
            data: { total_users: count }
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Database test failed'
        }, { status: 500 });
    }
}

export async function DELETE(): Promise<NextResponse<ApiResponse>> {
    try {
        // Clean up test users
        const { error } = await supabaseAdmin
            .from('users')
            .delete()
            .like('clerk_id', 'test_clerk_%');

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Test users cleaned up successfully'
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Cleanup failed'
        }, { status: 500 });
    }
} 