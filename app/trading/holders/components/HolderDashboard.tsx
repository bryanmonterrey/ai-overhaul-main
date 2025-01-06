// app/trading/holders/components/HolderDashboard.tsx
'use client';

import { useHolderTrading } from '../../hooks/useHolderTrading';
import { PortfolioView } from './PortfolioView';
import { TradeSettings } from './TradeSettings';
import { TokenBalance } from './TokenBalance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/app/components/common/Switch';
import { Select, SelectItem } from '@/app/components/common/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const HolderDashboard = ({ userAddress }: { userAddress: string }) => {
  const {
    portfolio,
    trades,
    settings,
    tradingEnabled,
    tokenBalance,
    updateSettings,
    toggleTrading,
    error
  } = useHolderTrading(userAddress);

  return (
    <div className="space-y-6">
      {/* Token Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TokenBalance
          balance={tokenBalance}
          requiredBalance={settings.minTokenRequired}
        />
        <Card>
          <CardHeader>
            <CardTitle>Trading Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span>Auto-Trading</span>
              <Switch
                checked={tradingEnabled}
                onCheckedChange={toggleTrading}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Risk Level</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={settings.riskLevel}
              onValueChange={(value) => 
                updateSettings({ ...settings, riskLevel: value })
              }
            >
              <SelectItem value="conservative">Conservative</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="aggressive">Aggressive</SelectItem>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <TradeSettings
        settings={settings}
        onUpdate={updateSettings}
      />

      {/* Portfolio View */}
      <PortfolioView
        portfolio={portfolio}
        tokenBalance={tokenBalance}
      />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell>
                    {new Date(trade.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className={
                    trade.type === 'buy' ? 'text-green-500' : 'text-red-500'
                  }>
                    {trade.type.toUpperCase()}
                  </TableCell>
                  <TableCell>{trade.token}</TableCell>
                  <TableCell>{trade.amount}</TableCell>
                  <TableCell>{trade.price} SOL</TableCell>
                  <TableCell>{trade.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};