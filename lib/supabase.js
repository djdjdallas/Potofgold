import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client (uses anon key)
let clientInstance = null;

export function getSupabaseClient() {
  if (clientInstance) return clientInstance;

  clientInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return clientInstance;
}

// Server-side Supabase client (uses service role key for writes)
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
