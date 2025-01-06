'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState, useEffect } from 'react';

interface TokenConfig {
  enabled: boolean;
  token_address: string;
  required_amount_usd: number;
  min_holding_period: number;
}

export default function TokenGateSettings() {
  const [config, setConfig] = useState<TokenConfig>({
    enabled: true,
    token_address: '9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump',
    required_amount_usd: 20,
    min_holding_period: 0
  });
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'token_gate_config')
      .single();
    
    if (data?.value) {
      setConfig(data.value as TokenConfig);
    }
  }

  async function saveSettings() {
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        key: 'token_gate_config',
        value: config,
        updated_at: new Date().toISOString()
      });

    if (error) {
      alert('Error saving settings: ' + error.message);
    } else {
      alert('Settings saved successfully');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Token Gate Settings</h1>
      
      <div className="space-y-4">
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({...config, enabled: e.target.checked})}
            />
            <span>Enable Token Gate</span>
          </label>
        </div>

        <div>
          <label className="block">
            Required Amount (USD)
            <input
              type="number"
              value={config.required_amount_usd}
              onChange={(e) => setConfig({
                ...config,
                required_amount_usd: parseFloat(e.target.value)
              })}
              className="mt-1 block w-full rounded-md border p-2"
            />
          </label>
        </div>

        <div>
          <label className="block">
            Minimum Holding Period (hours)
            <input
              type="number"
              value={config.min_holding_period}
              onChange={(e) => setConfig({
                ...config,
                min_holding_period: parseInt(e.target.value)
              })}
              className="mt-1 block w-full rounded-md border p-2"
            />
          </label>
        </div>

        <button
          onClick={saveSettings}
          className="px-4 py-2 bg-black text-white rounded hover:bg-white/10 border border-white"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}