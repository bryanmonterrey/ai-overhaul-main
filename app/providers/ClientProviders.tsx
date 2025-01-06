// app/providers/ClientProviders.tsx
'use client';

import { WalletProvider } from './WalletProvider';
import React from 'react';
import '../styles/wallet-adapter.css';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}