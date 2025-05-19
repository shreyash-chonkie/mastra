import { defineAuth } from '@mastra/core/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient;

if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  // Initialize Supabase client
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

export const supabaseAuth = defineAuth({
  async authenticateToken(token, request) {
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      return null;
    }

    return data.user;
  },
  async authorize(request, method, user) {
    // Get user data from Supabase
    const { data, error } = await supabase.from('users').select('isAdmin').eq('id', user?.id).single();

    if (error) {
      return false;
    }

    const isAdmin = data?.isAdmin;

    // Check permissions based on role
    return isAdmin;
  },
});
