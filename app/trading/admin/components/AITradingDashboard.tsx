// app/trading/admin/components/AITradingDashboard.tsx
'use client';

import { useAITrading } from '../../hooks/useAITrading';
import { AIStrategyControl } from './AIStrategyControl';
import { PortfolioOverview } from './PortfolioOverview';
import { TradeHistory } from './TradeHistory';
import { AlertDialog } from '@base-ui-components/react/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const AITradingDashboard = () => {
  const { 
    tradingStatus,
    portfolio,
    trades,
    strategies,
    startTrading,
    stopTrading,
    updateStrategy,
    error
  } = useAITrading();

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="flex justify-between items-center bg-card p-4 rounded-lg">
        <div>
          <h2 className="text-xl font-bold">AI Trading Status</h2>
          <p className={`${
            tradingStatus === 'active' ? 'text-green-500' : 'text-yellow-500'
          }`}>
            {tradingStatus === 'active' ? 'Active' : 'Inactive'}
          </p>
        </div>
        <div className="space-x-4">
          <Button
            onClick={startTrading}
            disabled={tradingStatus === 'active'}
            variant="default"
          >
            Start AI Trading
          </Button>
          <Button
            onClick={stopTrading}
            disabled={tradingStatus !== 'active'}
            variant="destructive"
          >
            Stop AI Trading
          </Button>
        </div>
      </div>

      {/* Strategy Controls */}
      <AIStrategyControl
        strategies={strategies}
        onUpdate={updateStrategy}
      />

      {/* Portfolio & Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PortfolioOverview data={portfolio} />
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold">
                    {portfolio.winRate.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profit Factor</p>
                  <p className="text-2xl font-bold">
                    {portfolio.profitFactor.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                  <p className="text-2xl font-bold">
                    {portfolio.sharpeRatio.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-500">
                    {portfolio.maxDrawdown.toFixed(2)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Value at Risk (95%)</span>
                  <span>{portfolio.valueAtRisk.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Exposure</span>
                  <span>{portfolio.exposure.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span>Position Count</span>
                  <span>{portfolio.positionCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trade History */}
      <TradeHistory trades={trades} />
    </div>
  );
};