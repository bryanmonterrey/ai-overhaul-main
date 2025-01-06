// app/trading/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AITradingDashboard } from './components/AITradingDashboard';
import { AdminTradingChat } from './components/AdminTradingChat';

export default function AdminTradingPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/admin/login');
          return;
        }

        // Check if user is admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();

        if (roleData?.role !== 'admin') {
          router.push('/');
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error checking auth:', error);
        router.push('/admin/login');
      }
    };

    checkAuth();
  }, [supabase, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
        <div className="lg:col-span-2 mb-14">
          <AdminTradingChat />
        </div>
      <h1 className="text-2xl font-bold mb-6">AI Trading Management</h1>
      <AITradingDashboard />
    </div>
  );
}