import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// GET - List user's resources (YOU ALREADY HAVE THIS ✅)
export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's resources with optional filtering
        const { searchParams } = new URL(request.url);
        const subject = searchParams.get('subject');
        const file_type = searchParams.get('file_type');
        
        let query = supabase
            .from('resources')
            .select('*')
            .eq('user_id', user.id);

        // Add filters if provided
        if (subject) query = query.eq('subject', subject);
        if (file_type) query = query.eq('file_type', file_type);

        const { data: resources, error } = await query
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({
                error: 'Failed to fetch resources'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            resources: resources || [],
            count: resources?.length || 0
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// PUT - Update resource metadata
export async function PUT(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const resourceId = searchParams.get('id');
        
        if (!resourceId) {
            return NextResponse.json({ error: 'Resource ID required' }, { status: 400 });
        }

        const { title, description, subject, grade_level } = await request.json();

        const { data, error } = await supabase
            .from('resources')
            .update({
                title,
                description,
                subject,
                grade_level,
                updated_at: new Date().toISOString()
            })
            .eq('id', resourceId)
            .eq('user_id', user.id) // Ensure user owns the resource
            .select()
            .single();

        if (error) {
            console.error('Update error:', error);
            return NextResponse.json({ 
                error: 'Failed to update resource',
                details: error.message 
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            resource: data,
            message: 'Resource updated successfully'
        });

    } catch (error) {
        console.error('Update resource error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// DELETE - Delete resource and file
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const resourceId = searchParams.get('id');
        
        if (!resourceId) {
            return NextResponse.json({ error: 'Resource ID required' }, { status: 400 });
        }

        // First, get the resource to find the file path
        const { data: resource, error: fetchError } = await supabase
            .from('resources')
            .select('file_url, file_path')
            .eq('id', resourceId)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !resource) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        // Delete file from storage if it exists
        if (resource.file_path) {
            const { error: storageError } = await supabase.storage
                .from('resources')
                .remove([resource.file_path]);
            
            if (storageError) {
                console.warn('Storage deletion warning:', storageError);
                // Continue with database deletion even if storage deletion fails
            }
        }

        // Delete resource record from database
        const { error: deleteError } = await supabase
            .from('resources')
            .delete()
            .eq('id', resourceId)
            .eq('user_id', user.id);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return NextResponse.json({ 
                error: 'Failed to delete resource',
                details: deleteError.message 
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Resource deleted successfully'
        });

    } catch (error) {
        console.error('Delete resource error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}
