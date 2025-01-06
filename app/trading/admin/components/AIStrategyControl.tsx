// app/trading/admin/components/AIStrategyControl.tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Slider } from '@base-ui-components/react/slider';
import { Switch } from '../../../components/common/Switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../../components/common/Select';

interface AIStrategyControlProps {
  strategies: any;
  onUpdate: (settings: any) => void;
}

export function AIStrategyControl({ strategies, onUpdate }: AIStrategyControlProps) {
  const [settings, setSettings] = useState({
    activeStrategies: {
      momentum: true,
      meanReversion: true,
      sentiment: true
    },
    riskLevel: 'moderate',
    maxDrawdown: 10,
    targetProfit: 20,
    tradeFrequency: 'medium',
    jito: {
      enabled: true,
      priorityFee: 0.0025, // SOL
    }
  });

  const handleUpdate = (newSettings: any) => {
    setSettings(newSettings);
    onUpdate(newSettings);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Trading Strategy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Strategy Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Active Strategies</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between">
                <span>Momentum</span>
                <Switch
                  checked={settings.activeStrategies.momentum}
                  onCheckedChange={(checked) =>
                    handleUpdate({
                      ...settings,
                      activeStrategies: {
                        ...settings.activeStrategies,
                        momentum: checked
                      }
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Mean Reversion</span>
                <Switch
                  checked={settings.activeStrategies.meanReversion}
                  onCheckedChange={(checked) =>
                    handleUpdate({
                      ...settings,
                      activeStrategies: {
                        ...settings.activeStrategies,
                        meanReversion: checked
                      }
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Sentiment</span>
                <Switch
                  checked={settings.activeStrategies.sentiment}
                  onCheckedChange={(checked) =>
                    handleUpdate({
                      ...settings,
                      activeStrategies: {
                        ...settings.activeStrategies,
                        sentiment: checked
                      }
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Risk Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Risk Management</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label>Risk Level</label>
                <Select
                  value={settings.riskLevel}
                  onValueChange={(value) =>
                    handleUpdate({ ...settings, riskLevel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label>Max Drawdown (%)</label>
                <Slider.Root
                  value={[settings.maxDrawdown]}
                  min={5}
                  max={20}
                  step={1}
                  onValueChange={(value) =>
                    handleUpdate({ ...settings, maxDrawdown: (value as number[])[0] })
                  }
                >
                  <Slider.Control>
                    <Slider.Track>
                    <Slider.Indicator />
                    <Slider.Thumb />
                    </Slider.Track>
                  </Slider.Control>
                </Slider.Root>
                <span className="text-sm text-muted-foreground">
                  {settings.maxDrawdown}%
                </span>
              </div>

              <div className="space-y-2">
                <label>Target Profit (%)</label>
                <Slider.Root
                  value={[settings.targetProfit]}
                  min={10}
                  max={50}
                  step={5}
                  onValueChange={(value) =>
                    handleUpdate({ ...settings, targetProfit: (value as number[])[0] })
                  }
                >
                  <Slider.Control className="flex w-full items-center py-3">
                    <Slider.Track className="h-1 w-full rounded bg-gray-200 shadow-[inset_0_0_0_1px] shadow-gray-200">
                      <Slider.Indicator className="rounded bg-gray-700" />
                      <Slider.Thumb className="size-4 rounded-full bg-white outline outline-1 outline-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800" />
                    </Slider.Track>
                  </Slider.Control>
                </Slider.Root>
                <span className="text-sm text-muted-foreground">
                  {settings.targetProfit}%
                </span>
              </div>
            </div>
          </div>

          {/* Trading Frequency */}
          <div className="space-y-2">
            <label>Trading Frequency</label>
            <Select
              value={settings.tradeFrequency}
              onValueChange={(value) =>
                handleUpdate({ ...settings, tradeFrequency: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trading frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (1-2 trades/day)</SelectItem>
                <SelectItem value="medium">Medium (5-10 trades/day)</SelectItem>
                <SelectItem value="high">High (10+ trades/day)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Jito MEV Protection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Jito MEV Protection</h3>
                <p className="text-sm text-muted-foreground">
                  Enable Jito for MEV protection and better execution
                </p>
              </div>
              <Switch
                checked={settings.jito.enabled}
                onCheckedChange={(checked) =>
                  handleUpdate({
                    ...settings,
                    jito: { ...settings.jito, enabled: checked }
                  })
                }
              />
            </div>

            {settings.jito.enabled && (
              <div className="space-y-2">
                <label>Priority Fee (SOL)</label>
                <Slider.Root
                  value={[settings.jito.priorityFee * 1000]}
                  min={1}
                  max={5}
                  step={0.1}
                  onValueChange={(value) =>
                    handleUpdate({
                      ...settings,
                      jito: {
                        ...settings.jito,
                        priorityFee: (value as number[])[0] / 1000
                      }
                    })
                  }
                >
                  <Slider.Control className="flex w-full items-center py-3">
                    <Slider.Track className="h-1 w-full rounded bg-gray-200 shadow-[inset_0_0_0_1px] shadow-gray-200">
                      <Slider.Indicator className="rounded bg-gray-700" />
                      <Slider.Thumb className="size-4 rounded-full bg-white outline outline-1 outline-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800" />
                    </Slider.Track>
                  </Slider.Control>
                </Slider.Root>
                <span className="text-sm text-muted-foreground">
                  {settings.jito.priorityFee} SOL
                </span>
              </div>
            )}
          </div>

          <Button 
            className="w-full" 
            onClick={() => onUpdate(settings)}
          >
            Update Strategy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}