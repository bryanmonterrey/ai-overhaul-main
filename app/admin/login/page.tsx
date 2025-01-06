'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('count(*)')
          .single();
        
        console.log('Connection test:', { data, error });
      } catch (err) {
        console.error('Connection test failed:', err);
      }
    };
    
    testConnection();
  }, []);
  
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      // 1. Sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
  
      if (signInError) {
        throw new Error(`Sign in failed: ${signInError.message}`);
      }
  
      if (!signInData.user) {
        throw new Error('No user data returned');
      }
  
      // 2. Get user role - with explicit error logging
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', signInData.user.id)
        .single();
  
      console.log('Role check response:', { roleData, roleError });
  
      if (roleError) {
        await supabase.auth.signOut();
        throw new Error(`Role check failed: ${roleError.message}`);
      }
  
      if (!roleData) {
        await supabase.auth.signOut();
        throw new Error('No role found for user');
      }
  
      if (roleData.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Not authorized as admin');
      }
  
      // 3. Success
      router.push('/admin');
  
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'An unknown error occurred');
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center p-2 bg-[#11111A]">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center text-zinc-50">admin login</h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-none">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-50">email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded-md bg-[#11111A] text-zinc-50 border-zinc-800"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-50">password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded-md bg-[#11111A] text-zinc-50 border-zinc-800"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-[#0D0E15]  text-zinc-50 rounded-md hover:bg-white/10 border border-zinc-800"
          >
            login
          </button>
        </form>
      </div>
    </div>
  );
}