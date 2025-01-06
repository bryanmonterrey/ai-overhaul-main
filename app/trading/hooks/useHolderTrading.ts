// app/trading/hooks/useHolderTrading.ts
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { holderTradingService } from '../services/holderTradingService';

interface Trade {
  id: string;
  timestamp: string;
  type: 'buy' | 'sell';
  token: string;
  amount: number;
  price: number;
  status: string;
}

export function useHolderTrading(userAddress: string) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    riskLevel: 'moderate',
    maxPositionSize: 0,
    tradingEnabled: false,
    minTokenRequired: 100 // Default value
  });
  const [portfolio, setPortfolio] = useState({
    totalValue: 0,
    positions: [],
    pnl: {
      daily: 0,
      total: 0
    }
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tradingEnabled, setTradingEnabled] = useState(false);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [portfolioData, tradesData, settingsData, balanceData] = await Promise.all([
          holderTradingService.getPortfolio(userAddress),
          holderTradingService.getTradeHistory(userAddress),
          holderTradingService.updateSettings(userAddress, settings),
          holderTradingService.getTokenBalance(userAddress)
        ]);

        setPortfolio(portfolioData);
        setTrades(tradesData);
        setSettings(settingsData);
        setTokenBalance(balanceData.balance);
        setTradingEnabled(settingsData.tradingEnabled);
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
  }, [userAddress, toast]);

  // WebSocket subscription for updates
  useEffect(() => {
    const subscription = holderTradingService.subscribeToUpdates(
      userAddress,
      handleUpdate
    );

    return () => subscription.unsubscribe();
  }, [userAddress]);

  const handleUpdate = useCallback((update: any) => {
    try {
      switch (update.type) {
        case 'portfolio':
          setPortfolio(update.data);
          break;
        case 'trade':
          setTrades(prev => [update.data, ...prev].slice(0, 50));
          break;
        case 'settings':
          setSettings(update.data);
          setTradingEnabled(update.data.tradingEnabled);
          break;
        case 'balance':
          setTokenBalance(update.data.balance);
          break;
      }
      setError(null);
    } catch (err) {
      setError('Error processing update');
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: any) => {
    try {
      const result = await holderTradingService.updateSettings(userAddress, newSettings);
      setSettings(result);
      setError(null);
      toast({
        title: "Settings Updated",
        description: "Your trading settings have been updated successfully.",
      });
    } catch (err) {
      setError('Failed to update settings');
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    }
  }, [userAddress, toast]);

  const toggleTrading = useCallback(async (enabled: boolean) => {
    try {
      const result = await holderTradingService.toggleTrading(userAddress, enabled);
      setTradingEnabled(result.enabled);
      setError(null);
      toast({
        title: enabled ? "Trading Enabled" : "Trading Disabled",
        description: enabled 
          ? "AI trading has been enabled for your account." 
          : "AI trading has been disabled for your account.",
      });
    } catch (err) {
      setError('Failed to toggle trading');
      toast({
        title: "Error",
        description: "Failed to update trading status. Please try again.",
        variant: "destructive",
      });
    }
  }, [userAddress, toast]);

  return {
    settings,
    portfolio,
    trades,
    tradingEnabled,
    tokenBalance,
    error,
    updateSettings,
    toggleTrading
  };
}