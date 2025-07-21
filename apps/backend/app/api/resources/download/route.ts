import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const resourceId = searchParams.get('id');

        if (!resourceId) {
            return NextResponse.json({
                error: 'Resource ID is required'
            }, { status: 400 });
        }

        const supabase = createRouteHandlerClient({ cookies });

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get resource metadata (verify ownership)
        const { data: resource, error: resourceError } = await supabase
            .from('resources')
            .select('*')
            .eq('id', resourceId)
            .eq('user_id', user.id)
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({
                error: 'Resource not found'
            }, { status: 404 });
        }

        // For your schema, you already have file_url, so you can return it directly
        // Or generate a new signed URL if needed for security

        return NextResponse.json({
            downloadUrl: resource.file_url,
            title: resource.title,
            description: resource.description,
            fileType: resource.file_type,
            fileSize: resource.file_size,
            uploadStatus: resource.upload_status
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
} 