// app/api/resources/[id]/route.ts
// REFACTORED: Using centralized auth middleware

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { aiClient } from '../../../../lib/ai/ai-client';
import { requireTeacher, getCurrentUser } from '../../../../lib/auth/middleware';

// ===============================================================================
// 📄 GET RESOURCE DETAILS HANDLER
// ===============================================================================
async function getResourceHandler(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`📄 Loading resource details: ${params.id} for ${user.full_name}`);

        const { data: resource, error: resourceError } = await supabaseAdmin
            .from('resources')
            .select('*')
            .eq('id', params.id)
            .eq('user_id', user.id)
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({
                error: 'Resource not found or access denied',
                details: process.env.NODE_ENV !== 'production' ? resourceError?.message : undefined
            }, { status: 404 });
        }

        // Generate download URL
        let downloadUrl = resource.file_url;

        if (!user.isTestMode && resource.file_path && !downloadUrl) {
            const supabase = createRouteHandlerClient({ cookies });
            const { data: signedUrlData } = await supabase.storage
                .from('resources')
                .createSignedUrl(resource.file_path, 3600);

            downloadUrl = signedUrlData?.signedUrl || resource.file_url;
        } else if (user.isTestMode && !downloadUrl) {
            downloadUrl = `https://mock-storage.example.com/test-files/${resource.title}`;
        }

        console.log(`✅ Resource details loaded: ${resource.title}`);

        return NextResponse.json({
            success: true,
            resource: {
                id: resource.id,
                title: resource.title,
                description: resource.description,
                subject: resource.subject,
                grade_level: resource.grade_level,
                file_type: resource.file_type,
                file_size: resource.file_size,
                upload_status: resource.upload_status,
                download_url: downloadUrl,
                analysis_result: resource.analysis_result,
                analyzed_at: resource.analyzed_at,
                created_at: resource.created_at,
                updated_at: resource.updated_at
            },
            user: {
                name: user.full_name,
                test_mode: user.isTestMode
            }
        });

    } catch (error) {
        console.error('💥 Resource details loading failed:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// 🔄 RESOURCE ACTIONS HANDLER (ANALYZE, EXTRACT)
// ===============================================================================
async function processResourceActionHandler(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`🔄 Processing action on resource: ${params.id} for ${user.full_name}`);

        const { action, ...actionData } = await request.json();

        if (!action) {
            return NextResponse.json({
                error: 'Action is required',
                available_actions: ['analyze', 'extract-content'],
                note: 'For question generation, use /api/teacher/create-question-paper for complete workflow'
            }, { status: 400 });
        }

        // Get resource with ownership verification
        const { data: resource, error: resourceError } = await supabaseAdmin
            .from('resources')
            .select('*')
            .eq('id', params.id)
            .eq('user_id', user.id)
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({
                error: 'Resource not found or access denied',
                details: process.env.NODE_ENV !== 'production' ? resourceError?.message : undefined
            }, { status: 404 });
        }

        // Handle different actions with real AI
        switch (action) {
            case 'analyze':
                try {
                    console.log(`🧠 Analyzing resource: ${resource.title}`);

                    const analysisResult = await aiClient.analyzeContent({
                        file_content: resource.content_preview || resource.description,
                        file_type: resource.file_type,
                        resource_id: params.id
                    }, {
                        user_id: user.id
                    });

                    // Update resource with analysis
                    const { error: updateError } = await supabaseAdmin
                        .from('resources')
                        .update({
                            analysis_result: analysisResult,
                            analyzed_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', params.id);

                    if (updateError) {
                        console.warn('Failed to save analysis:', updateError);
                    }

                    console.log(`✅ Resource analyzed: ${resource.title} by ${user.full_name}`);

                    return NextResponse.json({
                        success: true,
                        action: 'analyze',
                        resource_id: params.id,
                        resource_title: resource.title,
                        analysis: analysisResult,
                        analyzed_by: user.full_name,
                        test_mode: user.isTestMode
                    });

                } catch (error) {
                    console.error('AI Analysis failed:', error);
                    return NextResponse.json({
                        error: 'Content analysis failed',
                        ai_error: error instanceof Error ? error.message : String(error),
                        details: process.env.NODE_ENV !== 'production' ?
                            (error instanceof Error ? error.message : String(error)) : undefined
                    }, { status: 500 });
                }

            case 'extract-content':
                try {
                    console.log(`📖 Extracting content from: ${resource.title}`);

                    const extractedContent = await aiClient.analyzeContent({
                        file_content: resource.content_preview || resource.description,
                        file_type: resource.file_type,
                        resource_id: params.id
                    });

                    // Update resource with extracted content
                    const { error: updateError } = await supabaseAdmin
                        .from('resources')
                        .update({
                            content_preview: resource.content_preview,
                            full_content: resource.full_content,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', params.id);

                    if (updateError) {
                        console.warn('Failed to save extracted content:', updateError);
                    }

                    console.log(`✅ Content extracted from: ${resource.title} by ${user.full_name}`);

                    return NextResponse.json({
                        success: true,
                        action: 'extract-content',
                        resource_id: params.id,
                        resource_title: resource.title,
                        extracted_content: {
                            preview: resource.content_preview,
                            full_content: resource.full_content
                        },
                        extracted_by: user.full_name,
                        test_mode: user.isTestMode
                    });

                } catch (error) {
                    console.error('AI Content extraction failed:', error);
                    return NextResponse.json({
                        error: 'Content extraction failed',
                        ai_error: error instanceof Error ? error.message : String(error),
                        details: process.env.NODE_ENV !== 'production' ?
                            (error instanceof Error ? error.message : String(error)) : undefined
                    }, { status: 500 });
                }

            default:
                return NextResponse.json({
                    error: 'Invalid action',
                    available_actions: ['analyze', 'extract-content'],
                    received_action: action,
                    note: 'For question generation, use /api/teacher/create-question-paper for complete workflow'
                }, { status: 400 });
        }

    } catch (error) {
        console.error('💥 Resource action failed:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// ✏️ UPDATE RESOURCE HANDLER
// ===============================================================================
async function updateResourceHandler(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`✏️ Updating resource: ${params.id} for ${user.full_name}`);

        const updateData = await request.json();

        // Validate and filter allowed fields
        const allowedFields = ['title', 'description', 'subject', 'grade_level'];
        const filteredData = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                if (updateData[key] !== undefined && updateData[key] !== null) {
                    obj[key] = updateData[key];
                }
                return obj;
            }, {} as any);

        if (Object.keys(filteredData).length === 0) {
            return NextResponse.json({
                error: 'No valid fields to update',
                allowed_fields: allowedFields,
                received_fields: Object.keys(updateData)
            }, { status: 400 });
        }

        filteredData.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('resources')
            .update(filteredData)
            .eq('id', params.id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({
                error: 'Failed to update resource',
                details: process.env.NODE_ENV !== 'production' ? error.message : undefined
            }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({
                error: 'Resource not found or access denied'
            }, { status: 404 });
        }

        console.log(`✅ Resource updated: ${data.title} by ${user.full_name}`);

        return NextResponse.json({
            success: true,
            message: 'Resource updated successfully',
            resource: {
                id: data.id,
                title: data.title,
                description: data.description,
                subject: data.subject,
                grade_level: data.grade_level,
                updated_at: data.updated_at
            },
            updated_fields: Object.keys(filteredData).filter(key => key !== 'updated_at'),
            updated_by: user.full_name,
            test_mode: user.isTestMode
        });

    } catch (error) {
        console.error('💥 Resource update failed:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// 🗑️ DELETE RESOURCE HANDLER
// ===============================================================================
async function deleteResourceHandler(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`🗑️ Deleting resource: ${params.id} for ${user.full_name}`);

        // Get resource to verify ownership and get file path
        const { data: resource, error: fetchError } = await supabaseAdmin
            .from('resources')
            .select('id, title, file_path')
            .eq('id', params.id)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !resource) {
            return NextResponse.json({
                error: 'Resource not found or access denied',
                details: process.env.NODE_ENV !== 'production' ? fetchError?.message : undefined
            }, { status: 404 });
        }

        // Delete file from storage
        if (!user.isTestMode && resource.file_path) {
            try {
                const supabase = createRouteHandlerClient({ cookies });
                const { error: storageError } = await supabase.storage
                    .from('resources')
                    .remove([resource.file_path]);

                if (storageError) {
                    console.warn('Storage deletion warning:', storageError);
                }
            } catch (storageError) {
                console.warn('Storage deletion failed:', storageError);
            }
        } else if (user.isTestMode) {
            console.log('🧪 Mock file deletion - not actually deleting from storage');
        }

        // Delete resource record
        const { error: deleteError } = await supabaseAdmin
            .from('resources')
            .delete()
            .eq('id', params.id)
            .eq('user_id', user.id);

        if (deleteError) {
            return NextResponse.json({
                error: 'Failed to delete resource',
                details: process.env.NODE_ENV !== 'production' ? deleteError.message : undefined
            }, { status: 500 });
        }

        console.log(`✅ Resource deleted: ${resource.title} by ${user.full_name}`);

        return NextResponse.json({
            success: true,
            message: 'Resource deleted successfully',
            deleted_resource: {
                id: resource.id,
                title: resource.title
            },
            deleted_by: user.full_name,
            test_mode: user.isTestMode
        });

    } catch (error) {
        console.error('💥 Resource deletion failed:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireTeacher(getResourceHandler);
export const POST = requireTeacher(processResourceActionHandler);
export const PUT = requireTeacher(updateResourceHandler);
export const DELETE = requireTeacher(deleteResourceHandler);