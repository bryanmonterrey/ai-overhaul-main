import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { configManager } from '../config/manager';

export function withConfig(handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) {
  return async function(req: NextRequest, ...args: any[]): Promise<NextResponse> {
    try {
      const allowedDomains = ['terminal.goatse.app'];
      const hostname = req.headers.get('host');

      if (
        process.env.NODE_ENV === 'production' &&
        hostname &&
        !allowedDomains.includes(hostname)
      ) {
        return NextResponse.json(
          { error: 'Invalid domain', code: 'INVALID_DOMAIN' },
          { status: 403 }
        );
      }

      if (process.env.NODE_ENV === 'development') {
        return handler(req, ...args);
      }

      if (!configManager.validateConfig()) {
        return NextResponse.json(
          { error: 'Invalid system configuration', code: 'INVALID_CONFIG' },
          { status: 500 }
        );
      }

      const path = req.nextUrl.pathname;
      if (path.startsWith('/api/twitter')) {
        const twitterConfig = configManager.get('integrations', 'twitter');
        
        if (!twitterConfig?.enabled) {
          return NextResponse.json(
            { error: 'Twitter integration is disabled', code: 'TWITTER_DISABLED' },
            { status: 403 }
          );
        }

        // Check required Twitter credentials
        const requiredCreds = [
          'TWITTER_API_KEY',
          'TWITTER_API_SECRET',
          'TWITTER_ACCESS_TOKEN',
          'TWITTER_ACCESS_TOKEN_SECRET'
        ];

        const missingCreds = requiredCreds.filter(cred => !process.env[cred]);
        if (missingCreds.length > 0) {
          console.error('Missing Twitter credentials:', missingCreds);
          return NextResponse.json(
            { 
              error: 'Twitter credentials not configured properly',
              code: 'TWITTER_CREDS_MISSING'
            },
            { status: 500 }
          );
        }
      }

      return handler(req, ...args);
    } catch (error) {
      console.error('Configuration middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Configuration error',
          details: error.message,
          code: 'CONFIG_ERROR'
        },
        { status: 500 }
      );
    }
  };
}