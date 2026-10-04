import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseEnabled = Boolean(url && key);

let instance: SupabaseClient | undefined;

export function supabaseClient() {
  if (!supabaseEnabled) throw Error("Supabase no está configurado.");
  instance ??= createClient(url!, key!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return instance;
}
