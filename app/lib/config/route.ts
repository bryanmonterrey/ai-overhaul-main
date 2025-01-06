// src/app/lib/config/route.ts

export const API_ROUTES = {
    // Chat routes
    CHAT: {
      SEND: '/api/chat',
      HISTORY: '/api/chat/history',
      STATE: '/api/chat/state'
    },
  
    // Twitter routes
    TWITTER: {
      TWEET: '/api/twitter/tweet',
      TIMELINE: '/api/twitter/timeline',
      ANALYTICS: '/api/twitter/analytics',
      DELETE: (id: string) => `/api/twitter/tweet/${id}`
    },
  
    // Telegram routes
    TELEGRAM: {
      SEND: '/api/telegram/send',
      MESSAGES: '/api/telegram/messages',
      QUEUE: '/api/telegram/queue',
      STATS: '/api/telegram/stats'
    },
  
    // Admin routes
    ADMIN: {
      SYSTEM_STATE: '/api/admin/system-state',
      UPDATE: '/api/admin/update',
      RESET: '/api/admin/reset',
      STATS: '/api/admin/stats'
    }
  } as const;
  
  export type ApiRoute = typeof API_ROUTES;
  
  // Helper function to ensure type safety when using routes
  export function getRoute<T extends keyof ApiRoute>(
    category: T,
    route: keyof ApiRoute[T]
  ): string {
    return API_ROUTES[category][route] as string;
  }