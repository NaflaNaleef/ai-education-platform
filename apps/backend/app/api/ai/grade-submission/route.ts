import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '../../../../lib/ai/ai-client';
import { supabaseAdmin } from '../../../../lib/db/supabase';

export async function POST(request: NextRequest) {
    try {
        const { user_id, assignment_id, answers } = await request.json();

        // Validation
        if (!user_id || !assignment_id || !answers) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: user_id, assignment_id, answers'
            }, { status: 400 });
        }

        if (!Array.isArray(answers) || answers.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Answers must be a non-empty array'
            }, { status: 400 });
        }

        console.log(`🤖 Starting AI auto-grading...`);

        // First, get the assignment and its question paper
        const { data: assignment, error: assignmentError } = await supabaseAdmin
            .from('assignments')
            .select(`
                id,
                question_paper_id,
                title,
                question_papers (
                    id,
                    content,
                    marking_scheme,
                    total_marks
                )
            `)
            .eq('id', assignment_id)
            .single();

        if (assignmentError || !assignment) {
            console.error('Assignment fetch error:', assignmentError);
            return NextResponse.json({
                success: false,
                error: 'Assignment not found',
                details: assignmentError?.message
            }, { status: 404 });
        }

        const questionPaper = assignment.question_papers as any;
        if (!questionPaper) {
            return NextResponse.json({
                success: false,
                error: 'Question paper not found for this assignment'
            }, { status: 404 });
        }

        // Call AI service for grading
        const gradingResult = await aiClient.gradeSubmission({
            student_answers: answers,
            questions: questionPaper.content,
            submission_id: `sub_${Date.now()}`,
            question_paper_id: questionPaper.id,
            student_id: user_id
        });

        if (!gradingResult) {
            return NextResponse.json({
                success: false,
                error: 'AI grading service failed'
            }, { status: 500 });
        }

        console.log(`✅ Auto-grading complete: ${gradingResult.total_score}/${gradingResult.max_possible_score} (${gradingResult.percentage}%)`);

        // Store submission (use assignment_id as per schema)
        const { data: submission, error: subError } = await supabaseAdmin
            .from('submissions')
            .insert({
                assignment_id: assignment_id, // Use assignment_id from the request
                student_id: user_id,
                answers,
                status: 'submitted',
                submitted_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (subError) {
            console.error('Submission insert error:', subError);
            return NextResponse.json({
                success: false,
                error: 'Failed to save submission',
                details: subError.message
            }, { status: 500 });
        }

        // Store result
        const { error: resultError } = await supabaseAdmin
            .from('results')
            .insert({
                submission_id: submission.id,
                total_score: gradingResult.total_score || 0,
                max_score: gradingResult.max_possible_score || 0,
                question_scores: gradingResult.detailed_feedback || [],
                ai_feedback: gradingResult.overall_feedback || '',
                graded_by: 'ai',
                graded_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            });

        if (resultError) {
            console.error('Result insert error:', resultError);
            return NextResponse.json({
                success: false,
                error: 'Failed to save grading results',
                details: resultError.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            submission_id: submission.id,
            auto_graded: true,
            total_score: gradingResult.total_score,
            max_score: gradingResult.max_possible_score,
            percentage: gradingResult.percentage,
            results: gradingResult.detailed_feedback
        });

    } catch (error) {
        console.error('Grading error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({
        message: "Auto-Grading API is running",
        method_allowed: "POST",
        example_request: {
            user_id: "student-uuid",
            assignment_id: "assignment-uuid",
            answers: [
                {
                    question_id: "q1",
                    answer: "Student's answer here"
                }
            ]
        }
    });
} 