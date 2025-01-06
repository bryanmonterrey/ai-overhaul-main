// app/trading/holders/components/TradeSettings.tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/app/components/common/Select';
import { Button } from '@/components/ui/button';

interface TradeSettingsProps {
  settings: any;
  onUpdate: (settings: any) => void;
}

export function TradeSettings({ settings, onUpdate }: TradeSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleUpdate = (newSettings: any) => {
    setLocalSettings(newSettings);
    onUpdate(newSettings);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span>Auto-Trading</span>
            <Switch
              checked={localSettings.tradingEnabled}
              onCheckedChange={(checked) => 
                handleUpdate({ ...localSettings, tradingEnabled: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Risk Level</label>
            <Select
              value={localSettings.riskLevel}
              onValueChange={(value) =>
                handleUpdate({ ...localSettings, riskLevel: value })
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
            <label className="text-sm font-medium">
              Max Position Size (SOL)
            </label>
            <Slider
              value={[localSettings.maxPositionSize]}
              max={10}
              step={0.1}
              onValueChange={([value]) =>
                handleUpdate({ ...localSettings, maxPositionSize: value })
              }
            />
            <span className="text-sm text-muted-foreground">
              {localSettings.maxPositionSize} SOL
            </span>
          </div>

          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => onUpdate(localSettings)}
          >
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}