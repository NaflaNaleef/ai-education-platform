import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const title = formData.get('title') as string || file.name;
        const description = formData.get('description') as string || '';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/plain'
        ];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({
                error: 'Invalid file type. Only PDF, DOCX, DOC, and TXT files are allowed.'
            }, { status: 400 });
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return NextResponse.json({
                error: 'File too large. Maximum size is 10MB.'
            }, { status: 400 });
        }

        // Initialize Supabase client
        const supabase = createRouteHandlerClient({ cookies });

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Create unique file name
        const timestamp = Date.now();
        const fileName = `${user.id}/${timestamp}-${file.name}`;

        // Convert file to buffer
        const fileBuffer = await file.arrayBuffer();

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('resources')
            .upload(fileName, fileBuffer, {
                contentType: file.type,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json({
                error: 'Failed to upload file'
            }, { status: 500 });
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
            .from('resources')
            .getPublicUrl(uploadData.path);

        // Save file metadata to your existing table structure
        const { data: resource, error: dbError } = await supabase
            .from('resources')
            .insert({
                user_id: user.id,
                title: title,
                description: description,
                file_url: publicUrl,
                file_type: file.type,
                file_size: file.size,
                upload_status: 'ready', // Set as ready since upload is complete
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            return NextResponse.json({
                error: 'Failed to save file metadata'
            }, { status: 500 });
        }

        return NextResponse.json({
            message: 'File uploaded successfully',
            resource: resource
        }, { status: 201 });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
} 