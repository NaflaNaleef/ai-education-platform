import { z } from 'zod';

// User schemas
export const CreateUserSchema = z.object({
    clerk_id: z.string().min(1, 'Clerk ID is required'),
    email: z.string().email('Valid email is required'),
    full_name: z.string().min(1, 'Full name is required').max(255),
    role: z.enum(['teacher', 'student', 'guardian'], {
        errorMap: () => ({ message: 'Role must be teacher, student, or guardian' })
    }),
    profile_image_url: z.string().url().optional(),
});

export const UpdateUserSchema = z.object({
    full_name: z.string().min(1).max(255).optional(),
    profile_image_url: z.string().url().optional(),
    preferences: z.record(z.any()).optional(),
});

export const UserRoleSchema = z.object({
    role: z.enum(['teacher', 'student', 'guardian'])
});

// Response types
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>['role'];

// API Response interfaces
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export interface UserResponse {
    id: string;
    clerk_id: string;
    email: string;
    full_name: string;
    role: UserRole;
    profile_image_url?: string;
    preferences?: Record<string, any>;
    created_at: string;
    updated_at: string;
} 