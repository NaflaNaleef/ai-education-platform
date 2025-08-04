import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '../../../../lib/ai/ai-client';

// GET - Get individual resource details (YOU ALREADY HAVE THIS ✅)
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
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
            .eq('id', params.id)
            .eq('user_id', user.id)
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({
                error: 'Resource not found'
            }, { status: 404 });
        }

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
                file_url: resource.file_url,
                upload_status: resource.upload_status,
                analysis_result: resource.analysis_result,
                created_at: resource.created_at,
                updated_at: resource.updated_at
            }
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// POST - Trigger actions on individual resource (ANALYZE, GENERATE)
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, ...actionData } = await request.json();

        // Get resource
        const { data: resource, error: resourceError } = await supabase
            .from('resources')
            .select('*')
            .eq('id', params.id)
            .eq('user_id', user.id)
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        switch (action) {
            case 'analyze':
                try {
                    // Call AI service to analyze content
                    const analysisResult = await aiClient.analyzeContent({
                        file_content: resource.content_preview || resource.description,
                        file_type: resource.file_type,
                        resource_id: params.id
                    });

                    // Update resource with analysis
                    const { error: updateError } = await supabase
                        .from('resources')
                        .update({
                            analysis_result: analysisResult,
                            analyzed_at: new Date().toISOString()
                        })
                        .eq('id', params.id);

                    if (updateError) {
                        console.warn('Failed to save analysis:', updateError);
                    }

                    return NextResponse.json({
                        success: true,
                        action: 'analyze',
                        analysis: analysisResult
                    });

                } catch (error) {
                    console.error('Analysis failed:', error);
                    return NextResponse.json({
                        error: 'Content analysis failed',
                        details: error instanceof Error ? error.message : String(error)
                    }, { status: 500 });
                }

            case 'generate-questions':
                try {
                    // Generate questions using the resource
                    const questionResult = await aiClient.generateQuestions({
                        content: resource.content_preview || resource.description,
                        question_count: actionData.questionCount || 10,
                        difficulty_level: actionData.difficultyLevel || 'medium',
                        question_types: actionData.questionTypes || ['multiple_choice', 'short_answer']
                    });

                    return NextResponse.json({
                        success: true,
                        action: 'generate-questions',
                        resource_id: params.id,
                        resource_title: resource.title,
                        questions: questionResult
                    });

                } catch (error) {
                    console.error('Question generation failed:', error);
                    return NextResponse.json({
                        error: 'Question generation failed',
                        details: error instanceof Error ? error.message : String(error)
                    }, { status: 500 });
                }

            default:
                return NextResponse.json({
                    error: 'Invalid action',
                    available_actions: ['analyze', 'generate-questions']
                }, { status: 400 });
        }

    } catch (error) {
        console.error('Resource action error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// PUT - Update individual resource
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const updateData = await request.json();

        // Only allow certain fields to be updated
        const allowedFields = ['title', 'description', 'subject', 'grade_level'];
        const filteredData = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updateData[key];
                return obj;
            }, {} as any);

        filteredData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('resources')
            .update(filteredData)
            .eq('id', params.id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
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

// DELETE - Delete individual resource
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get resource first to find file path
        const { data: resource, error: fetchError } = await supabase
            .from('resources')
            .select('file_path')
            .eq('id', params.id)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !resource) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        // Delete file from storage
        if (resource.file_path) {
            const { error: storageError } = await supabase.storage
                .from('resources')
                .remove([resource.file_path]);
            
            if (storageError) {
                console.warn('Storage deletion warning:', storageError);
            }
        }

        // Delete resource record
        const { error: deleteError } = await supabase
            .from('resources')
            .delete()
            .eq('id', params.id)
            .eq('user_id', user.id);

        if (deleteError) {
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