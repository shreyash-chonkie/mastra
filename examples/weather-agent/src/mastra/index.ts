import { Mastra } from '@mastra/core';
import { createClient } from '@supabase/supabase-js';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
  server: {
    auth: {
      authorize: async (path, method, user, context) => {
        // Get user data from Supabase
        const { data, error } = await supabase.from('users').select('isSubscribed').eq('id', user?.sub).single();

        if (error) {
          return false;
        }

        const isSubscribed = data?.isSubscribed;

        // Check permissions based on role
        return isSubscribed;
      },
    },
  },
});
