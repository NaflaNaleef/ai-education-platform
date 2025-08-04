-- AI Usage Tracking Schema
-- This should be added to your Supabase database

-- Table to track AI service usage
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('content_analysis', 'question_generation', 'auto_grading', 'marking_scheme')),
    tokens_used INTEGER NOT NULL DEFAULT 0,
    cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
    request_id VARCHAR(255),
    resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
    question_paper_id UUID REFERENCES question_papers(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_service_type ON ai_usage_logs(service_type);

-- Add AI usage limits to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_usage_limits JSONB DEFAULT '{
    "monthly_requests": 1000,
    "monthly_tokens": 100000,
    "monthly_cost": 50.00,
    "plan_type": "free"
}'::jsonb;

-- Add subscription plan to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_usage_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_ai_usage_logs_updated_at
    BEFORE UPDATE ON ai_usage_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_usage_logs_updated_at();

-- Row Level Security (RLS) for ai_usage_logs
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own usage logs
CREATE POLICY "Users can view own AI usage logs" ON ai_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: System can insert usage logs
CREATE POLICY "System can insert AI usage logs" ON ai_usage_logs
    FOR INSERT WITH CHECK (true);

-- Function to calculate monthly AI usage
CREATE OR REPLACE FUNCTION get_monthly_ai_usage(user_uuid UUID)
RETURNS TABLE (
    total_requests BIGINT,
    total_tokens BIGINT,
    total_cost DECIMAL(10,4),
    content_analysis_requests BIGINT,
    question_generation_requests BIGINT,
    auto_grading_requests BIGINT,
    marking_scheme_requests BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_requests,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COUNT(*) FILTER (WHERE service_type = 'content_analysis') as content_analysis_requests,
        COUNT(*) FILTER (WHERE service_type = 'question_generation') as question_generation_requests,
        COUNT(*) FILTER (WHERE service_type = 'auto_grading') as auto_grading_requests,
        COUNT(*) FILTER (WHERE service_type = 'marking_scheme') as marking_scheme_requests
    FROM ai_usage_logs
    WHERE user_id = user_uuid
    AND created_at >= date_trunc('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql; 