import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseClient } from '../supabase/server';

export function withAuth(handler: (supabase: any, session: any) => Promise<NextResponse>) {
  return async function(req: NextRequest): Promise<NextResponse> {
    try {
      const supabase = getSupabaseClient();

      // Get session
      const { data: { session }, error } = await supabase.auth.getSession();

      // Check if in development mode
      if (process.env.NODE_ENV === 'development') {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', 'dev-user')
          .single();

        const mockSession = {
          user: {
            id: 'dev-user',
            role: roleData?.role || 'admin',
          },
        };
        
        // Wrap the handler in try-catch to ensure we always return a NextResponse
        try {
          const response = await handler(supabase, mockSession);
          if (response instanceof NextResponse) {
            return response;
          }
          
          // Safely serialize the response
          const safeResponse = JSON.parse(JSON.stringify(response));
          return NextResponse.json(safeResponse);
        } catch (error) {
          console.error('Handler error in development:', error);
          return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
          );
        }
      }

      if (error || !session) {
        return NextResponse.json(
          { error: 'Unauthorized', details: error?.message },
          { status: 401 }
        );
      }

      // Check user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (roleError) {
        console.error('Role check error:', roleError);
        return NextResponse.json(
          { error: 'Error checking user permissions' },
          { status: 500 }
        );
      }

      if (!roleData || roleData.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }

      // Wrap the handler in try-catch to ensure we always return a NextResponse
      try {
        const response = await handler(supabase, session);
        if (response instanceof NextResponse) {
          return response;
        }
        
        // Safely serialize the response
        const safeResponse = JSON.parse(JSON.stringify(response));
        return NextResponse.json(safeResponse);
      } catch (error) {
        console.error('Handler error:', error);
        return NextResponse.json(
          { 
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof Error ? (error as any).code || 'HANDLER_ERROR' : 'HANDLER_ERROR'
          },
          { status: error instanceof Error ? (error as any).status || 500 : 500 }
        );
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Authentication error',
          details: error instanceof Error ? error.message : 'Unknown error',
          code: 'AUTH_ERROR'
        },
        { status: 500 }
      );
    }
  };
}