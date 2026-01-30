import { getConfig } from "./runtimeConfig.js";

let _supaClient = null;

export function getSupaClient() {
  if (_supaClient) return _supaClient;
  if (!window.supabase?.createClient) return null;

  const config = getConfig();
  const { supabaseUrl, supabaseAnonKey } = config || {};
  if (!supabaseUrl || !supabaseAnonKey) return null;

  _supaClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  return _supaClient;
}

export async function getSession(supa) {
  if (!supa) return { data: { session: null }, error: null };
  return supa.auth.getSession();
}

export function buildReturnTo() {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function buildSigninUrl(returnTo) {
  return `/signin.html?redirect=${encodeURIComponent(returnTo || "")}`;
}

export function redirectToSignin() {
  location.replace(buildSigninUrl(buildReturnTo()));
}
