import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

export interface AuthRequest extends NextRequest {
    userId?: string;
    userEmail?: string;
    userRole?: string;
}

export async function authMiddleware(request: NextRequest) {
    try {
        // Get Clerk user ID from headers (Prarthana will send this)
        const clerkId = request.headers.get('x-clerk-user-id');
        const userEmail = request.headers.get('x-user-email');

        if (!clerkId) {
            return NextResponse.json({
                success: false,
                error: 'Authentication required'
            }, { status: 401 });
        }

        // Get user from database
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('clerk_id', clerkId)
            .single();

        if (error || !user) {
            return NextResponse.json({
                success: false,
                error: 'User not found in database'
            }, { status: 404 });
        }

        // Add user info to request headers for downstream use
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', user.id);
        requestHeaders.set('x-user-role', user.role);
        requestHeaders.set('x-user-email', user.email);

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return NextResponse.json({
            success: false,
            error: 'Authentication failed'
        }, { status: 500 });
    }
}

export function requireRole(allowedRoles: string[]) {
    return (request: NextRequest) => {
        const userRole = request.headers.get('x-user-role');

        if (!userRole || !allowedRoles.includes(userRole)) {
            return NextResponse.json({
                success: false,
                error: `Access denied. Required roles: ${allowedRoles.join(', ')}`
            }, { status: 403 });
        }

        return null; // Continue
    };
}

// Helper function to get current user from request
export function getCurrentUser(request: NextRequest) {
    return {
        id: request.headers.get('x-user-id'),
        role: request.headers.get('x-user-role'),
        email: request.headers.get('x-user-email'),
        clerk_id: request.headers.get('x-clerk-user-id'),
    };
} 