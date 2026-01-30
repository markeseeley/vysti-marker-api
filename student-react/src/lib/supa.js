import { getConfig } from "../config";

let supaClient = null;

export function getSupaClient() {
  if (supaClient) return supaClient;
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  if (!window.supabase?.createClient) return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  supaClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  return supaClient;
}
