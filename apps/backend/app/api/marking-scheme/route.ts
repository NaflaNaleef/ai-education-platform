// app/api/marking-scheme/route.ts
// REFACTORED: Added proper authentication and access control

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/db/supabase';
import { requireTeacher, getCurrentUser } from '../../../lib/auth/middleware';

// ===============================================================================
// 📋 GET MARKING SCHEME HANDLER
// ===============================================================================
async function getMarkingSchemeHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        
        const { searchParams } = new URL(request.url);
        const question_paper_id = searchParams.get('question_paper_id');
        
        if (!question_paper_id) {
            return NextResponse.json({ 
                success: false, 
                error: 'question_paper_id required' 
            }, { status: 400 });
        }

        console.log(`📋 Getting marking scheme for question paper: ${question_paper_id} by teacher: ${user.full_name}`);

        // Get question paper and verify ownership
        const { data: questionPaper, error: qpError } = await supabaseAdmin
            .from('question_papers')
            .select('id, title, teacher_id, marking_scheme')
            .eq('id', question_paper_id)
            .single();

        if (qpError || !questionPaper) {
            return NextResponse.json({ 
                success: false, 
                error: 'Question paper not found' 
            }, { status: 404 });
        }

        // ✅ SECURITY: Verify teacher owns this question paper
        if (questionPaper.teacher_id !== user.id) {
            return NextResponse.json({ 
                success: false, 
                error: 'Access denied. You can only view marking schemes for your own question papers.' 
            }, { status: 403 });
        }

        if (!questionPaper.marking_scheme) {
            return NextResponse.json({ 
                success: false, 
                error: 'No marking scheme found for this question paper' 
            }, { status: 404 });
        }

        console.log(`✅ Marking scheme retrieved for "${questionPaper.title}" by ${user.full_name}`);

        return NextResponse.json({ 
            success: true, 
            marking_scheme: questionPaper.marking_scheme,
            question_paper: {
                id: questionPaper.id,
                title: questionPaper.title
            },
            teacher: {
                name: user.full_name,
                test_mode: user.isTestMode
            }
        });

    } catch (error) {
        console.error('💥 Marking scheme retrieval failed:', error);
        return NextResponse.json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV !== 'production' ? 
                (error instanceof Error ? error.message : String(error)) : undefined
        }, { status: 500 });
    }
}

// ===============================================================================
// ✅ EXPORT WITH MIDDLEWARE PROTECTION
// ===============================================================================
export const GET = requireTeacher(getMarkingSchemeHandler);