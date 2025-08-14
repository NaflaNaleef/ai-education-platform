import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/db/supabase';
import { getCurrentUser } from '../../../../lib/auth/middleware';

interface AIUsageMetrics {
    total_requests: number;
    total_tokens: number;
    total_cost: number;
    requests_by_service: {
        content_analysis: number;
        question_generation: number;
        auto_grading: number;
        marking_scheme: number;
    };
    cost_by_service: {
        content_analysis: number;
        question_generation: number;
        auto_grading: number;
        marking_scheme: number;
    };
    usage_period: {
        start_date: string;
        end_date: string;
        days: number;
    };
}



// POST /api/ai/usage - Log AI usage (called by AI services)
export async function POST(request: NextRequest) {
    try {
        const {
            user_id,
            service_type,
            tokens_used,
            cost_usd,
            request_id,
            resource_id,
            question_paper_id,
            submission_id
        } = await request.json();

        // Validation
        if (!user_id || !service_type || tokens_used === undefined || tokens_used === null) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: user_id, service_type, tokens_used'
            }, { status: 400 });
        }

        // Log AI usage
        const { data: usageLog, error } = await supabaseAdmin
            .from('ai_usage_logs')
            .insert({
                user_id,
                service_type,
                tokens_used,
                cost_usd: cost_usd || 0,
                request_id,
                resource_id,
                question_paper_id,
                submission_id,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error logging AI usage:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to log usage'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: {
                usage_log_id: usageLog.id,
                logged_at: usageLog.created_at
            }
        });

    } catch (error) {
        console.error('AI usage logging error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to log usage'
        }, { status: 500 });
    }
}

// GET /api/ai/usage/limits - Get user's AI usage limits
export async function GET(request: NextRequest) {
    try {
        const currentUser = getCurrentUser(request);
        if (!currentUser.id) {
            return NextResponse.json({
                success: false,
                error: 'User not authenticated'
            }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        // If type=limits, return usage limits
        if (type === 'limits') {
            const { data: userProfile } = await supabaseAdmin
                .from('users')
                .select('subscription_plan, ai_usage_limits')
                .eq('id', currentUser.id)
                .single();

            const limits = userProfile?.ai_usage_limits || {
                monthly_requests: 1000,
                monthly_tokens: 100000,
                monthly_cost: 50.00,
                plan_type: 'free'
            };

            return NextResponse.json({
                success: true,
                data: {
                    limits,
                    subscription_plan: userProfile?.subscription_plan || 'free'
                }
            });
        }

        // Default: return usage statistics
        const period = searchParams.get('period') || 'month'; // 'day', 'week', 'month', 'year'
        const user_id = searchParams.get('user_id') || currentUser.id;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case 'day':
                startDate.setDate(endDate.getDate() - 1);
                break;
            case 'week':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(endDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
            default:
                startDate.setMonth(endDate.getMonth() - 1);
        }

        // Get AI usage records from database
        const { data: usageRecords, error } = await supabaseAdmin
            .from('ai_usage_logs')
            .select('*')
            .eq('user_id', user_id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching AI usage:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch usage data'
            }, { status: 500 });
        }

        // Calculate metrics
        const metrics: AIUsageMetrics = {
            total_requests: 0,
            total_tokens: 0,
            total_cost: 0,
            requests_by_service: {
                content_analysis: 0,
                question_generation: 0,
                auto_grading: 0,
                marking_scheme: 0
            },
            cost_by_service: {
                content_analysis: 0,
                question_generation: 0,
                auto_grading: 0,
                marking_scheme: 0
            },
            usage_period: {
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            }
        };

        // Process usage records
        (usageRecords || []).forEach(record => {
            metrics.total_requests++;
            metrics.total_tokens += record.tokens_used || 0;
            metrics.total_cost += record.cost_usd || 0;

            // Count by service type
            const serviceType = record.service_type || 'unknown';
            if (serviceType in metrics.requests_by_service) {
                metrics.requests_by_service[serviceType as keyof typeof metrics.requests_by_service]++;
                metrics.cost_by_service[serviceType as keyof typeof metrics.cost_by_service] += record.cost_usd || 0;
            }
        });

        // Get user's usage limits
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('subscription_plan, ai_usage_limits')
            .eq('id', user_id)
            .single();

        const usageLimits = userProfile?.ai_usage_limits || {
            monthly_requests: 1000,
            monthly_tokens: 100000,
            monthly_cost: 50.00
        };

        return NextResponse.json({
            success: true,
            data: {
                metrics,
                limits: usageLimits,
                usage_percentage: {
                    requests: Math.round((metrics.total_requests / usageLimits.monthly_requests) * 100),
                    tokens: Math.round((metrics.total_tokens / usageLimits.monthly_tokens) * 100),
                    cost: Math.round((metrics.total_cost / usageLimits.monthly_cost) * 100)
                },
                period,
                user_id
            }
        });

    } catch (error) {
        console.error('AI usage tracking error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to calculate usage'
        }, { status: 500 });
    }
} 