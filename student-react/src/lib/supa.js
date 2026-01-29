export function getSupaClient() {
  const SUPABASE_URL = "https://divdfodsdtfbdwoqvsfy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpdmRmb2RzZHRmYmR3b3F2c2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjU1OTksImV4cCI6MjA4MTAwMTU5OX0.fnm_9qX5DqdR0j6y-2mRRkwr8Icm1uRNPbUo6lqzock";
  if (!window.supabase?.createClient) return null;
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
