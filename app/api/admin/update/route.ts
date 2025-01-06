// app/api/admin/update/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Check authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new NextResponse(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get updates from request body
    const updates = await req.json();
    console.log('Received updates:', updates);

    // Get the current system state
    let { data: currentState, error: stateError } = await supabase
      .from('system_state')
      .select('*')
      .order('timestamp', { ascending: false })  // Changed from created_at
      .limit(1)
      .single();

    console.log('Current state:', currentState);

    if (stateError) {
        if (stateError.code === 'PGRST116') {
          // No state exists yet, create initial state
          const initialState = {
            consciousness: {
              emotionalState: 'neutral'
            },
            emotional_profile: {
              volatility: 0.5
            },
            traits: {},
            tweet_style: 'shitpost',
            narrative_mode: updates.narrativeMode || 'philosophical',
            current_context: {},
            timestamp: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        
          const { data: newState, error: insertError } = await supabase
          .from('system_state')
          .insert(initialState)
            .select()
            .single();

        if (insertError) throw insertError;
        currentState = newState;
      } else {
        throw stateError;
      }
    }

    // Properly merge nested updates
    const newState = {
        ...currentState,
        narrative_mode: updates.narrativeMode || currentState.narrative_mode,
        consciousness: updates.emotionalState ? {
          ...currentState.consciousness,
          emotionalState: updates.emotionalState
        } : currentState.consciousness,
        traits: updates.traits || currentState.traits,
        tweet_style: updates.tweetStyle || currentState.tweet_style,
        updated_at: new Date().toISOString()
      };
  
      console.log('New state to save:', newState);

    if (!currentState?.id) {
      // Insert new state if no id exists
      const { data: insertedState, error: insertError } = await supabase
        .from('system_state')
        .insert(newState)
        .select()
        .single();

      if (insertError) throw insertError;
      console.log('Inserted new state:', insertedState);
      return NextResponse.json(insertedState);
    }

    // Update existing state
    const { error: updateError } = await supabase
      .from('system_state')
      .update(newState)
      .eq('id', currentState.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    // Fetch and return the updated state
    const { data: updatedState, error: fetchError } = await supabase
      .from('system_state')
      .select('*')
      .eq('id', currentState.id)
      .single();

    if (fetchError) throw fetchError;

    console.log('Successfully updated state:', updatedState);

    return NextResponse.json(updatedState);
  } catch (error) {
    console.error('Error updating system state:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}