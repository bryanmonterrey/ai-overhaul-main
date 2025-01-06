import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const cookieStore = cookies();
    
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore
    });
    
    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.log('Session error:', sessionError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.log('Role error:', roleError);
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Get system state
    const { data: systemState, error: stateError } = await supabase
      .from('system_state')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Return default state if no state exists
    if (stateError && stateError.code === 'PGRST116') {
      const defaultState = {
        consciousness: {
          emotionalState: 'neutral'
        },
        emotionalProfile: {
          volatility: 0.5
        },
        traits: {},
        tweet_style: 'shitpost',
        narrative_mode: 'philosophical',
        currentContext: {},
        memories: []
      };

      // Insert default state
      const { data: newState, error: insertError } = await supabase
        .from('system_state')
        .insert(defaultState)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json(newState || defaultState);
    }

    if (stateError) {
      throw stateError;
    }

    return NextResponse.json(systemState);

  } catch (error) {
    console.error('System state error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error },
      { status: 500 }
    );
  }
}