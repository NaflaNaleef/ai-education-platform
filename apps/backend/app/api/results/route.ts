// app/api/results/route.ts
// REFACTORED: Added proper authentication and role-based access control

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/db/supabase';
import { requireTeacherOrStudent, getCurrentUser } from '../../../lib/auth/middleware';

// ===============================================================================
// 📊 GET RESULTS HANDLER
// ===============================================================================
async function getResultsHandler(request: NextRequest) {
    try {
        const user = getCurrentUser(request)!;
        
        const { searchParams } = new URL(request.url);
        const submission_id = searchParams.get('submission_id');
        
        if (!submission_id) {
            return NextResponse.json({ 
                success: false, 
                error: 'submission_id required' 
            }, { status: 400 });
        }

        console.log(`📊 Getting results for submission: ${submission_id} by ${user.role}: ${user.full_name}`);

        // Get results with submission details for ownership verification
        const { data: result, error: resultError } = await supabaseAdmin
            .from('results')
            .select(`
                id,
                submission_id,
                total_score,
                max_score,
                percentage,
                grade,
                question_scores,
                ai_feedback,
                teacher_feedback,
                graded_by,
                graded_at,
                reviewed_at,
                submissions!inner(
                    id,
                    student_id,
                    question_paper_id,
                    question_papers!inner(
                        id,
                        title,
                        teacher_id
                    )
                )
            `)
            .eq('submission_id', submission_id)
            .single();

        if (resultError || !result) {
            return NextResponse.json({ 
                success: false, 
                error: 'Results not found' 
            }, { status: 404 });
        }

        // Extract submission data safely
        const submission = Array.isArray(result.submissions) ? result.submissions[0] : result.submissions;
        const questionPaper = Array.isArray(submission.question_papers) ? 
            submission.question_papers[0] : submission.question_papers;

        // ✅ ROLE-BASED ACCESS CONTROL
        let hasAccess = false;
        let accessReason = '';

        if (user.role === 'student') {
            // Students can only see their own results
            hasAccess = submission.student_id === user.id;
            accessReason = hasAccess ? 'Student viewing own results' : 'Student can only view own results';
        } else if (user.role === 'teacher') {
            // Teachers can see results for their question papers
            hasAccess = questionPaper.teacher_id === user.id;
            accessReason = hasAccess ? 'Teacher viewing results for own question paper' : 'Teacher can only view results for own question papers';
        }

        if (!hasAccess) {
            console.log(`❌ Access denied: ${accessReason} for user ${user.full_name}`);
            return NextResponse.json({ 
                success: false, 
                error: 'Access denied. You can only view results you have permission to see.' 
            }, { status: 403 });
        }

        console.log(`✅ Results retrieved: ${accessReason} for ${user.full_name}`);

        // Format response based on user role
        const response = {
            success: true,
            results: {
                id: result.id,
                submission_id: result.submission_id,
                total_score: result.total_score,
                max_score: result.max_score,
                percentage: result.percentage,
                grade: result.grade,
                question_scores: result.question_scores,
                ai_feedback: result.ai_feedback,
                teacher_feedback: result.teacher_feedback,
                graded_by: result.graded_by,
                graded_at: result.graded_at,
                reviewed_at: result.reviewed_at,
                
                // Add context information
                quiz_title: questionPaper.title,
                submission_info: {
                    student_id: submission.student_id,
                    question_paper_id: submission.question_paper_id
                }
            },
            user: {
                role: user.role,
                name: user.full_name,
                test_mode: user.isTestMode
            },
            access_info: {
                reason: accessReason,
                can_edit: user.role === 'teacher' && questionPaper.teacher_id === user.id
            }
        };

        // ✅ PRIVACY: Hide sensitive info based on role
        if (user.role === 'student') {
            // Students don't need to see internal grading details
            delete response.results.ai_feedback?.grading_methods_used;
            delete response.results.ai_feedback?.marking_scheme_used;
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('💥 Results retrieval failed:', error);
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
export const GET = requireTeacherOrStudent(getResultsHandler);