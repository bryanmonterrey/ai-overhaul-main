import { createClient } from '@supabase/supabase-js';

export class MetricsCollector {
  private static instance: MetricsCollector;
  private startTime: number;
  private responseTimeSamples: number[];
  private supabase: any;

  private constructor() {
    this.startTime = Date.now();
    this.responseTimeSamples = [];
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.startMetricsCollection();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  private startMetricsCollection() {
    setInterval(() => this.collectMetrics(), 10000); // Collect every 10 seconds
  }

  public recordResponseTime(ms: number) {
    this.responseTimeSamples.push(ms);
    // Keep only last 1000 samples
    if (this.responseTimeSamples.length > 1000) {
      this.responseTimeSamples.shift();
    }
  }

  public async recordConnection(userId: string, type: string) {
    const { data, error } = await this.supabase
      .from('connection_sessions')
      .insert({
        user_id: userId,
        connection_type: type,
        is_active: true
      });

    if (error) console.error('Error recording connection:', error);
    return data;
  }

  public async endConnection(userId: string) {
    const { data, error } = await this.supabase
      .from('connection_sessions')
      .update({
        is_active: false,
        last_active_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) console.error('Error ending connection:', error);
    return data;
  }

  private async collectMetrics() {
    const metrics = {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory_usage: process.memoryUsage().heapUsed / 1024 / 1024,
      active_connections: await this.getActiveConnections(),
      response_time_avg: this.getAverageResponseTime(),
      success_rate: await this.getSuccessRate(),
      cpu_usage: await this.getCPUUsage(),
      cache_hit_rate: await this.getCacheHitRate()
    };

    await this.supabase
      .from('system_metrics')
      .insert(metrics);
  }

  private async getActiveConnections(): Promise<number> {
    const { count } = await this.supabase
      .from('connection_sessions')
      .select('count')
      .eq('is_active', true)
      .single();

    return count || 0;
  }

  private getAverageResponseTime(): number {
    if (this.responseTimeSamples.length === 0) return 0;
    const sum = this.responseTimeSamples.reduce((a, b) => a + b, 0);
    return sum / this.responseTimeSamples.length;
  }

  private async getSuccessRate(): Promise<number> {
    // Implement based on your error tracking
    return 0.98;
  }

  private async getCPUUsage(): Promise<number> {
    // Simplified CPU usage calculation
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    const totalUsage = endUsage.user + endUsage.system;
    return totalUsage / 1000000; // Convert to percentage
  }

  private async getCacheHitRate(): Promise<number> {
    // Implement based on your caching system
    return 0.92;
  }
}