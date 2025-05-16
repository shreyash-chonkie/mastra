import type { MastraAuthConfig } from '@mastra/core';

// Default configuration that can be extended by clients
export const defaultAuthConfig: MastraAuthConfig = {
  public: [
    '/',
    '/refresh-events',
    '/__refresh',
    '/assets/*',
    '/auth/*',
    '/openapi.json',
    '/swagger-ui',
    ['/api/agents', 'GET'],
    ['/a2a/*', ['GET']],
  ],
  // Simple rule system
  rules: [
    // Admin users can do anything
    {
      condition: (user: Record<string, any>) => {
        console.log('condition', user);
        return user && (user.isAdmin || user.role === 'admin');
      },
      allow: true,
    },
  ],
};
