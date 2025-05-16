import type { ContextWithMastra } from '@mastra/core';
import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { defaultAuthConfig } from './defaults';
import { canAccessPublicly, checkRules } from './helpers';

const PROVIDER_CONFIG: Record<string, { type: string; secret?: string; jwksUri?: string }> = {
  'https://mucfwbutfcoirsqanbuo.supabase.co/auth/v1': {
    type: 'hmac',
    secret: process.env.SUPABASE_JWT_SECRET,
  },
  'https://securetoken.google.com/<your-firebase-project>': {
    type: 'jwks',
    jwksUri: 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  },
  'https://your-auth0-domain.auth0.com/': {
    type: 'jwks',
    jwksUri: 'https://your-auth0-domain.auth0.com/.well-known/jwks.json',
  },
};

// const defaultPublicPaths = [
//   '/auth/',
//   '/api',
//   '/openapi.json',
//   '/swagger-ui',
// ];

export const authenticationMiddleware = async (c: ContextWithMastra, next: Next) => {
  const mastra = c.get('mastra');
  const authConfig = mastra.getServer()?.auth;

  if (!authConfig) {
    // No auth config, skip authentication
    return next();
  }

  // Skip authentication for public routes
  if (canAccessPublicly(c.req.path, c.req.method, authConfig)) {
    return next();
  }

  // Get token from header or query
  const authHeader = c.req.header('Authorization');
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token && c.req.query('apiKey')) {
    token = c.req.query('apiKey') || null;
  }

  // Handle missing token
  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    // Verify token and get user data
    let user: Record<string, any>;

    // Client provided verify function
    if (typeof authConfig.authenticateToken === 'function') {
      user = await authConfig.authenticateToken(token, c.req);
    }
    // JWT verification
    else if (process.env.MASTRA_JWT_SECRET) {
      user = (await jwt.verify(token, process.env.MASTRA_JWT_SECRET)) as Record<string, any>;
    } else {
      throw new Error('No token verification method configured');
    }

    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Store user in context
    c.get('runtimeContext').set('user', user);

    return next();
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};

export const authorizationMiddleware = async (c: ContextWithMastra, next: Next) => {
  const mastra = c.get('mastra');
  const authConfig = mastra.getServer()?.auth;

  if (!authConfig) {
    // No auth config, skip authorization
    return next();
  }

  const path = c.req.path;
  const method = c.req.method;

  // Skip for public routes
  if (canAccessPublicly(path, method, authConfig)) {
    return next();
  }

  const user = c.get('runtimeContext').get('user');

  // Client-provided authorization function
  if (typeof authConfig.authorize === 'function') {
    try {
      const isAuthorized = await authConfig.authorize(path, method, user, c);

      if (isAuthorized) {
        return next();
      }

      return c.json({ error: 'Access denied' }, 403);
    } catch (err) {
      console.error(err);
      return c.json({ error: 'Authorization error' }, 500);
    }
  }

  // Custom rule-based authorization
  if (authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);

    if (isAuthorized) {
      return next();
    }

    return c.json({ error: 'Access denied' }, 403);
  }

  // Default rule-based authorization
  if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);

    if (isAuthorized) {
      return next();
    }
  }

  return c.json({ error: 'Access denied' }, 403);
};

// Token generation endpoint handler
export const generateTokenHandler = async (c: Context) => {
  // This endpoint only available in development
  if (!c.get('isDev')) {
    return c.json({ error: 'This endpoint is only available in development mode' }, 403);
  }

  // Get user data from request body
  const userData = (await c.req.json()) as Record<string, any>;

  // Generate token with whatever user data was provided
  const token = jwt.sign(userData, process.env.MASTRA_JWT_SECRET || 'dev-secret', { expiresIn: '1d' });

  return c.json({ token });
};

// Exchange token handler
export const exchangeTokenHandler = async (c: Context) => {
  try {
    const { token } = await c.req.json();

    const decoded = await verifyToken(token);

    const payload = {
      iss: c.req.url,
      sub: decoded.sub,
      email: decoded.email,
      // name: decoded.name,
      // picture: decoded.picture,
      // provider: decoded.provider,
    };

    if (!process.env.MASTRA_JWT_SECRET) throw new Error('Missing MASTRA_JWT_SECRET');

    const apiKey = jwt.sign(payload, process.env.MASTRA_JWT_SECRET);

    return c.json({ apiKey });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Invalid token' }, 401);
  }
};

async function verifyToken(accessToken: string) {
  const decoded = jwt.decode(accessToken, { complete: true });

  if (!decoded) throw new Error('Invalid token');
  if (!decoded.payload || typeof decoded.payload !== 'object') throw new Error('Invalid token payload');
  if (!decoded.payload.iss) throw new Error('Invalid token header');

  const iss = decoded.payload.iss;

  const provider = PROVIDER_CONFIG[iss];
  if (!provider) throw new Error(`Unsupported provider: ${iss}`);

  if (provider.type === 'hmac') {
    if (!provider.secret) throw new Error(`Missing secret for hmac provider: ${iss}`);
    return jwt.verify(accessToken, provider.secret) as jwt.JwtPayload;
  }

  if (provider.type === 'jwks') {
    if (!provider.jwksUri) throw new Error(`Missing jwksUri for jwks provider: ${iss}`);
    const client = jwksClient({ jwksUri: provider.jwksUri });
    const key = await client.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();
    return jwt.verify(accessToken, signingKey) as jwt.JwtPayload;
  }

  throw new Error(`Unknown provider type for ${iss}`);
}
