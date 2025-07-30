# Create Question Paper from Resource
# Using resource ID: fcfdf756-4b4b-45ea-af66-60a49c78cad7

Write-Host "📝 Creating Question Paper from Resource" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001"
$resourceId = "fcfdf756-4b4b-45ea-af66-60a49c78cad7"
$teacherId = "73596418-7572-485a-929d-6f9688cb8a36"

# Step 1: Generate Questions using AI
Write-Host "🤖 Step 1: Generating 2 questions using AI..." -ForegroundColor Yellow

$questionRequest = @{
    resource_id = $resourceId
    resource_url = "https://lnkligzbhgniordmxwqk.supabase.co/storage/v1/object/sign/resources/test.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zZTcyODMwNy04NmM4LTQ4NzMtYTA3ZC0xZTBiYjUxNWIwMDciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJyZXNvdXJjZXMvdGVzdC5wZGYiLCJpYXQiOjE3NTMzNTA3NjYsImV4cCI6MTc1NTk0Mjc2Nn0.7fEQCfwfKupRSqofm0V9xRl9orxQzmMZ5qJ4EvUPPhU"
    num_questions = 2
    question_types = @("multiple_choice")
    difficulty_level = "medium"
    teacher_id = $teacherId
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/ai/generate-questions" -Method POST -Body $questionRequest -ContentType "application/json" -TimeoutSec 60
    
    if (-not $response.questions -or $response.questions.Count -eq 0) {
        throw "Question generation failed"
    }
    
    $global:generatedQuestions = $response.questions
    $global:markingScheme = $response.marking_scheme
    
    Write-Host "✅ Questions generated successfully!" -ForegroundColor Green
    Write-Host "   Questions Generated: $($global:generatedQuestions.Count)" -ForegroundColor Gray
    Write-Host "   Generation Time: $($response.generation_time)" -ForegroundColor Gray
    Write-Host "   Model Used: $($response.model_used)" -ForegroundColor Gray
    
    # Display the generated questions
    Write-Host ""
    Write-Host "📋 Generated Questions:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $global:generatedQuestions.Count; $i++) {
        $question = $global:generatedQuestions[$i]
        Write-Host "   Question $($i + 1):" -ForegroundColor White
        Write-Host "     ID: $($question.id)" -ForegroundColor Gray
        Write-Host "     Question: $($question.question)" -ForegroundColor Gray
        Write-Host "     Type: $($question.type)" -ForegroundColor Gray
        Write-Host "     Correct Answer: $($question.correct_answer)" -ForegroundColor Gray
        Write-Host "     Options: $($question.options -join ', ')" -ForegroundColor Gray
        Write-Host ""
    }
    
} catch {
    Write-Host "❌ Question generation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 2: Save Question Paper to Database
Write-Host "💾 Step 2: Saving question paper to database..." -ForegroundColor Yellow

$paperData = @{
    resource_id = $resourceId
    teacher_id = $teacherId
    title = "Water Cycle MCQ Test - Generated from Resource"
    description = "Multiple choice questions about the water cycle generated from uploaded resource"
    questions = $global:generatedQuestions
    difficulty_level = "medium"
    time_limit = 6
    marking_scheme = $global:markingScheme
} | ConvertTo-Json -Depth 10

$headers = @{
    "x-test-mode" = "true"
}

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/question-paper" -Method POST -Body $paperData -ContentType "application/json" -Headers $headers -TimeoutSec 10
    
    if (-not $response.question_paper -or -not $response.question_paper.id) {
        throw "Question paper storage failed"
    }
    
    $global:questionPaperId = $response.question_paper.id
    
    Write-Host "✅ Question paper saved successfully!" -ForegroundColor Green
    Write-Host "   Question Paper ID: $global:questionPaperId" -ForegroundColor Gray
    Write-Host "   Title: $($response.question_paper.title)" -ForegroundColor Gray
    Write-Host "   Total Questions: $($response.question_paper.total_questions)" -ForegroundColor Gray
    Write-Host "   Total Marks: $($response.question_paper.total_marks)" -ForegroundColor Gray
    Write-Host "   Time Limit: $($response.question_paper.time_limit) minutes" -ForegroundColor Gray
    Write-Host "   Status: $($response.question_paper.status)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Question paper storage failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 3: Verify Question Paper in Database
Write-Host ""
Write-Host "🔍 Step 3: Verifying question paper in database..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/question-paper?teacher_id=$teacherId" -Method GET -Headers $headers -TimeoutSec 10
    
    if ($response.success -and $response.question_papers.Count -gt 0) {
        # Find our newly created question paper
        $ourPaper = $response.question_papers | Where-Object { $_.id -eq $global:questionPaperId }
        
        if ($ourPaper) {
            Write-Host "✅ Question paper verified in database!" -ForegroundColor Green
            Write-Host "   Found in database: $($ourPaper.title)" -ForegroundColor Gray
            Write-Host "   Questions in DB: $($ourPaper.content.Count)" -ForegroundColor Gray
            Write-Host "   Created at: $($ourPaper.created_at)" -ForegroundColor Gray
        } else {
            Write-Host "⚠️ Question paper not found in database list" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "📊 Database Summary:" -ForegroundColor Blue
        Write-Host "   Total Question Papers: $($response.question_papers.Count)" -ForegroundColor Gray
        Write-Host "   Latest: $($response.question_papers[0].title)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ Database verification failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Final Results
Write-Host ""
Write-Host "🎯 QUESTION PAPER CREATION COMPLETE!" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Summary:" -ForegroundColor Blue
Write-Host "   Resource ID: $resourceId" -ForegroundColor Gray
Write-Host "   Question Paper ID: $global:questionPaperId" -ForegroundColor Gray
Write-Host "   Questions Generated: $($global:generatedQuestions.Count)" -ForegroundColor Gray
Write-Host "   Status: Successfully created and saved to database" -ForegroundColor Green

Write-Host ""
Write-Host "🎓 Your question paper is ready for use!" -ForegroundColor Green 