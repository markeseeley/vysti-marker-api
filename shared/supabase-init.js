/**
 * Shared Supabase initializer for legacy HTML pages.
 *
 * Centralizes the Supabase URL and anon key so they live in one file
 * rather than hardcoded in every HTML page.
 *
 * Usage: add this script AFTER the Supabase CDN script:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="/shared/supabase-init.js"></script>
 *
 * Then in your inline script use the globals:
 *   // supa, SUPABASE_URL, SUPABASE_ANON_KEY are already available
 */

/* global supabase */

var SUPABASE_URL = "https://divdfodsdtfbdwoqvsfy.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpdmRmb2RzZHRmYmR3b3F2c2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjU1OTksImV4cCI6MjA4MTAwMTU5OX0.fnm_9qX5DqdR0j6y-2mRRkwr8Icm1uRNPbUo6lqzock";
var supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
