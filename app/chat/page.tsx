'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ChatComponent from '../components/personality/Chat';
import { Card } from '../components/common/Card';
import { EmotionalStateDisplay } from '../components/personality/EmotionalStateDisplay';
import { PersonalityMonitor } from '../components/personality/PersonalityMonitor';
import { MemoryViewer } from '../components/personality/MemoryViewer';
import { EmotionalState, NarrativeMode } from '../core/personality/types';
import type { PersonalityState as CorePersonalityState, PersonalityState } from '../core/types';
import { TokenChecker } from '../lib/blockchain/token-checker';

interface SystemState extends PersonalityState {
  traits: {
    technical_depth: number;
    provocative_tendency: number;
    chaos_threshold: number;
    philosophical_inclination: number;
    meme_affinity: number;
  };
}


export default function ChatPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [systemState, setSystemState] = useState<SystemState>({
    traits: {
      technical_depth: 0.8,
      provocative_tendency: 0.7,
      chaos_threshold: 0.6,
      philosophical_inclination: 0.75,
      meme_affinity: 0.65
    },
    tweetStyle: 'shitpost',
    currentContext: {
      platform: 'chat',
      recentInteractions: [],
      environmentalFactors: {
        timeOfDay: 'day',
        platformActivity: 0,
        socialContext: [],
        platform: 'chat'
      },
      activeNarratives: ['system_initialization', 'personality_calibration']
    },
    consciousness: {
      emotionalState: 'neutral',
      currentThought: '',
      shortTermMemory: [],
      longTermMemory: [],
      attentionFocus: [],
      activeContexts: new Set()
    },
    emotionalProfile: {
      baseState: 'neutral',
      volatility: 0.5,
      triggers: new Map(),
      stateTransitions: new Map()
    },
    memories: [],
    narrativeMode: 'technical'
  });

  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);

useEffect(() => {
  const checkWidth = () => {
    setIsRightPanelVisible(window.innerWidth >= 750);
  };
  
  checkWidth();
  window.addEventListener('resize', checkWidth);
  return () => window.removeEventListener('resize', checkWidth);
}, []);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Check if token gating is enabled
        const { data: settings } = await supabase
          .from('admin_settings')
          .select('*')
          .eq('key', 'token_gate_enabled')
          .single();

        if (settings?.value) {
          // Create token checker instance
          const tokenChecker = new TokenChecker();
          
          // Get user's wallet address from Supabase
          const { data: userData } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('id', session.user.id)
            .single();

          if (!userData?.wallet_address) {
            router.push('/insufficient-tokens');
            return;
          }

          // Check actual token holdings on-chain
          const { isEligible, value } = await tokenChecker.checkEligibility(userData.wallet_address);

          if (!isEligible) {
            router.push('/insufficient-tokens');
            return;
          }

          // Update token holdings in database
          await supabase
            .from('token_holders')
            .upsert({
              user_id: session.user.id,
              dollar_value: value,
              last_checked: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/login');
      }
    };

    checkAccess();
  }, [supabase, router]);

  if (isLoading) {
    return <div>loading...</div>;
  }

  const handleStateUpdate = (newState: Partial<PersonalityState>) => {
    setSystemState(prev => ({
      ...prev,
      ...newState
    }));
  };

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6 h-[calc(100vh-30rem)] w-full">
      <div className="flex flex-col">
        <Card variant="system" className="mb-4">
          <div className="text-xs space-y-1">
            <div>protocol: DIRECT INTERFACE</div>
            <div>connection_status: ACTIVE</div>
            <div>system: ONLINE</div>
          </div>
        </Card>
        
        <div className="flex-1 min-h-0">
            <ChatComponent 
            personalityState={systemState}
            onPersonalityStateChange={handleStateUpdate}
          />
        </div>
      </div>
      
      {isRightPanelVisible && (
      <div className="space-y-4">
        <EmotionalStateDisplay
          state={systemState.consciousness.emotionalState}
          intensity={systemState.emotionalProfile.volatility}
          narrativeMode={systemState.narrativeMode}
          traits={systemState.traits}
        />
        
        <PersonalityMonitor
          traits={systemState.traits}
          tweetStyle={systemState.tweetStyle}
          activeThemes={systemState.currentContext.activeNarratives}
          className=""
        />
        
        <MemoryViewer
          memories={systemState.memories} 
          className="flex-1 min-h-0"
        />
      </div>
    )}
    </div>
  );
}