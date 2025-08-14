// lib/ai/ai-client.ts - FIXED: Now accepts user_id from API routes

export interface ContentAnalysisRequest {
  file_content: string;
  file_type: string;
  resource_id: string;
}

export interface ContentAnalysisResponse {
  success: boolean;
  content_type: string;
  word_count: number;
  language: string;
  suitable_for_questions: boolean;
  message: string;
}

export interface QuestionGenerationRequest {
  content: string;
  question_count?: number;
  difficulty_level?: string;
  question_types?: string[];
}

export interface GradeSubmissionRequest {
  questions: any[];
  student_answers: any[];
  submission_id: string;
  question_paper_id: string;
  student_id: string;
}

export interface GradingResponse {
  success: boolean;
  total_score?: number;
  max_possible_score?: number;
  percentage?: number;
  grade?: string;
  detailed_feedback?: any[];
  overall_feedback?: string;
  grading_time?: string;
  questions_graded?: number;
  error?: string;
}

export class AiServiceClient {
  private baseUrl: string;
  private nextjsBaseURL: string;

  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.nextjsBaseURL = process.env.NEXTJS_URL || 'http://localhost:3001';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.error('AI Service connection failed:', error);
      return false;
    }
  }

  // ✅ FIXED: Now accepts user_id parameter
  async analyzeContent(
    request: ContentAnalysisRequest, 
    options?: { user_id?: string }
  ): Promise<ContentAnalysisResponse> {
    try {
      console.log('🤖 Analyzing content with AI service...');

      const response = await fetch(`${this.baseUrl}/analyze-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Content analysis complete: ${result.word_count} words, suitable: ${result.suitable_for_questions}`);

      // ✅ FIXED: Use passed user_id or skip logging if not provided
      if (options?.user_id) {
        await this.logAIUsage({
          user_id: options.user_id, // ✅ Use actual user ID
          service_type: 'content_analysis',
          tokens_used: result.tokens_used || 500,
          cost_usd: result.cost_usd || 0.0025,
          request_id: `analysis_${Date.now()}`,
          resource_id: request.resource_id
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Content analysis failed:', error);
      throw error;
    }
  }

  // ✅ FIXED: Now accepts user_id parameter
  async generateQuestions(
    request: QuestionGenerationRequest,
    options?: { 
      user_id?: string; 
      resource_id?: string; 
      question_paper_id?: string;
    }
  ): Promise<any> {
    try {
      console.log('🤖 Generating questions with AI service...');

      const response = await fetch(`${this.baseUrl}/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Question generation failed');
      }

      console.log(`✅ Question generation complete: ${result.total_questions} questions in ${result.generation_time}`);

      // ✅ FIXED: Use passed user_id or skip logging if not provided
      if (options?.user_id) {
        await this.logAIUsage({
          user_id: options.user_id, // ✅ Use actual user ID
          service_type: 'question_generation',
          tokens_used: result.tokens_used || 2000,
          cost_usd: result.cost_usd || 0.01,
          request_id: `qgen_${Date.now()}`,
          resource_id: options.resource_id,
          question_paper_id: options.question_paper_id || result.question_paper_id
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Question generation failed:', error);
      throw error;
    }
  }

  async testAiConnection(data: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10000),
      });

      return await response.json();
    } catch (error) {
      console.error('AI connection test failed:', error);
      throw error;
    }
  }

  async gradeSubmission(
    request: GradeSubmissionRequest,
    options?: { user_id?: string }
  ): Promise<GradingResponse> {
    try {
      console.log('🤖 Starting AI auto-grading...');

      const gradingRequest = {
        questions: request.questions,
        student_answers: request.student_answers,
        submission_id: request.submission_id,
        question_paper_id: request.question_paper_id,
        student_id: request.student_id
      };

      const response = await fetch(`${this.baseUrl}/grade-submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradingRequest),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        console.error('❌ Auto-grading failed:', result.error);
        throw new Error(result.error || 'Auto-grading failed');
      }

      console.log(`✅ Auto-grading complete: ${result.total_score}/${result.max_possible_score} (${result.percentage}%) in ${result.grading_time}`);
      
      // ✅ FIXED: Use passed user_id or skip logging if not provided
      if (options?.user_id) {
        await this.logAIUsage({
          user_id: options.user_id, // ✅ Use actual user ID
          service_type: 'auto_grading',
          tokens_used: result.tokens_used || 1500,
          cost_usd: result.cost_usd || 0.0075,
          request_id: `grade_${Date.now()}`,
          submission_id: request.submission_id,
          question_paper_id: request.question_paper_id
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Grading submission failed:', error);
      throw error;
    }
  }

  // ✅ FIXED: Now accepts user_id parameter
  async gradeSubmissionWithMarkingScheme(
    request: GradeSubmissionRequest & { marking_scheme: any },
    options?: { user_id?: string }
  ): Promise<GradingResponse> {
    try {
      console.log('🤖 Starting AI grading with marking scheme...');

      const gradingRequest = {
        questions: request.questions,
        student_answers: request.student_answers,
        submission_id: request.submission_id,
        question_paper_id: request.question_paper_id,
        student_id: request.student_id,
        marking_scheme: request.marking_scheme
      };

      const response = await fetch(`${this.baseUrl}/grade-submission-with-scheme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradingRequest),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        console.error('❌ Marking scheme grading failed:', result.error);
        throw new Error(result.error || 'Marking scheme grading failed');
      }

      console.log(`✅ Marking scheme grading complete: ${result.total_score}/${result.max_possible_score} (${result.percentage}%) in ${result.grading_time}`);
      
      // ✅ FIXED: Use passed user_id or skip logging if not provided
      if (options?.user_id) {
        await this.logAIUsage({
          user_id: options.user_id, // ✅ Use actual user ID
          service_type: 'auto_grading',
          tokens_used: result.tokens_used || 1500,
          cost_usd: result.cost_usd || 0.0075,
          request_id: `grade_${Date.now()}`,
          submission_id: request.submission_id,
          question_paper_id: request.question_paper_id
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Marking scheme grading failed:', error);
      throw error;
    }
  }

  // ✅ FIXED: Now accepts user_id parameter
  async generateMarkingScheme(
    questions: any[], 
    options?: { user_id?: string; question_paper_id?: string }
  ): Promise<any> {
    try {
      console.log('🤖 Generating marking scheme...');

      const response = await fetch(`${this.baseUrl}/generate-marking-scheme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions }),
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Marking scheme generation failed');
      }

      console.log('✅ Marking scheme generated successfully');

      // ✅ FIXED: Use passed user_id or skip logging if not provided
      if (options?.user_id) {
        await this.logAIUsage({
          user_id: options.user_id, // ✅ Use actual user ID
          service_type: 'marking_scheme',
          tokens_used: result.tokens_used || 800,
          cost_usd: result.cost_usd || 0.004,
          request_id: `marking_${Date.now()}`,
          question_paper_id: options.question_paper_id
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Marking scheme generation failed:', error);
      throw error;
    }
  }

  // Keep all your other methods unchanged (getUsageStats, getGradingStatus, etc.)
  async getUsageStats(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/ai-usage`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get usage stats:', error);
      throw error;
    }
  }

  async getGradingStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/grading-status`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get grading status:', error);
      return {
        grading_available: false,
        error: 'Grading status check failed'
      };
    }
  }

  async getHealthStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async isAutoGradingAvailable(): Promise<boolean> {
    try {
      const status = await this.getGradingStatus();
      return status.grading_available === true;
    } catch (error) {
      console.error('❌ Failed to check auto-grading availability:', error);
      return false;
    }
  }

  // ✅ FIXED: Enhanced validation and error handling
  async logAIUsage(usageData: {
    user_id: string;
    service_type: 'content_analysis' | 'question_generation' | 'auto_grading' | 'marking_scheme';
    tokens_used: number;
    cost_usd?: number;
    request_id?: string;
    resource_id?: string;
    question_paper_id?: string;
    submission_id?: string;
  }): Promise<any> {
    try {
      // ✅ VALIDATION: Skip if user_id is invalid
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!usageData.user_id || !uuidRegex.test(usageData.user_id)) {
        console.warn('⚠️ Invalid user_id for AI usage logging, skipping:', usageData.user_id);
        return null;
      }

      // ✅ VALIDATION: Skip if tokens_used is invalid
      if (!usageData.tokens_used || usageData.tokens_used <= 0) {
        console.warn('⚠️ Invalid tokens_used for AI usage logging, skipping:', usageData.tokens_used);
        return null;
      }

      const url = `${this.nextjsBaseURL}/api/ai/usage`;
      console.log('🔗 Logging AI usage to:', url);
      console.log('📝 Usage data being sent:', usageData);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: usageData.user_id,
          service_type: usageData.service_type,
          tokens_used: usageData.tokens_used,
          cost_usd: usageData.cost_usd || 0,
          request_id: usageData.request_id || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          resource_id: usageData.resource_id,
          question_paper_id: usageData.question_paper_id,
          submission_id: usageData.submission_id
        }),
        signal: AbortSignal.timeout(5000), // Quick timeout for logging
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ AI usage logging failed:', response.status, errorText);
        return null;
      }

      const result = await response.json();
      console.log('✅ AI usage logged successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to log AI usage:', error);
      // Don't throw error - usage logging shouldn't break main functionality
      return null;
    }
  }

  async getServiceCapabilities(): Promise<any> {
    try {
      const [health, grading, usage] = await Promise.all([
        this.getHealthStatus(),
        this.getGradingStatus(),
        this.getUsageStats().catch(() => null)
      ]);

      return {
        service_healthy: health.status === 'healthy',
        gemini_available: health.gemini_ai === 'available',
        question_generation: health.ready_for_questions,
        auto_grading: grading.grading_available,
        content_analysis: true,
        usage_tracking: !!usage,
        features: {
          multiple_choice_grading: grading.features?.multiple_choice_grading || false,
          open_ended_grading: grading.features?.open_ended_grading || false,
          detailed_feedback: grading.features?.detailed_feedback || false,
          overall_feedback: grading.features?.overall_feedback || false,
          letter_grades: grading.features?.letter_grades || false
        },
        limits: usage ? {
          daily_requests: usage.daily_requests,
          max_daily_requests: usage.max_daily_requests,
          requests_remaining: usage.requests_remaining
        } : null
      };
    } catch (error) {
      console.error('❌ Failed to get service capabilities:', error);
      return {
        service_healthy: false,
        error: 'Failed to check service capabilities'
      };
    }
  }
}

// Export singleton instance
export const aiClient = new AiServiceClient();