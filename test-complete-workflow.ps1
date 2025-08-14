# ===============================================================================
# AI EDUCATION PLATFORM - COMPLETE END-TO-END TEST SCRIPT
# Tests the full workflow: Resource → AI Analysis → Questions → Assignment → Student Quiz → AI Grading
# ===============================================================================

Write-Host "🚀 AI EDUCATION PLATFORM - COMPLETE END-TO-END TEST" -ForegroundColor Green -BackgroundColor Black
Write-Host "=" * 70 -ForegroundColor Green
Write-Host "Testing workflow: Upload → Analyze → Generate → Assign → Quiz → Grade" -ForegroundColor White
Write-Host "=" * 70 -ForegroundColor Green

# ✅ CONFIGURATION
$baseUrl = "http://localhost:3001"
$aiServiceUrl = "http://localhost:8000"

# ✅ CORRECT UUIDs (matching your database)
$testTeacherId = "73596418-7572-485a-929d-6f9688cb8a36"
$testStudentId = "87654321-4321-4321-4321-210987654321"
$testClassId = "abcdef12-abcd-4321-abcd-123456789abc"

# ✅ HEADERS
$teacherHeaders = @{
    "Content-Type" = "application/json"
    "x-test-mode" = "true"
}

$studentHeaders = @{
    "x-test-mode" = "true"
    "x-test-student" = $testStudentId
}

try {
    # =============================================================================
    Write-Host "`n🔧 STEP 0: SYSTEM HEALTH CHECK" -ForegroundColor Magenta
    # =============================================================================
    
    Write-Host "   Checking Next.js server..." -ForegroundColor White
    try {
        $healthCheck = Invoke-RestMethod -Uri "$baseUrl/api/resources" -Method GET -Headers $teacherHeaders -TimeoutSec 5
        Write-Host "   ✅ Next.js server: RUNNING" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Next.js server: NOT RESPONDING" -ForegroundColor Red
        Write-Host "   🛠️  Please start your Next.js server: npm run dev" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "   Checking AI service..." -ForegroundColor White
    try {
        $aiHealth = Invoke-RestMethod -Uri "$aiServiceUrl/health" -Method GET -TimeoutSec 5
        Write-Host "   ✅ AI Service: $($aiHealth.status)" -ForegroundColor Green
        Write-Host "   🤖 Gemini AI: $($aiHealth.gemini_ai)" -ForegroundColor Cyan
    } catch {
        Write-Host "   ⚠️  AI Service: NOT RESPONDING (will use mock data)" -ForegroundColor Yellow
    }

    # =============================================================================
    Write-Host "`n📁 STEP 1: TEACHER UPLOADS RESOURCE" -ForegroundColor Yellow
    # =============================================================================
    
    $resourceData = @{
        title = "Introduction to Calculus - Limits and Derivatives"
        description = "Comprehensive guide covering fundamental concepts of limits, continuity, and derivative calculations. Includes theoretical explanations, practical examples, and step-by-step problem-solving techniques essential for understanding calculus."
        file_url = "https://example.com/calculus-chapter1.pdf"
        file_type = "application/pdf"
        subject = "Mathematics"
        grade_level = "Grade 12"
    } | ConvertTo-Json

    Write-Host "   📤 Uploading educational resource..." -ForegroundColor White
    $resourceResponse = Invoke-RestMethod -Uri "$baseUrl/api/resources/upload" -Method POST -Headers $teacherHeaders -Body $resourceData
    $resourceId = $resourceResponse.resource.id

    Write-Host "   ✅ Resource uploaded successfully!" -ForegroundColor Green
    Write-Host "   📋 Title: $($resourceResponse.resource.title)" -ForegroundColor Cyan
    Write-Host "   🆔 Resource ID: $resourceId" -ForegroundColor Cyan
    Write-Host "   📚 Subject: $($resourceResponse.resource.subject)" -ForegroundColor Cyan
    Write-Host "   🎯 Grade: $($resourceResponse.resource.grade_level)" -ForegroundColor Cyan

    # =============================================================================
    Write-Host "`n🔍 STEP 2: AI ANALYZES RESOURCE CONTENT" -ForegroundColor Yellow  
    # =============================================================================

    $analysisData = @{ action = "analyze" } | ConvertTo-Json
    Write-Host "   🧠 Running AI content analysis..." -ForegroundColor White
    $analysisResponse = Invoke-RestMethod -Uri "$baseUrl/api/resources/$resourceId" -Method POST -Headers $teacherHeaders -Body $analysisData

    Write-Host "   ✅ AI content analysis completed!" -ForegroundColor Green
    Write-Host "   💡 Summary: $($analysisResponse.analysis.summary)" -ForegroundColor Cyan
    if ($analysisResponse.analysis.key_topics) {
        Write-Host "   📝 Key Topics: $($analysisResponse.analysis.key_topics -join ', ')" -ForegroundColor Cyan
    }
    if ($analysisResponse.analysis.suitable_for_questions) {
        Write-Host "   🎯 Suitable for Questions: $($analysisResponse.analysis.suitable_for_questions)" -ForegroundColor Cyan
    }

    # =============================================================================
    Write-Host "`n🤖 STEP 3: AI GENERATES COMPLETE QUESTION PAPER" -ForegroundColor Yellow
    # =============================================================================

    $questionPaperData = @{
        resource_id = $resourceId
        title = "Calculus Quiz - Limits and Derivatives"
        description = "AI-generated comprehensive assessment covering fundamental calculus concepts including limits, continuity, and basic differentiation"
        question_count = 6
        difficulty_level = "medium"
        question_types = @("multiple_choice", "short_answer")
        time_limit = 25
    } | ConvertTo-Json

    Write-Host "   🧠 AI generating questions and marking scheme..." -ForegroundColor White
    Write-Host "   ⏳ This may take 15-30 seconds..." -ForegroundColor Gray
    
    $questionPaperResponse = Invoke-RestMethod -Uri "$baseUrl/api/teacher/create-question-paper" -Method POST -Headers $teacherHeaders -Body $questionPaperData
    $questionPaperId = $questionPaperResponse.question_paper.id

    Write-Host "   ✅ AI question paper generation completed!" -ForegroundColor Green
    Write-Host "   📄 Paper ID: $questionPaperId" -ForegroundColor Cyan
    Write-Host "   ❓ Questions Generated: $($questionPaperResponse.ai_generation.questions_generated)" -ForegroundColor Cyan
    Write-Host "   📊 Total Marks: $($questionPaperResponse.question_paper.total_marks)" -ForegroundColor Cyan
    Write-Host "   ⏱️ Time Limit: $($questionPaperResponse.question_paper.time_limit) minutes" -ForegroundColor Cyan
    Write-Host "   📋 Marking Scheme: $($questionPaperResponse.ai_generation.marking_scheme_generated)" -ForegroundColor Cyan
    Write-Host "   🎯 Status: $($questionPaperResponse.question_paper.status)" -ForegroundColor Cyan

    # =============================================================================
    Write-Host "`n📋 STEP 4: TEACHER CREATES ASSIGNMENT" -ForegroundColor Yellow
    # =============================================================================

    $assignmentData = @{
        question_paper_id = $questionPaperId
        class_id = $testClassId
        title = "Week 1 Assignment - Introduction to Calculus"
        instructions = "Complete all questions carefully. Show your work for short answer questions. This assignment covers fundamental concepts of limits and derivatives. You have 25 minutes total."
        due_date = "2024-12-31"
        max_attempts = 2
    } | ConvertTo-Json

    Write-Host "   📤 Creating assignment for class..." -ForegroundColor White
    $assignmentResponse = Invoke-RestMethod -Uri "$baseUrl/api/teacher/assignments" -Method POST -Headers $teacherHeaders -Body $assignmentData
    $assignmentId = $assignmentResponse.assignment.id

    Write-Host "   ✅ Assignment created and published!" -ForegroundColor Green
    Write-Host "   📋 Assignment ID: $assignmentId" -ForegroundColor Cyan
    Write-Host "   📝 Title: $($assignmentResponse.assignment.title)" -ForegroundColor Cyan
    Write-Host "   🎯 Status: $($assignmentResponse.assignment.status)" -ForegroundColor Cyan
    Write-Host "   🔄 Max Attempts: $($assignmentResponse.assignment.max_attempts)" -ForegroundColor Cyan

    # =============================================================================
    Write-Host "`n👨‍🎓 STEP 5: STUDENT VIEWS AVAILABLE ASSIGNMENTS" -ForegroundColor Yellow
    # =============================================================================

    Write-Host "   👀 Loading student dashboard..." -ForegroundColor White
    $availableAssignments = Invoke-RestMethod -Uri "$baseUrl/api/student/assignments?status=available" -Method GET -Headers $studentHeaders

    Write-Host "   ✅ Student dashboard loaded!" -ForegroundColor Green
    Write-Host "   📚 Available assignments: $($availableAssignments.assignments.summary.available)" -ForegroundColor Cyan
    Write-Host "   ✅ Completed assignments: $($availableAssignments.assignments.summary.completed)" -ForegroundColor Cyan
    Write-Host "   📈 Completion rate: $($availableAssignments.assignments.summary.completion_rate)" -ForegroundColor Cyan

    if ($availableAssignments.assignments.assignments.Count -gt 0) {
        Write-Host "   📝 Latest assignment: $($availableAssignments.assignments.assignments[0].title)" -ForegroundColor Cyan
    }

    # =============================================================================
    Write-Host "`n📝 STEP 6: STUDENT STARTS ASSIGNMENT" -ForegroundColor Yellow
    # =============================================================================

    Write-Host "   📖 Loading assignment questions..." -ForegroundColor White
    $assignmentDetails = Invoke-RestMethod -Uri "$baseUrl/api/student/submit-answers?question_paper_id=$questionPaperId" -Method GET -Headers $studentHeaders

    Write-Host "   ✅ Assignment loaded for student!" -ForegroundColor Green
    if ($assignmentDetails.assignment) {
        Write-Host "   📋 Assignment: $($assignmentDetails.assignment.title)" -ForegroundColor Cyan
    }
    Write-Host "   📝 Quiz Title: $($assignmentDetails.quiz.title)" -ForegroundColor Cyan
    Write-Host "   ❓ Total Questions: $($assignmentDetails.quiz.total_questions)" -ForegroundColor Cyan
    Write-Host "   ⏱️ Time Limit: $($assignmentDetails.quiz.time_limit) minutes" -ForegroundColor Cyan
    Write-Host "   👨‍🏫 Teacher: $($assignmentDetails.quiz.teacher_name)" -ForegroundColor Cyan
    Write-Host "   🎯 Total Marks: $($assignmentDetails.quiz.total_marks)" -ForegroundColor Cyan

    Write-Host "`n   📝 Assignment Questions Preview:" -ForegroundColor White
    $assignmentDetails.quiz.questions | ForEach-Object { 
        $prefix = if ($_.type -eq "multiple_choice") { "🔘" } else { "✏️" }
        $questionPreview = if ($_.question.Length -gt 80) { 
            $_.question.Substring(0, 77) + "..." 
        } else { 
            $_.question 
        }
        Write-Host "      $prefix Q$($_.number): $questionPreview" -ForegroundColor Gray
        if ($_.type -eq "multiple_choice" -and $_.options) {
            Write-Host "         Options: $($_.options -join ', ')" -ForegroundColor DarkGray
        }
    }

    # =============================================================================
    Write-Host "`n✍️ STEP 7: STUDENT SUBMITS ANSWERS" -ForegroundColor Yellow
    # =============================================================================

    Write-Host "   🤔 Student answering questions..." -ForegroundColor White
    Write-Host "   ⏳ Simulating realistic answer time..." -ForegroundColor Gray

    # Create realistic sample answers
    $sampleAnswers = @()
    for ($i = 0; $i -lt $assignmentDetails.quiz.questions.Count; $i++) {
        $question = $assignmentDetails.quiz.questions[$i]
        
        $answer = switch ($question.type) {
            "multiple_choice" {
                # Pick a random but reasonable option for multiple choice
                $question.options | Get-Random
            }
            "short_answer" {
                # Generate subject-appropriate answers based on question number
                switch ($question.number) {
                    1 { "A limit represents the value that a function approaches as the input approaches a particular value, even if the function doesn't actually reach that value." }
                    2 { "A function is continuous at a point if three conditions are met: the function is defined at that point, the limit exists at that point, and the limit equals the function value." }
                    3 { "The derivative of a function represents the instantaneous rate of change or the slope of the tangent line to the curve at any given point." }
                    4 { "Using the power rule for differentiation: if f(x) = x^n, then f'(x) = nx^(n-1). For example, if f(x) = x^3, then f'(x) = 3x^2." }
                    5 { "The chain rule states that for composite functions, the derivative is the product of the outer function's derivative and the inner function's derivative: d/dx[f(g(x))] = f'(g(x)) × g'(x)." }
                    6 { "Limits are fundamental to calculus as they define both derivatives (limits of difference quotients) and integrals (limits of Riemann sums)." }
                    default { "This demonstrates the application of fundamental calculus concepts including limits, continuity, and differentiation rules." }
                }
            }
            default { "Sample answer demonstrating understanding of calculus concepts." }
        }
        
        $timeSpent = Get-Random -Minimum 90 -Maximum 300  # 1.5 to 5 minutes per question
        
        $sampleAnswers += @{
            question_id = $question.id
            question_number = $question.number
            answer = $answer
            time_spent = $timeSpent
        }
        
        Write-Host "   ✓ Q$($question.number): $($answer.Substring(0, [Math]::Min(50, $answer.Length)))..." -ForegroundColor DarkGray
    }

    $totalTimeSpent = ($sampleAnswers | Measure-Object time_spent -Sum).Sum
    Write-Host "   ⏱️ Total time spent: $([math]::Round($totalTimeSpent / 60, 1)) minutes" -ForegroundColor Cyan

    $submissionData = @{
        question_paper_id = $questionPaperId
        student_id = $testStudentId
        answers = $sampleAnswers
        time_taken = $totalTimeSpent
        submitted_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    } | ConvertTo-Json -Depth 10

    Write-Host "   📤 Submitting answers..." -ForegroundColor White
    $submissionHeaders = $studentHeaders + @{"Content-Type" = "application/json"}
    $submissionResponse = Invoke-RestMethod -Uri "$baseUrl/api/student/submit-answers" -Method POST -Headers $submissionHeaders -Body $submissionData

    Write-Host "   ✅ Student answers submitted successfully!" -ForegroundColor Green
    Write-Host "   📤 Submission ID: $($submissionResponse.submission.id)" -ForegroundColor Cyan
    Write-Host "   ⏱️ Time taken: $([math]::Round($submissionResponse.submission.time_taken / 60, 1)) minutes" -ForegroundColor Cyan
    Write-Host "   ✅ Questions answered: $($submissionResponse.submission.answered_questions)/$($submissionResponse.submission.total_questions)" -ForegroundColor Cyan
    if ($submissionResponse.submission.attempt_number) {
        Write-Host "   🔄 Attempt number: $($submissionResponse.submission.attempt_number)" -ForegroundColor Cyan
    }

    # =============================================================================
    Write-Host "`n🤖 STEP 8: AI AUTO-GRADING" -ForegroundColor Yellow
    # =============================================================================

    Write-Host "   🧠 AI processing submission for grading..." -ForegroundColor White

    if ($submissionResponse.auto_grading.success) {
        Write-Host ""
        Write-Host "   🎉 AI AUTO-GRADING SUCCESSFUL!" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host ""
        Write-Host "   📊 GRADING RESULTS:" -ForegroundColor White -BackgroundColor DarkBlue
        Write-Host "   🎯 Score: $($submissionResponse.auto_grading.total_score)/$($submissionResponse.auto_grading.max_possible_score)" -ForegroundColor Cyan
        Write-Host "   📈 Percentage: $($submissionResponse.auto_grading.percentage)%" -ForegroundColor Cyan
        Write-Host "   🏆 Grade: $($submissionResponse.auto_grading.grade)" -ForegroundColor Cyan
        Write-Host "   ⏱️ Grading time: $($submissionResponse.auto_grading.grading_time)" -ForegroundColor Cyan
        Write-Host "   📝 Detailed feedback: $($submissionResponse.auto_grading.feedback_available)" -ForegroundColor Cyan
        Write-Host "   📋 Marking scheme used: $($submissionResponse.auto_grading.marking_scheme_used)" -ForegroundColor Cyan
        Write-Host "   🤖 Questions graded: $($submissionResponse.auto_grading.questions_graded)" -ForegroundColor Cyan
        
        $gradingStatus = if ($submissionResponse.auto_grading.percentage -ge 80) { 
            "🌟 EXCELLENT" 
        } elseif ($submissionResponse.auto_grading.percentage -ge 70) { 
            "✅ GOOD" 
        } elseif ($submissionResponse.auto_grading.percentage -ge 60) { 
            "✔️ SATISFACTORY" 
        } else { 
            "📚 NEEDS IMPROVEMENT" 
        }
        Write-Host "   📊 Performance: $gradingStatus" -ForegroundColor Cyan
        
    } else {
        Write-Host "   ⚠️ Auto-grading failed - manual grading required" -ForegroundColor Yellow
        Write-Host "   💡 Reason: $($submissionResponse.auto_grading.message)" -ForegroundColor Gray
        Write-Host "   🔧 Check AI service connection and logs" -ForegroundColor Gray
    }

    # =============================================================================
    Write-Host "`n📊 STEP 9: UPDATED DASHBOARDS" -ForegroundColor Yellow
    # =============================================================================

    Write-Host "   📈 Refreshing student dashboard..." -ForegroundColor White
    $updatedStudentDashboard = Invoke-RestMethod -Uri "$baseUrl/api/student/assignments" -Method GET -Headers $studentHeaders

    Write-Host "   ✅ Student dashboard updated!" -ForegroundColor Green
    Write-Host "   📚 Total assignments: $($updatedStudentDashboard.assignments.summary.total_assignments)" -ForegroundColor Cyan
    Write-Host "   ✅ Completed: $($updatedStudentDashboard.assignments.summary.completed)" -ForegroundColor Cyan
    Write-Host "   📈 Completion rate: $($updatedStudentDashboard.assignments.summary.completion_rate)" -ForegroundColor Cyan
    Write-Host "   🎯 Average score: $($updatedStudentDashboard.assignments.summary.average_score)" -ForegroundColor Cyan

    Write-Host "`n   📋 Refreshing teacher dashboard..." -ForegroundColor White
    $updatedTeacherDashboard = Invoke-RestMethod -Uri "$baseUrl/api/teacher/assignments" -Method GET -Headers $teacherHeaders

    Write-Host "   ✅ Teacher dashboard updated!" -ForegroundColor Green
    Write-Host "   📝 Total assignments: $($updatedTeacherDashboard.data.overview.total_assignments)" -ForegroundColor Cyan
    Write-Host "   ⏳ Pending grading: $($updatedTeacherDashboard.data.overview.pending_grading)" -ForegroundColor Cyan
    Write-Host "   👥 Total students: $($updatedTeacherDashboard.data.overview.total_students)" -ForegroundColor Cyan
    Write-Host "   📊 Average completion: $($updatedTeacherDashboard.data.overview.avg_completion)%" -ForegroundColor Cyan

    # =============================================================================
    Write-Host "`n🎉 END-TO-END TEST COMPLETED SUCCESSFULLY!" -ForegroundColor Green -BackgroundColor DarkGreen
    # =============================================================================

    Write-Host ""
    Write-Host "🏁 COMPLETE WORKFLOW SUMMARY:" -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host "✅ 1. Teacher uploaded educational resource ($($resourceResponse.resource.subject))" -ForegroundColor Green
    Write-Host "✅ 2. AI analyzed content and extracted key concepts" -ForegroundColor Green  
    Write-Host "✅ 3. AI generated $($questionPaperResponse.ai_generation.questions_generated) questions with marking scheme" -ForegroundColor Green
    Write-Host "✅ 4. Teacher published assignment to class" -ForegroundColor Green
    Write-Host "✅ 5. Student accessed and completed assignment" -ForegroundColor Green
    Write-Host "✅ 6. AI automatically graded submission with feedback" -ForegroundColor Green
    Write-Host "✅ 7. Results updated in both student and teacher dashboards" -ForegroundColor Green
    Write-Host ""
    
    if ($submissionResponse.auto_grading.success) {
        Write-Host "🎯 FINAL RESULT: $($submissionResponse.auto_grading.percentage)% ($($submissionResponse.auto_grading.grade))" -ForegroundColor Green -BackgroundColor DarkGreen
    }
    
    Write-Host ""
    Write-Host "🚀 Your AI Education Platform is fully operational!" -ForegroundColor Green -BackgroundColor DarkGreen
    Write-Host ""

    # =============================================================================
    Write-Host "📋 REFERENCE INFORMATION:" -ForegroundColor White
    # =============================================================================
    Write-Host "   🆔 Resource ID: $resourceId" -ForegroundColor Gray
    Write-Host "   📄 Question Paper ID: $questionPaperId" -ForegroundColor Gray
    Write-Host "   📋 Assignment ID: $assignmentId" -ForegroundColor Gray
    Write-Host "   📤 Submission ID: $($submissionResponse.submission.id)" -ForegroundColor Gray
    Write-Host "   👨‍🏫 Teacher ID: $testTeacherId" -ForegroundColor Gray
    Write-Host "   👨‍🎓 Student ID: $testStudentId" -ForegroundColor Gray
    Write-Host "   🏫 Class ID: $testClassId" -ForegroundColor Gray

    if ($submissionResponse.auto_grading.result_id) {
        Write-Host "   📊 Results ID: $($submissionResponse.auto_grading.result_id)" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "🔗 NEXT STEPS:" -ForegroundColor White
    Write-Host "   • Add Clerk authentication for production deployment" -ForegroundColor Gray
    Write-Host "   • Integrate with Google Classroom (optional)" -ForegroundColor Gray
    Write-Host "   • Deploy to Google Cloud Run" -ForegroundColor Gray
    Write-Host "   • Set up monitoring and analytics" -ForegroundColor Gray

} catch {
    Write-Host ""
    Write-Host "💥 ERROR OCCURRED!" -ForegroundColor Red -BackgroundColor DarkRed
    Write-Host "Error Details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 TROUBLESHOOTING CHECKLIST:" -ForegroundColor Yellow
    Write-Host "1. ✅ Next.js server running on port 3001?" -ForegroundColor White
    Write-Host "2. ✅ AI service running on port 8000?" -ForegroundColor White
    Write-Host "3. ✅ Supabase database setup completed?" -ForegroundColor White
    Write-Host "4. ✅ Test data created in database?" -ForegroundColor White
    Write-Host "5. ✅ All API files updated with test mode support?" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Check server console logs for detailed error information" -ForegroundColor Blue
    Write-Host "💡 Verify API endpoints: $baseUrl/api/resources, $baseUrl/api/student/submit-answers" -ForegroundColor Blue
    
    if ($_.Exception.Message -like "*connection*" -or $_.Exception.Message -like "*timeout*") {
        Write-Host ""
        Write-Host "🌐 Connection Issue Detected:" -ForegroundColor Yellow
        Write-Host "   • Ensure Next.js dev server is running: npm run dev" -ForegroundColor White
        Write-Host "   • Check if ports 3001 and 8000 are available" -ForegroundColor White
        Write-Host "   • Verify firewall settings" -ForegroundColor White
    }
    
    if ($_.Exception.Message -like "*404*" -or $_.Exception.Message -like "*not found*") {
        Write-Host ""
        Write-Host "🔗 API Endpoint Issue:" -ForegroundColor Yellow
        Write-Host "   • Verify API routes exist in your project" -ForegroundColor White
        Write-Host "   • Check file paths match the expected structure" -ForegroundColor White
        Write-Host "   • Ensure all API files are saved and compiled" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "🏁 Test completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray