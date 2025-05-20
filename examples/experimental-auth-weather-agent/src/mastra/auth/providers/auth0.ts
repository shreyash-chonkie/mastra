import { defineAuth } from '@mastra/core/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export const auth0Auth = defineAuth({
  async authenticateToken(token, request) {
    const JWKS = createRemoteJWKSet(new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`));

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      audience: process.env.AUTH0_AUDIENCE, // set this to your Auth0 API identifier
    });

    return payload;
  },
  async authorize(request, method, user) {
    return true;
  },
});
