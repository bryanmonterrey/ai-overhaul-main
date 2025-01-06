'use client';

import { Badge } from '@/components/ui/badge';
import React, { useState, useEffect } from 'react';

export default function Footer() {
  const [uptime, setUptime] = useState(0);
  const [memory, setMemory] = useState(0);
  const [datetime, setDatetime] = useState('');

  useEffect(() => {
    const startTime = Date.now();
    
    // Update metrics every second
    const intervalId = setInterval(() => {
      // Update uptime
      setUptime((Date.now() - startTime) / 1000);
      
      // Update memory usage if available
      if (window.performance && window.performance.memory) {
        setMemory(window.performance.memory.usedJSHeapSize / (1024 * 1024));
      }
      
      // Update datetime
      setDatetime(new Date().toISOString());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 py-2 px-4 bg-gradient-to-t from-darkish via-darkish/90 to-transparent">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="font-ia md:inline-flex hidden md750:block text-xs text-[#DDDDDD] space-x-2">
          <div>
          <Badge>
          <span className="">runtime: {uptime.toFixed(2)}s</span>
          </Badge>
          </div>
          <div>
          <Badge>
          <span>memory_usage: {memory.toFixed(2)}mb</span>
          </Badge>
          </div>
        </div>

        <div className="font-ia md:inline-flex hidden md750:block text-xs text-[#DDDDDD] space-x-2">
          <div>
          <Badge>
          <span className="">status: [BETA]</span>
          </Badge>
          </div>
          <div>
          <Badge>
          <span>version: 1.0.0-beta</span>
          </Badge>
          </div>
        </div>

        <div className="font-ia md:inline-flex hidden md750:block text-xs text-[#DDDDDD]">
          <Badge>
          <span>system.datetime: {datetime}</span>
          </Badge>
        </div>
      </div>
    </footer>
  );
}