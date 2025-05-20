import { defineAuth } from '@mastra/core/server';
import { verifyJwks } from '../verify';

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
    const jwksUri = workos.userManagement.getJwksUrl(process.env.WORKOS_CLIENT_ID!);
    const user = await verifyJwks(token, jwksUri);
    return user;
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
