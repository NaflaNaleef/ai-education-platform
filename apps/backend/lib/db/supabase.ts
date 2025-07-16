import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// Client for user operations
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Database types
export interface User {
    id: string;
    clerk_id: string;
    email: string;
    full_name: string;
    role: 'teacher' | 'student' | 'guardian';
    profile_image_url?: string;
    preferences?: any;
    created_at: string;
    updated_at: string;
}

export interface Resource {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    file_url: string;
    file_type: string;
    file_size?: number;
    content_preview?: string;
    upload_status: 'processing' | 'ready' | 'failed';
    created_at: string;
    updated_at: string;
} 