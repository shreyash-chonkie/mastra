// Import auth providers
import { arcadeAuth } from './providers/arcade';
import { composioAuth } from './providers/composio';
import { firebaseAuth } from './providers/firebase';
import { supabaseAuth } from './providers/supabse';
import { supertokensAuth } from './providers/supertokens';
import { workosAuth } from './providers/workos';
import { clerkAuth } from './providers/clerk';
import { auth0Auth } from './providers/auth0';

// Get the configured auth provider based on environment
export function getAuthProvider() {
  const provider = process.env.AUTH_PROVIDER?.toLowerCase() || 'supabase';

  switch (provider) {
    case 'supabase':
      return supabaseAuth;
    case 'firebase':
      return firebaseAuth;
    case 'workos':
      return workosAuth;
    case 'composio':
      return composioAuth;
    case 'supertokens':
      return supertokensAuth;
    case 'arcade':
      return arcadeAuth;
    case 'clerk':
      return clerkAuth;
    case 'auth0':
      return auth0Auth;
    default:
      return supabaseAuth; // Default to Supabase
  }
}

export const authConfig = getAuthProvider();
