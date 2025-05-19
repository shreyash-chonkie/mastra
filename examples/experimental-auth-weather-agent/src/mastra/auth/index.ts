// Import auth providers
import { arcadeAuth } from './providers/arcade';
import { composioAuth } from './providers/composio';
import { firebaseAuth } from './providers/firebase';
import { supabaseAuth } from './providers/supabse';
import { supertokensAuth } from './providers/supertokens';
import { workosAuth } from './providers/workos';

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
    default:
      return supabaseAuth; // Default to Supabase
  }
}

export const authConfig = getAuthProvider();
