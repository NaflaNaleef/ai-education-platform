// ===============================================================================
// 🎯 CENTRALIZED AUTHENTICATION SYSTEM
// Replace all duplicated auth code with this clean approach
// ===============================================================================

// lib/auth/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../db/supabase';

// ✅ Test mode constants
const TEST_TEACHER_ID = '73596418-7572-485a-929d-6f9688cb8a36';
const TEST_STUDENT_ID = '87654321-4321-4321-4321-210987654321';
const TEST_CLASS_ID = 'abcdef12-abcd-4321-abcd-123456789abc';

export interface AuthenticatedUser {
  id: string;
  role: 'teacher' | 'student' | 'guardian';
  full_name: string;
  email: string;
  isTestMode: boolean;
}

// ===============================================================================
// 🔐 CORE AUTHENTICATION FUNCTION
// ===============================================================================
export async function authenticateUser(request: NextRequest): Promise<{
    success: boolean;
    user?: AuthenticatedUser;
    error?: string;
    status?: number;
  }> {
    try {
      // Check test mode
      const isTestMode = process.env.NODE_ENV !== 'production' && 
                        request.headers.get('x-test-mode') === 'true';
  
      if (isTestMode) {
        console.log('🧪 Test mode authentication');
        
        // ✅ FIX: Check for student-specific test headers
        const testStudentId = request.headers.get('x-test-student');
        
        if (testStudentId) {
          // This is a student test request
          return {
            success: true,
            user: {
              id: testStudentId,
              role: 'student',
              full_name: 'Test Student User',
              email: 'test.student@example.com',
              isTestMode: true
            }
          };
        } else {
          // Default to teacher for backward compatibility
          return {
            success: true,
            user: {
              id: TEST_TEACHER_ID,
              role: 'teacher',
              full_name: 'Test Teacher User',
              email: 'test.teacher@example.com',
              isTestMode: true
            }
          };
        }
      }

    // Production authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required',
        status: 401
      };
    }

    // ✅ SINGLE database query for user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return {
        success: false,
        error: 'User profile not found',
        status: 404
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        role: userProfile.role,
        full_name: userProfile.full_name,
        email: userProfile.email,
        isTestMode: false
      }
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 500
    };
  }
}

// ===============================================================================
// 🛡️ ROLE-BASED ACCESS CONTROL
// ===============================================================================
export function requireRole(allowedRoles: string[]) {
  return function(handler: Function) {
    return async function(request: NextRequest, ...args: any[]) {
      
      // ✅ Single authentication call
      const authResult = await authenticateUser(request);
      
      if (!authResult.success) {
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status || 500 }
        );
      }

      const { user } = authResult;

      // ✅ Role validation
      if (!allowedRoles.includes(user!.role)) {
        return NextResponse.json({
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}`
        }, { status: 403 });
      }

      // ✅ Add user to request for handler to use
      (request as any).user = user;
      
      return handler(request, ...args);
    };
  };
}

// ===============================================================================
// 🎯 CONVENIENCE WRAPPERS
// ===============================================================================
export const requireTeacher = requireRole(['teacher']);
export const requireStudent = requireRole(['student']);
export const requireTeacherOrStudent = requireRole(['teacher', 'student']);

// ===============================================================================
// 🔧 UTILITY FUNCTIONS
// ===============================================================================
export function getCurrentUser(request: NextRequest): AuthenticatedUser | null {
  return (request as any).user || null;
}

export function isTestMode(request: NextRequest): boolean {
  return process.env.NODE_ENV !== 'production' && 
         request.headers.get('x-test-mode') === 'true';
}