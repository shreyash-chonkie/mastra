import { defineAuth } from '@mastra/core/server';
import jwksClient from 'jwks-rsa';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { WorkOS } from '@workos-inc/node';

let workos: WorkOS;

if (process.env.WORKOS_API_KEY) {
  // Initialize Supabase client
  workos = new WorkOS(process.env.WORKOS_API_KEY, {
    clientId: process.env.WORKOS_CLIENT_ID!,
  });
}

export const workosAuth = defineAuth({
  async authenticateToken(token, request) {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      return null;
    }

    const jwksUri = workos.userManagement.getJwksUrl(process.env.WORKOS_CLIENT_ID!);
    const client = jwksClient({ jwksUri });
    const key = await client.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();
    const user = jwt.verify(token, signingKey);
    return user as JwtPayload;
  },
  async authorize(request, method, user) {
    if (!user) {
      return false;
    }

    const org = await workos.userManagement.listOrganizationMemberships({
      userId: user.sub,
    });

    const roles = org.data.map(org => org.role);

    const isAdmin = roles.some(role => role.slug === 'admin');

    return isAdmin;
  },
});
