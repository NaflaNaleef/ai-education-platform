import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '../../../lib/ai/ai-client';
import { supabaseAdmin as supabase } from '../../../lib/db/supabase';

export async function POST(request: NextRequest) {
    try {
        const { resourceId } = await request.json();

        if (!resourceId) {
            return NextResponse.json(
                { error: 'Resource ID is required' },
                { status: 400 }
            );
        }

        // Fetch resource from database
        const { data: resource, error } = await supabase
            .from('resources')
            .select('*')
            .eq('id', resourceId)
            .single();

        if (error || !resource) {
            return NextResponse.json(
                { error: 'Resource not found' },
                { status: 404 }
            );
        }

        // Get file content from Supabase Storage
        const { data: fileData } = await supabase.storage
            .from('resources')
            .download(resource.file_path);

        if (!fileData) {
            return NextResponse.json(
                { error: 'File content not found' },
                { status: 404 }
            );
        }

        const fileContent = await fileData.text();

        // Send to AI service for analysis
        const analysisResult = await aiClient.analyzeContent({
            file_content: fileContent,
            file_type: resource.file_type || 'txt',
            resource_id: resourceId
        });

        // Update resource with analysis results
        const { error: updateError } = await supabase
            .from('resources')
            .update({
                analysis_result: analysisResult,
                analyzed_at: new Date().toISOString()
            })
            .eq('id', resourceId);

        if (updateError) {
            console.error('Failed to update resource:', updateError);
        }

        return NextResponse.json({
            success: true,
            resource_id: resourceId,
            analysis: analysisResult
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Resource analysis failed:', error);
        return NextResponse.json(
            { error: 'Analysis failed', details: message },
            { status: 500 }
        );
    }
} 