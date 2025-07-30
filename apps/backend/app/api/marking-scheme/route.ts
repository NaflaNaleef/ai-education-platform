import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/db/supabase';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const question_paper_id = searchParams.get('question_paper_id');
        if (!question_paper_id) {
            return NextResponse.json({ success: false, error: 'question_paper_id required' }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin
            .from('question_papers')
            .select('marking_scheme')
            .eq('id', question_paper_id)
            .single();
        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Marking scheme not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, marking_scheme: data.marking_scheme });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
} 