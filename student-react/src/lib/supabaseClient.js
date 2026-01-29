let cachedClient = null;

const FALLBACK_SUPABASE_URL = "https://divdfodsdtfbdwoqvsfy.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpdmRmb2RzZHRmYmR3b3F2c2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjU1OTksImV4cCI6MjA4MTAwMTU5OX0.fnm_9qX5DqdR0j6y-2mRRkwr8Icm1uRNPbUo6lqzock";

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;
  const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

  if (!window.supabase?.createClient) return null;
  cachedClient = window.supabase.createClient(url, key);
  return cachedClient;
}
