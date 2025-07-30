// lib/ai/ai-client.ts - Enhanced version preserving your existing functionality

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

// NEW: Enhanced grading interfaces
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

  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
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

  async analyzeContent(request: ContentAnalysisRequest): Promise<ContentAnalysisResponse> {
    try {
      console.log('🤖 Analyzing content with AI service...');

      const response = await fetch(`${this.baseUrl}/analyze-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Content analysis complete: ${result.word_count} words, suitable: ${result.suitable_for_questions}`);

      return result;
    } catch (error) {
      console.error('❌ Content analysis failed:', error);
      throw error;
    }
  }

  async generateQuestions(request: QuestionGenerationRequest): Promise<any> {
    try {
      console.log('🤖 Generating questions with AI service...');

      const response = await fetch(`${this.baseUrl}/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30000), // 30 second timeout for question generation
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Question generation failed');
      }

      console.log(`✅ Question generation complete: ${result.total_questions} questions in ${result.generation_time}`);

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

  // ENHANCED: Updated grading method to work with new AI grading service
  async gradeSubmission(request: GradeSubmissionRequest): Promise<GradingResponse> {
    try {
      console.log('🤖 Starting AI auto-grading...');

      // Use the enhanced grading service format
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
        signal: AbortSignal.timeout(45000), // 45 second timeout for grading
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

      return result;
    } catch (error) {
      console.error('❌ Grading submission failed:', error);
      throw error;
    }
  }

  // NEW: Legacy grading method for backward compatibility
  async gradeSubmissionLegacy({ answers, questions, marking_scheme }: { answers: any, questions: any, marking_scheme: any }): Promise<any> {
    try {
      console.warn('⚠️ Using legacy grading method - consider updating to gradeSubmission()');

      const response = await fetch(`${this.baseUrl}/grade-submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers, questions, marking_scheme }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Legacy grading submission failed:', error);
      throw error;
    }
  }

  // NEW: Grade submission using marking scheme
  async gradeSubmissionWithMarkingScheme(request: GradeSubmissionRequest & { marking_scheme: any }): Promise<GradingResponse> {
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
        signal: AbortSignal.timeout(45000), // 45 second timeout for grading
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

      return result;
    } catch (error) {
      console.error('❌ Marking scheme grading failed:', error);
      throw error;
    }
  }

  // NEW: Get AI usage statistics
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

  // NEW: Get grading service status
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

  // NEW: Health check with detailed service info
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

  // NEW: Generate marking scheme
  async generateMarkingScheme(questions: any[]): Promise<any> {
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

      return result;
    } catch (error) {
      console.error('❌ Marking scheme generation failed:', error);
      throw error;
    }
  }

  // NEW: Convenience method to check if auto-grading is available
  async isAutoGradingAvailable(): Promise<boolean> {
    try {
      const status = await this.getGradingStatus();
      return status.grading_available === true;
    } catch (error) {
      console.error('❌ Failed to check auto-grading availability:', error);
      return false;
    }
  }

  // NEW: Get service capabilities
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
        content_analysis: true, // Always available
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