import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '../../../../lib/ai/ai-client';

interface SubmissionRequest {
    question_paper_id: string;
    student_id?: string;
    answers: Array<{
        question_id: string;
        question_number: number;
        answer: string;
        time_spent?: number; // seconds spent on this question
    }>;
    time_taken: number; // total time in seconds
    submitted_at?: string;
}

export async function POST(request: NextRequest) {
    try {
        console.log('📝 Student quiz submission received');

        const supabase = createRouteHandlerClient({ cookies });

        // Get current user (matching your auth pattern)
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            question_paper_id,
            student_id = user.id,
            answers,
            time_taken,
            submitted_at = new Date().toISOString()
        }: SubmissionRequest = await request.json();

        // Validation
        if (!question_paper_id) {
            return NextResponse.json({
                error: 'question_paper_id is required'
            }, { status: 400 });
        }

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return NextResponse.json({
                error: 'answers array is required and must not be empty'
            }, { status: 400 });
        }

        if (typeof time_taken !== 'number' || time_taken < 0) {
            return NextResponse.json({
                error: 'time_taken must be a positive number (seconds)'
            }, { status: 400 });
        }

        // Verify user can submit for this student (must be same user or admin)
        if (student_id !== user.id) {
            return NextResponse.json({
                error: 'Access denied - can only submit your own answers'
            }, { status: 403 });
        }

        console.log(`📝 Processing submission for student ${student_id}, paper ${question_paper_id}`);

        // Get question paper to validate submission
        const { data: questionPaper, error: paperError } = await supabase
            .from('question_papers')
            .select('*, marking_scheme')
            .eq('id', question_paper_id)
            .eq('status', 'published') // Only allow submissions for published papers
            .single();

        if (paperError || !questionPaper) {
            return NextResponse.json({
                error: 'Question paper not found or not available for submission'
            }, { status: 404 });
        }

        // Check if student has already submitted for this paper
        const { data: existingSubmission, error: existingError } = await supabase
            .from('submissions')
            .select('id, status')
            .eq('question_paper_id', question_paper_id)
            .eq('student_id', student_id)
            .single();

        if (!existingError && existingSubmission) {
            return NextResponse.json({
                error: 'You have already submitted answers for this quiz',
                existing_submission_id: existingSubmission.id,
                status: existingSubmission.status
            }, { status: 409 });
        }

        // Validate answers against question paper
        const paperQuestions = questionPaper.content || [];
        const questionIds = paperQuestions.map((q: any) => q.id);
        const submittedQuestionIds = answers.map(a => a.question_id);

        // Check if all questions were answered
        const missingQuestions = questionIds.filter(id => !submittedQuestionIds.includes(id));
        if (missingQuestions.length > 0) {
            console.warn(`⚠️ Missing answers for questions: ${missingQuestions.join(', ')}`);
        }

        // Check for invalid question IDs
        const invalidQuestions = submittedQuestionIds.filter(id => !questionIds.includes(id));
        if (invalidQuestions.length > 0) {
            return NextResponse.json({
                error: 'Invalid question IDs in submission',
                invalid_questions: invalidQuestions
            }, { status: 400 });
        }

        // Check time limit (if specified)
        if (questionPaper.time_limit && time_taken > (questionPaper.time_limit * 60)) {
            console.warn(`⚠️ Submission exceeded time limit: ${time_taken}s > ${questionPaper.time_limit * 60}s`);
        }

        // Create submission record
        const submissionData = {
            question_paper_id,
            student_id,
            answers: answers, // Store as JSON
            time_taken,
            submitted_at,
            status: 'submitted', // Will change to 'graded' after manual/auto-grading
            total_questions: paperQuestions.length,
            answered_questions: answers.length
        };

        const { data: submission, error: submissionError } = await supabase
            .from('submissions')
            .insert(submissionData)
            .select('*')
            .single();

        if (submissionError) {
            console.error('💥 Failed to create submission:', submissionError);
            return NextResponse.json({
                error: 'Failed to save submission',
                details: submissionError.message
            }, { status: 500 });
        }

        console.log(`✅ Submission saved with ID: ${submission.id}`);

        let gradingResult = null;
        let resultId = null;
        const auto_grade = true; // Enable auto-grading!

        // Auto-grade if AI service is available
        if (auto_grade) {
            try {
                console.log('🤖 Starting AI auto-grading with marking scheme...');

                // Check if marking scheme is available
                if (!questionPaper.marking_scheme) {
                    console.warn('⚠️ No marking scheme found, falling back to direct AI grading');

                    // Format submission for direct AI grading
                    const gradingData = {
                        questions: paperQuestions,
                        student_answers: answers,
                        submission_id: submission.id,
                        question_paper_id,
                        student_id
                    };

                    // Use AI client to grade submission directly
                    gradingResult = await aiClient.gradeSubmission(gradingData);
                } else {
                    console.log('📋 Using marking scheme for grading...');

                    // Format submission for marking scheme-based grading
                    const gradingData = {
                        questions: paperQuestions,
                        student_answers: answers,
                        submission_id: submission.id,
                        question_paper_id,
                        student_id,
                        marking_scheme: questionPaper.marking_scheme
                    };

                    // Use AI client to grade submission with marking scheme
                    gradingResult = await aiClient.gradeSubmissionWithMarkingScheme(gradingData);
                }

                if (gradingResult.success) {
                    // Save grading results to database
                    const { data: result, error: resultError } = await supabase
                        .from('results')
                        .insert({
                            submission_id: submission.id,
                            question_paper_id,
                            student_id,
                            total_score: gradingResult.total_score,
                            max_score: gradingResult.max_possible_score,
                            percentage: gradingResult.percentage,
                            grade: gradingResult.grade,
                            question_scores: gradingResult.detailed_feedback,
                            ai_feedback: {
                                overall_feedback: gradingResult.overall_feedback,
                                grading_methods_used: gradingResult.detailed_feedback?.map(f => f.grading_method) || [],
                                marking_scheme_used: gradingResult.marking_scheme_used || false,
                                ai_generated_scheme: questionPaper.marking_scheme?.ai_generated || false
                            },
                            graded_by: 'ai',
                            graded_at: new Date().toISOString()
                        })
                        .select('*')
                        .single();

                    if (!resultError) {
                        resultId = result.id;

                        // Update submission status to graded
                        await supabase
                            .from('submissions')
                            .update({
                                status: 'graded',
                                total_score: gradingResult.total_score,
                                max_score: gradingResult.max_possible_score,
                                percentage: gradingResult.percentage
                            })
                            .eq('id', submission.id);

                        console.log(`✅ Auto-grading complete: ${gradingResult.percentage}% in ${gradingResult.grading_time}`);
                        console.log(`✅ Results saved to database: ${result.id}`);
                    } else {
                        console.error('💥 Failed to save grading results:', resultError);
                    }
                } else {
                    console.error('💥 Auto-grading failed:', gradingResult.error);
                }
            } catch (gradingError) {
                console.error('💥 Auto-grading error:', gradingError);
                // Continue without grading - teacher can grade manually later
            }
        }

        return NextResponse.json({
            success: true,
            submission: {
                id: submission.id,
                question_paper_id,
                student_id,
                submitted_at: submission.submitted_at,
                time_taken: submission.time_taken,
                status: submission.status,
                total_questions: submission.total_questions,
                answered_questions: submission.answered_questions
            },
            auto_grading: gradingResult ? {
                enabled: true,
                success: gradingResult.success,
                result_id: resultId,
                total_score: gradingResult.total_score,
                max_possible_score: gradingResult.max_possible_score,
                percentage: gradingResult.percentage,
                grade: gradingResult.grade,
                grading_time: gradingResult.grading_time,
                questions_graded: gradingResult.questions_graded,
                feedback_available: !!(gradingResult.detailed_feedback),
                marking_scheme_used: gradingResult.marking_scheme_used || false
            } : {
                enabled: true,
                success: false,
                message: 'Auto-grading failed - manual grading required'
            },
            next_steps: gradingResult?.success ? [
                `🎉 Graded automatically: ${gradingResult.percentage}% (${gradingResult.grade})`,
                'View your detailed results in the dashboard',
                'Review feedback for each question',
                'Continue to next available quiz'
            ] : [
                'Your submission has been saved successfully',
                'Auto-grading attempted but failed - teacher will grade manually',
                'Check back later for results'
            ]
        });

    } catch (error) {
        console.error('💥 Student submission failed:', error);
        return NextResponse.json({
            error: 'Submission failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const question_paper_id = searchParams.get('question_paper_id');
        const student_id = searchParams.get('student_id') || user.id;

        if (!question_paper_id) {
            return NextResponse.json({
                error: 'question_paper_id is required'
            }, { status: 400 });
        }

        // Get question paper for taking quiz (student view - no answers)
        const { data: questionPaper, error: paperError } = await supabase
            .from('question_papers')
            .select(`
                id,
                title,
                description,
                total_marks,
                time_limit,
                difficulty_level,
                content,
                status,
                teacher_id,
                users!question_papers_teacher_id_fkey(full_name)
            `)
            .eq('id', question_paper_id)
            .eq('status', 'published')
            .single();

        if (paperError || !questionPaper) {
            return NextResponse.json({
                error: 'Question paper not found or not available'
            }, { status: 404 });
        }

        // Check if student has already submitted
        const { data: existingSubmission } = await supabase
            .from('submissions')
            .select('id, status, submitted_at')
            .eq('question_paper_id', question_paper_id)
            .eq('student_id', student_id)
            .single();

        if (existingSubmission) {
            return NextResponse.json({
                error: 'Quiz already completed',
                submission_id: existingSubmission.id,
                submitted_at: existingSubmission.submitted_at,
                status: existingSubmission.status
            }, { status: 409 });
        }

        // Format questions for student (remove correct answers and explanations)
        const studentQuestions = (questionPaper.content || []).map((q: any, index: number) => ({
            id: q.id,
            number: index + 1,
            question: q.question,
            type: q.type,
            points: q.points || q.marks || 2,
            options: q.type === 'multiple_choice' ? q.options : undefined
            // Remove: correct_answer, explanation
        }));

        return NextResponse.json({
            success: true,
            quiz: {
                id: questionPaper.id,
                title: questionPaper.title,
                description: questionPaper.description,
                total_marks: questionPaper.total_marks,
                time_limit: questionPaper.time_limit,
                difficulty_level: questionPaper.difficulty_level,
                teacher_name: Array.isArray(questionPaper.users) && questionPaper.users.length > 0
                    ? questionPaper.users[0].full_name
                    : (questionPaper.users && typeof questionPaper.users === 'object' && 'full_name' in questionPaper.users ? questionPaper.users.full_name : 'Unknown Teacher'),
                total_questions: studentQuestions.length,
                questions: studentQuestions
            },
            instructions: [
                'Answer all questions to the best of your ability',
                'You can submit partial answers if needed',
                `Time limit: ${questionPaper.time_limit || 'No limit'} minutes`,
                'Submission will be graded by your teacher'
            ]
        });

    } catch (error) {
        console.error('💥 Get quiz error:', error);
        return NextResponse.json({
            error: 'Failed to load quiz',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function OPTIONS() {
    return NextResponse.json({
        endpoint: 'Student Quiz Submission',
        methods: ['POST', 'GET'],
        description: 'Submit student answers for a quiz or get quiz for taking',
        authentication: 'Required - Supabase Auth',
        post_body: {
            question_paper_id: 'Required - UUID of the quiz',
            answers: 'Required - Array of student answers',
            time_taken: 'Required - Time in seconds'
        },
        get_parameters: {
            question_paper_id: 'Required - Quiz to take',
            student_id: 'Optional - defaults to authenticated user'
        },
        note: 'Auto-grading temporarily disabled - manual grading by teachers'
    });
}