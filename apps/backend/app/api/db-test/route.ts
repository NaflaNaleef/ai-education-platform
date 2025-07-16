import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

export async function GET() {
    try {
        // Test database connection by counting users
        const { count, error } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Database connected successfully!',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Database connection failed'
        }, { status: 500 });
    }
} 