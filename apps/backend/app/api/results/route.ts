import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/db/supabase';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const submission_id = searchParams.get('submission_id');
        if (!submission_id) {
            return NextResponse.json({ success: false, error: 'submission_id required' }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin
            .from('results')
            .select('total_score, max_score, percentage, question_scores, ai_feedback, teacher_feedback, graded_by, graded_at, reviewed_at')
            .eq('submission_id', submission_id)
            .single();
        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Results not found' }, { status: 404 });
        }
        return NextResponse.json({
            success: true,
            results: {
                total_score: data.total_score,
                max_score: data.max_score,
                percentage: data.percentage,
                question_scores: data.question_scores,
                ai_feedback: data.ai_feedback,
                teacher_feedback: data.teacher_feedback,
                graded_by: data.graded_by,
                graded_at: data.graded_at,
                reviewed_at: data.reviewed_at
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
} 