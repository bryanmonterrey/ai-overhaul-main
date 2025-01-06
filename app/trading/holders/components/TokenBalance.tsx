// app/trading/holders/components/TokenBalance.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface TokenBalanceProps {
  balance: number;
  requiredBalance: number;
}

export function TokenBalance({ balance, requiredBalance }: TokenBalanceProps) {
  const percentage = Math.min((balance / requiredBalance) * 100, 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>GOATSE Token Balance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Current Balance</span>
              <span className="font-medium">{balance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Required Balance</span>
              <span className="font-medium">{requiredBalance.toLocaleString()}</span>
            </div>
          </div>

          <Progress value={percentage} />

          <div className="text-sm text-muted-foreground">
            {balance >= requiredBalance ? (
              <span className="text-green-500">✓ Trading Enabled</span>
            ) : (
              <span className="text-yellow-500">
                Need {(requiredBalance - balance).toLocaleString()} more tokens to trade
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}