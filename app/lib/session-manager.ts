// lib/trading/session-manager.ts

interface TradingSession {
    publicKey: string;
    signature: string;
    timestamp: number;
    expiresAt: number;
    wallet: {
      name: string;
      connected: boolean;
    };
  }
  
  export class TradingSessionManager {
    private static readonly SESSION_KEY = 'trading_session';
    private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  
    static async createSession(sessionData: Omit<TradingSession, 'timestamp' | 'expiresAt'>): Promise<TradingSession> {
      const session: TradingSession = {
        ...sessionData,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.SESSION_DURATION
      };
  
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      return session;
    }
  
    static getSession(): TradingSession | null {
      try {
        const sessionData = localStorage.getItem(this.SESSION_KEY);
        if (!sessionData) return null;
  
        const session: TradingSession = JSON.parse(sessionData);
        
        // Check if session is expired
        if (Date.now() > session.expiresAt) {
          this.clearSession();
          return null;
        }
  
        return session;
      } catch (error) {
        console.error('Error reading trading session:', error);
        return null;
      }
    }
  
    static clearSession(): void {
      localStorage.removeItem(this.SESSION_KEY);
    }
  
    static isSessionValid(session: TradingSession): boolean {
      return Date.now() <= session.expiresAt;
    }
  
    static async refreshSession(session: TradingSession): Promise<TradingSession> {
      if (!this.isSessionValid(session)) {
        throw new Error('Cannot refresh expired session');
      }
  
      const refreshedSession: TradingSession = {
        ...session,
        expiresAt: Date.now() + this.SESSION_DURATION
      };
  
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(refreshedSession));
      return refreshedSession;
    }
  }