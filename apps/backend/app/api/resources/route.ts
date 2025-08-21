// app/api/resources/route.ts
// REFACTORED: Using centralized auth middleware

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/db/supabase';
import { requireTeacher, getCurrentUser } from '../../../lib/auth/middleware';

// ===============================================================================
// 📚 GET RESOURCES HANDLER
// ===============================================================================
async function getResourcesHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`📚 Loading resources for ${user.full_name}`);

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const subject = searchParams.get('subject');
        const file_type = searchParams.get('file_type');
        const grade_level = searchParams.get('grade_level');
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Build query with filters
        let query = supabaseAdmin
            .from('resources')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id);

        // Apply filters
        if (subject && subject !== 'all') {
            query = query.eq('subject', subject);
        }
        if (file_type && file_type !== 'all') {
            query = query.eq('file_type', file_type);
        }
        if (grade_level && grade_level !== 'all') {
            query = query.eq('grade_level', grade_level);
        }
        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        // Apply pagination and ordering
        const { data: resources, error, count } = await query
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({
                error: 'Failed to fetch resources',
                details: process.env.NODE_ENV !== 'production' ? error.message : undefined
            }, { status: 500 });
        }

        // Calculate summary statistics
        const { data: allUserResources } = await supabaseAdmin
            .from('resources')
            .select('subject, file_type, file_size, analyzed_at, grade_level')
            .eq('user_id', user.id);

        const summary = {
            total_resources: count || 0,
            total_size_bytes: allUserResources?.reduce((sum, r) => sum + (r.file_size || 0), 0) || 0,
            analyzed_count: allUserResources?.filter(r => r.analyzed_at).length || 0,
            subjects: Array.from(new Set(allUserResources?.map(r => r.subject) || [])),
            file_types: Array.from(new Set(allUserResources?.map(r => r.file_type) || [])),
            grade_levels: Array.from(new Set(allUserResources?.map(r => r.grade_level) || []))
        };

        // Format file size for display
        const formatFileSize = (bytes: number) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        // Format response data
        const formattedResources = resources?.map(resource => ({
            id: resource.id,
            title: resource.title,
            description: resource.description,
            subject: resource.subject,
            grade_level: resource.grade_level,
            file_type: resource.file_type,
            file_size: resource.file_size,
            file_size_formatted: formatFileSize(resource.file_size || 0),
            upload_status: resource.upload_status,
            is_analyzed: !!resource.analyzed_at,
            analyzed_at: resource.analyzed_at,
            created_at: resource.created_at,
            updated_at: resource.updated_at,
            // Don't expose file URLs in list view for security
            has_file: !!resource.file_url,
            // Show if it has AI analysis
            has_analysis: !!resource.analysis_result
        })) || [];

        console.log(`✅ Resources loaded: ${formattedResources.length} of ${count} total for ${user.full_name}`);

        return NextResponse.json({
            success: true,
            data: {
                resources: formattedResources,
                summary: {
                    ...summary,
                    total_size_formatted: formatFileSize(summary.total_size_bytes),
                    analysis_percentage: summary.total_resources > 0
                        ? Math.round((summary.analyzed_count / summary.total_resources) * 100)
                        : 0,
                    current_page: Math.floor(offset / limit) + 1,
                    total_pages: Math.ceil((count || 0) / limit),
                    has_more: (offset + limit) < (count || 0)
                }
            },
            pagination: {
                limit,
                offset,
                count: count || 0
            },
            filters: {
                subject,
                file_type,
                grade_level,
                search
            },
            user: {
                name: user.full_name,
                test_mode: user.isTestMode
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('💥 Resources loading failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to load resources',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// 🗑️ DELETE RESOURCE HANDLER
// ===============================================================================
async function deleteResourceHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        console.log(`🗑️ Deleting resource for ${user.full_name}`);

        // Get resource ID from query or body
        const { searchParams } = new URL(request.url);
        let resourceId = searchParams.get('id');

        if (!resourceId) {
            try {
                const body = await request.json();
                resourceId = body.id;
            } catch {
                // If no JSON body, that's okay
            }
        }

        if (!resourceId) {
            return NextResponse.json({
                error: 'Resource ID required',
                hint: 'Provide ID as query parameter (?id=...) or in request body'
            }, { status: 400 });
        }

        // Get resource to verify ownership and get file path
        const { data: resource, error: fetchError } = await supabaseAdmin
            .from('resources')
            .select('id, title, file_path, file_url')
            .eq('id', resourceId)
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
                    // Continue with database deletion even if storage deletion fails
                }
            } catch (storageError) {
                console.warn('Storage deletion failed:', storageError);
            }
        } else if (user.isTestMode) {
            console.log('🧪 Mock file deletion - not actually deleting from storage');
        }

        // Delete resource record from database
        const { error: deleteError } = await supabaseAdmin
            .from('resources')
            .delete()
            .eq('id', resourceId)
            .eq('user_id', user.id);

        if (deleteError) {
            console.error('Delete error:', deleteError);
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
            success: false,
            error: 'Failed to delete resource',
            details: process.env.NODE_ENV !== 'production' ?
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireTeacher(getResourcesHandler);
export const DELETE = requireTeacher(deleteResourceHandler);