// src/app/components/layout/Sidebar.tsx
'use client';

import React, { useState , useEffect } from 'react';
import Link from 'next/link';
import { Card } from '../common/Card';
import { EmotionalState, NarrativeMode, TweetStyle } from '../../core/types';
import { EmotionalStateDisplay } from '../personality/EmotionalStateDisplay';

interface SidebarProps {
  currentState?: {
    emotionalState: EmotionalState;
    narrativeMode: NarrativeMode;
    activeThemes?: string[];
    traits?: Record<string, number>;
    emotionalProfile?: {
      volatility: number;
    };
  };
}

export default function Sidebar({ currentState }: SidebarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Function to check window width and update visibility
    const checkWidth = () => {
      setIsVisible(window.innerWidth >= 800);
    };

    // Initial check
    checkWidth();

    // Add event listener for window resize
    window.addEventListener('resize', checkWidth);

    // Cleanup event listener on component unmount
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Don't render anything if sidebar shouldn't be visible
  if (!isVisible) return null;

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#11111A] border-r border-[#DDDDDD] overflow-y-auto">
      <div className="p-4 space-y-4 text-xs">

        <nav className="space-y-1 border p-3 border-[#DDDDDD]">
          <div className="text-[#DDDDDD] text-sm mb-2">NAVIGATION ~</div>
          {[
            { href: '/chat', label: 'Direct Interface' },
            { href: '/conversations', label: 'Conversations' },
            { href: '/twitter', label: 'Twitter Module' },
            { href: '/telegram', label: 'Telegram Module' },
            { href: '/admin', label: 'Admin Access' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block font-ia text-[#DDDDDD] hover:bg-[#DDDDDD]/10 px-4 py-2"
            >
              {'>'}  {item.label}
            </Link>
          ))}
        </nav>

        {currentState?.activeThemes && (
          <Card variant="system" title="ACTIVE_PROCESSES">
            <div className="space-y-1 text-xs">
              {currentState.activeThemes.map((theme, i) => (
                <div key={theme}>process_{i}: {theme}</div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </aside>
  );
}
