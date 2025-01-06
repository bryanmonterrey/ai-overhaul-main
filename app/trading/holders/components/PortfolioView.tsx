// app/trading/holders/components/PortfolioView.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PortfolioViewProps {
  portfolio: {
    totalValue: number;
    positions: any[];
    tokenBalance: number;
  };
}

export function PortfolioView({ portfolio }: PortfolioViewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Total Value</span>
              <p className="text-2xl font-bold">{portfolio.totalValue} SOL</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Token Balance</span>
              <p className="text-2xl font-bold">{portfolio.tokenBalance}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Active Positions</span>
              <p className="text-2xl font-bold">{portfolio.positions.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Entry Price</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolio.positions.map((position) => (
                <TableRow key={position.token}>
                  <TableCell>{position.token}</TableCell>
                  <TableCell>{position.size}</TableCell>
                  <TableCell>{position.entryPrice} SOL</TableCell>
                  <TableCell>{position.currentPrice} SOL</TableCell>
                  <TableCell className={position.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {position.pnl} SOL
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
