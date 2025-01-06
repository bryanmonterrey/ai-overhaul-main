'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../common/Card';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Magnetic } from '../common/MagButton';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/MobileNav';

const CustomWalletButton = () => {
  return (
    <WalletMultiButton className="!bg-[#0D0E15] !border !border-zinc-900 !rounded-md !font-ia !text-sm !px-3 !py-1">
      connect
    </WalletMultiButton>
  );
};

export default function Header() {
  const { connected, publicKey, disconnect } = useWallet();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await disconnect();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-darkish via-darkish/90 to-transparent">
      <div className=" px-4 justify-between">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center space-x-8">
            <Link href="/" className="font-ia text-[#DDDDDD] text-base">
              <Logo />
            </Link>
             
            <nav className="hidden md:flex space-x-5">
              <Magnetic>

              <Link href="/chat" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
              <button 
              type='button'
              className='inline-flex items-center rounded-md border border-zinc-900
         bg-[#0D0E15] px-4 py-1 text-sm font-semibold hover:text-greenish text-[#DDDDDD] transition-all duration-300 hover:bg-zinc-600 dark:border-zinc-900
         dark:bg-transparent dark:text-[#DDDDDD] dark:hover:bg-zinc-600'>
                chat
              </button>
              </Link>
              
              </Magnetic>
              <Magnetic>
              <Link href="/conversations" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
              <button 
              type='button'
              className='inline-flex items-center rounded-md border border-zinc-900
         bg-[#0D0E15] px-4 py-1 text-sm font-semibold text-[#DDDDDD] hover:text-greenish transition-all duration-300 hover:bg-zinc-600 dark:border-zinc-900
         dark:bg-transparent dark:text-[#DDDDDD] dark:hover:bg-zinc-600'>
                conversations
              </button>
              </Link>
              </Magnetic>
              <Magnetic>
              <Link href="/twitter" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
              <button 
              type='button'
              className='inline-flex items-center rounded-md border border-zinc-900
         bg-[#0D0E15] px-4 py-1 text-sm font-semibold hover:text-greenish text-[#DDDDDD] transition-all duration-300 hover:bg-zinc-600 dark:border-zinc-900
         dark:bg-transparent dark:text-[#DDDDDD] dark:hover:bg-zinc-600'>
                twitter
              </button>
              </Link>
              </Magnetic>
              <Magnetic>
              <Link href="/telegram" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
              <button 
              type='button'
              className='inline-flex items-center rounded-md border border-zinc-900
         bg-[#0D0E15] px-4 py-1 text-sm font-semibold hover:text-greenish text-[#DDDDDD] transition-all duration-300 hover:bg-zinc-600 dark:border-zinc-900
         dark:bg-transparent dark:text-[#DDDDDD] dark:hover:bg-zinc-600'>
                telegram
              </button>
              </Link>
              </Magnetic>
              <Magnetic>
              <Link href="/admin" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
              <button 
              type='button'
              className='inline-flex items-center rounded-md border border-zinc-900
         bg-[#0D0E15] px-4 py-1 text-sm font-semibold hover:text-greenish text-[#DDDDDD] transition-all duration-300 hover:bg-zinc-600 dark:border-zinc-900
         dark:bg-transparent dark:text-[#DDDDDD] dark:hover:bg-zinc-600'>
                admin
              </button>
              </Link>
              </Magnetic>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Status card - hidden on small screens */}

            {/* Menu button - shown only on small screens */}
            <MobileNav 
            trigger={
              <button 
                className="sm:hidden text-sm px-4 !py-1 border font-semibold bg-[#0D0E15] rounded-md border-zinc-900 text-[#DDDDDD] hover:text-greenish"
              >
                menu
              </button>
            } 
          />
            
            {connected && publicKey ? (
              <div className="flex items-center space-x-4">
                <button type='button' className="items-center hidden md750:block rounded-md border border-zinc-900
         bg-[#0D0E15] px-4 py-1 text-sm font-semibold hover:text-greenish text-[#DDDDDD] transition-all duration-300 hover:bg-zinc-600 dark:border-zinc-900
         dark:bg-transparent dark:text-[#DDDDDD] dark:hover:bg-zinc-600">
                  <span className="text-xs font-ia">
                    {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                  </span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="items-center rounded-md border border-zinc-900
         bg-[#0D0E15] px-4 py-1 text-sm font-semibold hover:text-greenish text-[#DDDDDD] transition-all duration-300 hover:bg-zinc-600 dark:border-zinc-900
         dark:bg-transparent dark:text-[#DDDDDD] dark:hover:bg-zinc-600"
                >
                  disconnect
                </button>
              </div>
            ) : (
              <CustomWalletButton />
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="sm:hidden border-t border-[#DDDDDD]  py-2">
            <nav className="flex flex-col space-y-2">
              <Link href="/chat" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                chat
              </Link>
              <Link href="/conversations" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                conversations
              </Link>
              <Link href="/twitter" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                twitter
              </Link>
              <Link href="/telegram" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                telegram
              </Link>
              <Link href="/admin" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                admin
              </Link>
              <div className="px-4 py-2">
                <span className="text-xs text-[#DDDDDD]">STATUS: ONLINE</span>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}