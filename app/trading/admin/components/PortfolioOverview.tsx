// app/trading/admin/components/PortfolioOverview.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PortfolioOverviewProps {
  data: {
    totalValue: number;
    pnl: {
      daily: number;
      total: number;
    };
    valueHistory?: {
      timestamp: string;
      value: number;
    }[];
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

export function PortfolioOverview({ data }: PortfolioOverviewProps) {
  // Helper function to format numbers
  const formatNumber = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(decimals);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <span className="text-sm text-muted-foreground">Total Value</span>
              <p className="text-2xl font-bold">
                {formatNumber(data.totalValue)} SOL
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Daily P&L</span>
              <p className={`text-2xl font-bold ${
                (data.pnl?.daily || 0) >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {formatNumber(data.pnl?.daily)} SOL
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total P&L</span>
              <p className={`text-2xl font-bold ${
                (data.pnl?.total || 0) >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {formatNumber(data.pnl?.total)} SOL
              </p>
            </div>
          </div>

          {data.valueHistory && data.valueHistory.length > 0 && (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.valueHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number) => [`${value.toFixed(2)} SOL`, 'Value']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
              <p className="text-2xl font-bold">
                {formatNumber(data.sharpeRatio)}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Max Drawdown</span>
              <p className="text-2xl font-bold text-red-500">
                {formatNumber(data.maxDrawdown)}%
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Win Rate</span>
              <p className="text-2xl font-bold">
                {formatNumber(data.winRate)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}