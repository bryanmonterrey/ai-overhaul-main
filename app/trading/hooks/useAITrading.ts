// app/trading/hooks/useAITrading.ts
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { aiTradingService } from '../services/aiTradingService';

interface Portfolio {
  totalValue: number;
  positions: any[];
  pnl: {
    daily: number;
    total: number;
  };
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  valueAtRisk: number;
  exposure: number;
  positionCount: number;
}

interface Trade {
  id: string;
  timestamp: string;
  type: 'buy' | 'sell';
  token: string;
  amount: number;
  price: number;
  status: string;
}

export function useAITrading() {
  const { toast } = useToast();
  const [tradingStatus, setTradingStatus] = useState('inactive');
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio>({
    totalValue: 0,
    positions: [],
    pnl: {
      daily: 0,
      total: 0
    },
    winRate: 0,
    profitFactor: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    valueAtRisk: 0,
    exposure: 0,
    positionCount: 0
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState({
    momentum: true,
    meanReversion: true,
    sentiment: true
  });

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [portfolioData, tradesData] = await Promise.all([
          aiTradingService.getPortfolio(),
          aiTradingService.getPerformanceMetrics()
        ]);

        setPortfolio(portfolioData);
        setTrades(tradesData.trades || []);
        setError(null);
      } catch (err) {
        setError('Failed to fetch trading data');
        toast({
          title: "Error",
          description: "Failed to load trading data. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchData();
  }, [toast]);

  // WebSocket subscription
  useEffect(() => {
    const subscription = aiTradingService.subscribeToUpdates(handleUpdate);
    return () => subscription.unsubscribe();
  }, []);

  const handleUpdate = useCallback((update: any) => {
    try {
      switch (update.type) {
        case 'portfolio':
          setPortfolio(prev => ({ ...prev, ...update.data }));
          break;
        case 'trade':
          setTrades(prev => [update.data, ...prev].slice(0, 50));
          break;
        case 'status':
          setTradingStatus(update.data.status);
          break;
        case 'strategies':
          setStrategies(update.data);
          break;
      }
      setError(null);
    } catch (err) {
      setError('Error processing update');
      toast({
        title: "Error",
        description: "Failed to process update. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const startTrading = useCallback(async () => {
    try {
      await aiTradingService.startTrading();
      setTradingStatus('active');
      toast({
        title: "Trading Started",
        description: "AI trading system has been activated.",
      });
    } catch (err) {
      setError('Failed to start trading');
      toast({
        title: "Error",
        description: "Failed to start trading. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopTrading = useCallback(async () => {
    try {
      await aiTradingService.stopTrading();
      setTradingStatus('inactive');
      toast({
        title: "Trading Stopped",
        description: "AI trading system has been deactivated.",
      });
    } catch (err) {
      setError('Failed to stop trading');
      toast({
        title: "Error",
        description: "Failed to stop trading. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const updateStrategy = useCallback(async (newSettings: any) => {
    try {
      await aiTradingService.updateStrategy(newSettings);
      setStrategies(newSettings);
      toast({
        title: "Strategy Updated",
        description: "Trading strategy has been updated successfully.",
      });
    } catch (err) {
      setError('Failed to update strategy');
      toast({
        title: "Error",
        description: "Failed to update strategy. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return {
    tradingStatus,
    portfolio,
    trades,
    strategies,
    error,
    startTrading,
    stopTrading,
    updateStrategy,
    executeManualTrade: aiTradingService.executeManualTrade
  };
}