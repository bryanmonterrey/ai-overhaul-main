import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Pusher from 'pusher';
import { MetricsCollector } from '../../../core/monitoring/MetricsCollector';

// Initialize Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true
});

export async function GET(req: Request) {
  try {
    // Check authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new NextResponse(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get latest metrics from system_metrics
    const { data: latestMetrics } = await supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Get stats from your database
    const { data: messageStats } = await supabase
      .from('chat_messages')
      .select('count');

    const { data: tweetStats } = await supabase
      .from('tweets')
      .select('count');

    // Get active connections
    const { data: activeConnections } = await supabase
      .from('connection_sessions')
      .select('count')
      .eq('is_active', true)
      .single();

    // Combine both data sources
    const stats = {
      ...latestMetrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      activeConnections: activeConnections?.count || 0,
      totalChats: messageStats?.[0]?.count || 0,
      totalTweets: tweetStats?.[0]?.count || 0,
      averageResponseTime: latestMetrics?.response_time_avg || 250,
      successRate: latestMetrics?.success_rate || 0.98,
      totalMemories: latestMetrics?.total_memories || 1000,
      memoryEfficiency: latestMetrics?.memory_efficiency || 0.95,
      contextSwitches: latestMetrics?.context_switches || 150,
      cacheHitRate: latestMetrics?.cache_hit_rate || 0.92,
      timestamp: new Date().toISOString()
    };

    // Store the new metrics
    await supabase
      .from('system_metrics')
      .insert({
        uptime: stats.uptime,
        memory_usage: stats.memoryUsage,
        active_connections: stats.activeConnections,
        response_time_avg: stats.averageResponseTime,
        success_rate: stats.successRate,
        total_chats: stats.totalChats,
        total_tweets: stats.totalTweets,
        cache_hit_rate: stats.cacheHitRate
      });

    // Trigger realtime update
    await pusher.trigger('admin-stats', 'stats-update', stats);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}