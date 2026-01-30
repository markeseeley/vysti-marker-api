import { getConfig } from "../config";

let cachedClient = null;

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;
  const { supabaseUrl, supabaseAnonKey } = getConfig();

  if (!window.supabase?.createClient) return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  cachedClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}
