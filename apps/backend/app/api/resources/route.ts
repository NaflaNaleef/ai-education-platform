import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's resources
        const { data: resources, error } = await supabase
            .from('resources')
            .select('*')
            .eq('user_id', user.id)
            .order('uploaded_at', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({
                error: 'Failed to fetch resources'
            }, { status: 500 });
        }

        return NextResponse.json({
            resources: resources || []
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
} 