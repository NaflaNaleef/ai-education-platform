import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';
import { CreateUserSchema, UpdateUserSchema, ApiResponse, UserResponse } from '@/lib/utils/validation';

// CREATE USER (called after Clerk signup)
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
    try {
        const body = await request.json();
        const validatedData = CreateUserSchema.parse(body);

        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id, email')
            .eq('clerk_id', validatedData.clerk_id)
            .single();

        if (existingUser) {
            return NextResponse.json({
                success: false,
                error: 'User already exists',
                data: { user_id: existingUser.id }
            }, { status: 409 });
        }

        // Create new user
        const { data: newUser, error } = await supabaseAdmin
            .from('users')
            .insert({
                clerk_id: validatedData.clerk_id,
                email: validatedData.email,
                full_name: validatedData.full_name,
                role: validatedData.role,
                profile_image_url: validatedData.profile_image_url || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to create user'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'User created successfully',
            data: {
                id: newUser.id,
                clerk_id: newUser.clerk_id,
                email: newUser.email,
                full_name: newUser.full_name,
                role: newUser.role,
                profile_image_url: newUser.profile_image_url,
                preferences: newUser.preferences,
                created_at: newUser.created_at,
                updated_at: newUser.updated_at
            }
        }, { status: 201 });

    } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json({
                success: false,
                error: 'Validation failed',
                data: { details: error.message }
            }, { status: 400 });
        }

        console.error('Create user error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// GET CURRENT USER
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
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
            .select('*')
            .eq('clerk_id', clerkId)
            .single();

        if (error || !user) {
            return NextResponse.json({
                success: false,
                error: 'User not found'
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: {
                id: user.id,
                clerk_id: user.clerk_id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                profile_image_url: user.profile_image_url,
                preferences: user.preferences,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to get user'
        }, { status: 500 });
    }
}

// UPDATE USER PROFILE
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<UserResponse>>> {
    try {
        const clerkId = request.headers.get('x-clerk-user-id');

        if (!clerkId) {
            return NextResponse.json({
                success: false,
                error: 'User not authenticated'
            }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = UpdateUserSchema.parse(body);

        const { data: updatedUser, error } = await supabaseAdmin
            .from('users')
            .update({
                ...validatedData,
                updated_at: new Date().toISOString()
            })
            .eq('clerk_id', clerkId)
            .select()
            .single();

        if (error) {
            console.error('Update user error:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to update user'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'User updated successfully',
            data: {
                id: updatedUser.id,
                clerk_id: updatedUser.clerk_id,
                email: updatedUser.email,
                full_name: updatedUser.full_name,
                role: updatedUser.role,
                profile_image_url: updatedUser.profile_image_url,
                preferences: updatedUser.preferences,
                created_at: updatedUser.created_at,
                updated_at: updatedUser.updated_at
            }
        });

    } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json({
                success: false,
                error: 'Validation failed',
                data: { details: error.message }
            }, { status: 400 });
        }

        console.error('Update user error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
} 