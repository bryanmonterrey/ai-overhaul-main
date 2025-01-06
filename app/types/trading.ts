// app/types/trading.ts

export interface TradeUpdate {
    id: string;
    timestamp: string;
    type: 'buy' | 'sell';
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    amountOut: number;
    priceImpact: number;
    slippage: number;
    status: 'pending' | 'completed' | 'failed';
    txHash?: string;
    error?: string;
    userAddress?: string;
    fees: {
      network: number;
      priority?: number;
    };
  }
  
  export interface MetricsUpdate {
    timestamp: string;
    portfolioValue: number;
    dayPnL: number;
    dayPnLPercent: number;
    currentDrawdown: number;
    riskLevel: 'low' | 'moderate' | 'high';
    volatility24h: number;
    sharpeRatio: number;
    totalPositions: number;
    activeTrades: number;
    largestPosition: {
      token: string;
      value: number;
      percentage: number;
    };
    performanceMetrics: {
      dailyReturn: number;
      weeklyReturn: number;
      monthlyReturn: number;
      totalReturn: number;
      winRate: number;
      averageWin: number;
      averageLoss: number;
    };
  }
  
  export interface RiskAlert {
    id: string;
    timestamp: string;
    type: 'drawdown' | 'volatility' | 'concentration' | 'liquidity' | 'general';
    level: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metric?: {
      name: string;
      value: number;
      threshold: number;
    };
    requiresAction: boolean;
    suggestedAction?: string;
    userAddress?: string;
  }

  export interface Alert {
    type: 'PRICE' | 'RISK' | 'LIQUIDATION';
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    timestamp: string;
  }
  
  export interface TradingState {
    connected: boolean;
    metrics: MetricsUpdate | null;
    lastTrade: TradeUpdate | null;
    activeAlerts: RiskAlert[];
    error: string | null;
  }
  
  export interface TradingConfig {
    riskThresholds: {
      maxDrawdown: number;
      positionConcentration: number;
      volatilityThreshold: number;
    };
    tradingLimits: {
      maxTradeSize: number;
      minTradeSize: number;
      maxDailyTrades: number;
    };
    mevProtection: {
      enabled: boolean;
      priorityFee: number;
    };
    strategies: {
      momentum: boolean;
      meanReversion: boolean;
      sentiment: boolean;
    };
  }
  
  export type TradingEventType = 
    | 'trade'
    | 'metrics'
    | 'alert'
    | 'config'
    | 'portfolio'
    | 'heartbeat';
  
  export interface TradingMessage {
    type: TradingEventType;
    data: any;
    timestamp: string;
    source?: string;
  }