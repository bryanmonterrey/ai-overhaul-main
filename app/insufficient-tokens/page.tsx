'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function InsufficientTokensPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  // Check auth status only once on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      }
    };
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-[#11111A] text-[#DDDDDD] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-[#11111A] border border-[#DDDDDD] p-8">
        <div className="text-center">
          <h2 className="text-xl font-ia mb-4">
            Insufficient $GOATSE Tokens
          </h2>
          <p className="text-sm mb-8">
            You need to hold a minimum amount of $GOATSE tokens to access the chat.
          </p>
          
          <div className="space-y-4">
            <a 
              href="https://goatse.app/buy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full bg-[#11111A] text-[#DDDDDD] border border-[#DDDDDD] px-6 py-3 text-center hover:bg-[#DDDDDD]/10 transition-colors"
            >
              Buy $GOATSE Tokens
            </a>
            
            <Link
              href="/login"
              className="inline-block w-full bg-transparent text-[#DDDDDD] px-6 py-3 text-center border border-[#DDDDDD] hover:bg-[#DDDDDD]/10 transition-colors"
            >
              Try Again
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}