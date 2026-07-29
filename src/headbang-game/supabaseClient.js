import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

const missingEnvironmentVariables = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabasePublishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean);

export const supabaseConfigurationError =
  missingEnvironmentVariables.length > 0
    ? `Missing Supabase environment variables: ${missingEnvironmentVariables.join(', ')}`
    : null;

export const isSupabaseConfigured = supabaseConfigurationError === null;

export const supabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
