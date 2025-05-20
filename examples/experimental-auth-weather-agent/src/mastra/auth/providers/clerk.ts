import { defineAuth } from '@mastra/core/server';
import { verifyJwks } from '../verify';

import { createClerkClient } from '@clerk/backend';

export const clerkAuth = defineAuth({
  async authenticateToken(token, request) {
    const jwksUri = process.env.CLERK_JWKS_URI!;
    const user = await verifyJwks(token, jwksUri);
    return user;
  },
  async authorize(request, method, user) {
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    });

    if (!user.sub) {
      return false;
    }

    const orgs = await clerkClient.users.getOrganizationMembershipList({
      userId: user.sub,
    });

    return orgs.data.length > 0;
  },
});
