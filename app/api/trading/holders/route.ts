// app/api/trading/holders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { Database } from '@/supabase/functions/supabase.types';

// Validation Schemas
const SettingsSchema = z.object({
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']),
  maxPositionSize: z.number().positive(),
  tradingEnabled: z.boolean()
});

async function verifyTokenHolder(walletAddress: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/token-validation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.isEligible;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Verify session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's wallet address from query params
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Verify token holder status
    const isHolder = await verifyTokenHolder(walletAddress);
    if (!isHolder) {
      return NextResponse.json(
        { error: 'Not a token holder' },
        { status: 403 }
      );
    }

    // Get holder's trading data
    const response = await fetch(
      `${process.env.LETTA_API_URL}/trading/holders/${walletAddress}/status`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`LettA API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Holder trading error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Verify session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's wallet address from query params
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Verify token holder status
    const isHolder = await verifyTokenHolder(walletAddress);
    if (!isHolder) {
      return NextResponse.json(
        { error: 'Not a token holder' },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await req.json();
    let settings;
    try {
      settings = SettingsSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid settings format', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    // Update holder's trading settings
    const response = await fetch(
      `${process.env.LETTA_API_URL}/trading/holders/${walletAddress}/settings`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LETTA_API_KEY}`
        },
        body: JSON.stringify(settings)
      }
    );

    if (!response.ok) {
      throw new Error(`LettA API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Holder trading error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}