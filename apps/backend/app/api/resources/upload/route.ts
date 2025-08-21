// app/api/resources/upload/route.ts
// REFACTORED: Using centralized auth middleware

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { requireTeacher, getCurrentUser } from '../../../../lib/auth/middleware';

// ===============================================================================
// 📁 UPLOAD RESOURCE HANDLER
// ===============================================================================
async function uploadResourceHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`📁 Starting resource upload for ${user.full_name}`);

        const contentType = request.headers.get('content-type') || '';

        // Handle JSON requests (for testing/API integration)
        if (contentType.includes('application/json')) {
            const body = await request.json();
            const { title, description, file_url, file_type, subject, grade_level } = body;

            // Validation
            if (!title || !file_url || !file_type) {
                return NextResponse.json({
                    error: 'Missing required fields: title, file_url, file_type'
                }, { status: 400 });
            }

            const { data: resource, error: dbError } = await supabaseAdmin
                .from('resources')
                .insert({
                    user_id: user.id,
                    title: title,
                    description: description || '',
                    subject: subject || 'General',
                    grade_level: grade_level || 'Mixed',
                    file_url: file_url,
                    file_type: file_type,
                    file_size: 0,
                    upload_status: 'ready',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (dbError) {
                console.error('Database error:', dbError);
                return NextResponse.json({
                    error: 'Failed to save resource metadata',
                    details: process.env.NODE_ENV !== 'production' ? dbError.message : undefined
                }, { status: 500 });
            }

            console.log(`✅ Resource created via JSON: ${resource.title} by ${user.full_name}`);

            return NextResponse.json({
                success: true,
                message: 'Resource created successfully',
                resource: {
                    id: resource.id,
                    title: resource.title,
                    description: resource.description,
                    subject: resource.subject,
                    grade_level: resource.grade_level,
                    file_type: resource.file_type,
                    upload_status: resource.upload_status,
                    created_at: resource.created_at
                },
                uploaded_by: user.full_name,
                test_mode: user.isTestMode
            });
        }

        // Handle multipart form data (actual file uploads)
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const title = formData.get('title') as string || file?.name || 'Untitled Resource';
        const description = formData.get('description') as string || '';
        const subject = formData.get('subject') as string || 'General';
        const grade_level = formData.get('grade_level') as string || 'Mixed';

        if (!file) {
            return NextResponse.json({
                error: 'No file provided',
                expected_format: 'multipart/form-data with file field'
            }, { status: 400 });
        }

        // File validation
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/plain',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({
                error: 'Invalid file type',
                allowed_types: ['PDF', 'DOCX', 'DOC', 'TXT', 'PPT', 'PPTX'],
                received_type: file.type
            }, { status: 400 });
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return NextResponse.json({
                error: 'File too large',
                max_size: '10MB',
                received_size: `${Math.round(file.size / 1024 / 1024 * 100) / 100}MB`
            }, { status: 400 });
        }

        // File upload to storage
        let fileUrl = '';
        let filePath = '';

        if (!user.isTestMode) {
            // Production: Upload to Supabase Storage
            const supabase = createRouteHandlerClient({ cookies });

            const timestamp = Date.now();
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            filePath = `${user.id}/${timestamp}-${sanitizedFileName}`;

            const fileBuffer = await file.arrayBuffer();

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('resources')
                .upload(filePath, fileBuffer, {
                    contentType: file.type,
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                return NextResponse.json({
                    error: 'Failed to upload file to storage',
                    details: uploadError.message
                }, { status: 500 });
            }

            const { data: { publicUrl } } = supabase.storage
                .from('resources')
                .getPublicUrl(uploadData.path);

            fileUrl = publicUrl;
        } else {
            // Test mode: Mock file URL
            fileUrl = `https://mock-storage.example.com/test-files/${file.name}`;
            filePath = `test/${file.name}`;
            console.log('🧪 Mock file upload - not actually uploading in test mode');
        }

        // Save metadata to database
        const { data: resource, error: dbError } = await supabaseAdmin
            .from('resources')
            .insert({
                user_id: user.id,
                title: title,
                description: description,
                subject: subject,
                grade_level: grade_level,
                file_url: fileUrl,
                file_path: filePath,
                file_type: file.type,
                file_size: file.size,
                upload_status: 'ready',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);

            // Cleanup file if database save fails
            if (!user.isTestMode && filePath) {
                try {
                    const supabase = createRouteHandlerClient({ cookies });
                    await supabase.storage.from('resources').remove([filePath]);
                } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError);
                }
            }

            return NextResponse.json({
                error: 'Failed to save file metadata',
                details: process.env.NODE_ENV !== 'production' ? dbError.message : undefined
            }, { status: 500 });
        }

        console.log(`✅ File uploaded successfully: ${resource.title} (${Math.round(file.size / 1024)}KB) by ${user.full_name}`);

        return NextResponse.json({
            success: true,
            message: 'File uploaded successfully',
            resource: {
                id: resource.id,
                title: resource.title,
                description: resource.description,
                subject: resource.subject,
                grade_level: resource.grade_level,
                file_type: resource.file_type,
                file_size: resource.file_size,
                upload_status: resource.upload_status,
                created_at: resource.created_at
            },
            uploaded_by: user.full_name,
            test_mode: user.isTestMode
        });

    } catch (error) {
        console.error('💥 Resource upload failed:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// 📋 GET UPLOAD INFO HANDLER
// ===============================================================================
async function getUploadInfoHandler(request: NextRequest) {
    const user = getCurrentUser(request);

    return NextResponse.json({
        message: "Resource Upload API is running",
        user: user ? {
            name: user.full_name,
            role: user.role,
            test_mode: user.isTestMode
        } : null,
        methods: ["POST"],
        content_types: ["multipart/form-data", "application/json"],

        example_multipart: {
            description: "Upload actual files using multipart/form-data",
            fields: {
                file: "File object (required)",
                title: "Resource title (optional)",
                description: "Resource description (optional)",
                subject: "Subject area (optional)",
                grade_level: "Grade level (optional)"
            }
        },

        example_json: {
            description: "Create resource record with existing file URL",
            body: {
                title: "Test Document",
                description: "Test description",
                file_url: "https://example.com/file.pdf",
                file_type: "application/pdf",
                subject: "Mathematics",
                grade_level: "Grade 10"
            }
        }
    });
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const POST = requireTeacher(uploadResourceHandler);
export const GET = getUploadInfoHandler;