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
        const response = await fetch(`${this.baseUrl}/analyze-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        return await response.json();
      } catch (error) {
        console.error('Content analysis failed:', error);
        throw error;
      }
    }
  
    async generateQuestions(request: QuestionGenerationRequest): Promise<any> {
      try {
        const response = await fetch(`${this.baseUrl}/generate-questions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        return await response.json();
      } catch (error) {
        console.error('Question generation failed:', error);
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
        });
  
        return await response.json();
      } catch (error) {
        console.error('AI connection test failed:', error);
        throw error;
      }
    }
  }
  
  // Export singleton instance
  export const aiClient = new AiServiceClient();