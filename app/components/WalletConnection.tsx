'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { WalletAuthManager } from '../lib/auth/wallet-auth';
import { TradingSessionManager } from '../lib/session-manager';

// Dynamically import WalletMultiButton with no SSR
const WalletMultiButtonDynamic = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

export function WalletConnection() {
  const { publicKey, connected, connecting, disconnect, wallet, signMessage } = useWallet();
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const walletAuthManager = new WalletAuthManager();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for existing trading session on mount and connection
  useEffect(() => {
    if (connected && publicKey) {
      const session = TradingSessionManager.getSession();
      setHasActiveSession(!!session && session.publicKey === publicKey.toString());
    } else {
      setHasActiveSession(false);
      TradingSessionManager.clearSession();
    }
  }, [connected, publicKey]);

  useEffect(() => {
    if (publicKey && connected && !connecting) {
      handleWalletAuth();
    }
  }, [publicKey, connected, connecting]);

  const initializeTradingSession = async () => {
    if (!publicKey || !wallet) return;

    try {
      const message = new TextEncoder().encode("authorize_trading_session");
      const signature = await signMessage!(message);
      
      await TradingSessionManager.createSession({
        publicKey: publicKey.toString(),
        signature,
        wallet: {
          name: wallet.adapter.name,
          connected: true
        }
      });
      
      setHasActiveSession(true);
    } catch (error: any) {
      console.error('Failed to initialize trading session:', error);
      setValidationError('Failed to initialize trading session: ' + error.message);
    }
  };

  const handleWalletAuth = async () => {
    if (!publicKey) return;

    try {
      setAuthError(null);
      const result = await walletAuthManager.authenticateWallet(publicKey.toString());
      
      if (!result.success) {
        setAuthError(result.error || 'Authentication failed');
        return;
      }

      // If authentication is successful, proceed with token validation
      await handleValidateTokens();
    } catch (error: any) {
      console.error('Wallet auth error:', error);
      setAuthError(error.message || 'Authentication failed');
    }
  };

  useEffect(() => {
    if (mounted) {
      console.log('Wallet state:', {
        connected,
        connecting,
        publicKey: publicKey?.toString(),
        walletName: wallet?.adapter?.name,
        hasActiveSession
      });
    }
  }, [mounted, connected, connecting, publicKey, wallet, hasActiveSession]);

  const handleValidateTokens = async () => {
    if (!publicKey) {
      console.log('No public key available');
      return;
    }
    
    setIsValidating(true);
    setIsChecking(true);
    setValidationError(null);
    
    try {
      const walletAddress = publicKey.toString();
      console.log('Starting token validation for wallet:', walletAddress);
      
      const response = await fetch('/api/token-validation', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress }),
      });

      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('Validation response:', data);
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('Unauthorized. Redirecting to login...');
          window.location.href = `/login?redirect=${encodeURIComponent('/chat')}`;
          return;
        }
        throw new Error(data.error || 'Validation failed');
      }

      if (data.isEligible) {
        console.log('Token validation successful. Redirecting to chat...');
        window.location.href = '/chat';
      } else {
        console.log('Insufficient tokens. Redirecting...');
        window.location.href = '/insufficient-tokens';
      }
    } catch (error: any) {
      console.error('Error in token validation:', error);
      setValidationError(error.message);
    } finally {
      setIsValidating(false);
      setIsChecking(false);
    }
  };

  const handleDisconnect = () => {
    TradingSessionManager.clearSession();
    setHasActiveSession(false);
    disconnect();
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <WalletMultiButtonDynamic />
      
      {connecting && (
        <p className="text-sm text-gray-400">Connecting...</p>
      )}
      
      {connected && publicKey && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            Connected: {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
          </p>
          
          {!hasActiveSession && (
            <button
              onClick={initializeTradingSession}
              disabled={isValidating}
              className="px-4 py-2 bg-[#11111A] text-white rounded disabled:opacity-50 hover:bg-white/10 transition-colors border border-white w-full"
            >
              Initialize Trading Session
            </button>
          )}

          <button
            onClick={handleValidateTokens}
            disabled={isValidating}
            className="px-4 py-2 bg-[#11111A] text-white rounded disabled:opacity-50 hover:bg-white/10 transition-colors border border-white w-full"
          >
            {isValidating ? 'Validating...' : 'Verify Token Holdings'}
          </button>
          
          {validationError && (
            <p className="text-sm text-red-500">{validationError}</p>
          )}
          
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-[#11111A] border border-white text-white rounded hover:bg-white/10 transition-colors w-full"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}