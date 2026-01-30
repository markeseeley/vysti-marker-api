import { getConfig } from "../config";

export function getSupaClient() {
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  if (!window.supabase?.createClient) return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return window.supabase.createClient(supabaseUrl, supabaseAnonKey);
}
