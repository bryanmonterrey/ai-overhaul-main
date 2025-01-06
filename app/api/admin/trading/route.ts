// app/api/admin/trading/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Validation schemas
const TradeSchema = z.object({
  token: z.string(),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().optional()
});

const StrategySchema = z.object({
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']),
  maxDrawdown: z.number(),
  targetProfit: z.number()
});

async function checkAdminAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return false;
  }

  // Check if user has admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  return profile?.is_admin === true;
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get trading status and portfolio data
    const response = await fetch(
      `${process.env.LETTA_API_URL}/admin/trading/status`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
        }
      }
    );

    const data = await response.json();
    return Response.json(data);

  } catch (error) {
    console.error('Admin trading error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const trade = TradeSchema.parse(body);

    // Execute trade through LettA service
    const response = await fetch(
      `${process.env.LETTA_API_URL}/admin/trading/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
        },
        body: JSON.stringify(trade)
      }
    );

    const data = await response.json();
    return Response.json(data);

  } catch (error) {
    console.error('Admin trading error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}