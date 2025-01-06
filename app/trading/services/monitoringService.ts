// app/trading/services/monitoringService.ts
import { Alert } from '../../types/trading';
import { supabase } from '../../lib/supabase';
import { solanaService } from '../../lib/solana';

export async function getPriceAlerts(walletAddress: string) {
 const { data } = await supabase
   .from('price_alerts')
   .select('*')
   .eq('wallet_address', walletAddress);
 return data || [];
}

export async function getOpenPositions(walletAddress: string) {
 const { data } = await supabase
   .from('positions')
   .select('*')
   .eq('wallet_address', walletAddress)
   .eq('status', 'open');
 return data || [];
}

export async function checkAlerts(positions: any[], priceAlerts: any[]): Promise<Alert[]> {
 const alerts: Alert[] = [];
 
 for (const position of positions) {
   const currentPrice = await solanaService.pythFetchPrice(position.token);
   const matchingAlerts = priceAlerts.filter(alert => 
     alert.token === position.token && 
     alert.triggerPrice >= currentPrice
   );
   
   alerts.push(...matchingAlerts.map(alert => ({
    type: 'PRICE' as const,  // This fixes the type error
    level: 'WARNING' as const,
    message: `Price alert triggered for ${position.token} at ${currentPrice}`,
    timestamp: new Date().toISOString()
  })));
 }
 
 return alerts;
}

export function calculatePositionStats(positions: any[]) {
 return {
   totalPositions: positions.length,
   totalValue: positions.reduce((sum, pos) => sum + pos.value, 0),
   averageSize: positions.length > 0 
     ? positions.reduce((sum, pos) => sum + pos.value, 0) / positions.length 
     : 0,
   riskExposure: calculateRiskExposure(positions)
 };
}

function calculateRiskExposure(positions: any[]) {
 return positions.reduce((exposure, pos) => {
   const positionRisk = pos.value * (pos.leverage || 1);
   return exposure + positionRisk;
 }, 0);
}