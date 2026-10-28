import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const authOptions = { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false };

export const supabaseConfigured = Boolean(url && publishableKey);
let publicClient;
let adminClient;

export function supabasePublic() {
  if (!supabaseConfigured) return null;
  publicClient ||= createClient(url, publishableKey, { auth:authOptions });
  return publicClient;
}

export function supabaseForToken(accessToken) {
  if (!supabaseConfigured) return null;
  return createClient(url, publishableKey, {
    auth:authOptions,
    global:{ headers:accessToken ? { Authorization:`Bearer ${accessToken}` } : {} }
  });
}

export function supabaseAdmin() {
  if (!url || !secretKey) return null;
  adminClient ||= createClient(url, secretKey, { auth:authOptions });
  return adminClient;
}

export function requireSupabase(client = supabasePublic()) {
  if (!client) throw Object.assign(new Error('Supabase is not configured.'), { status:503 });
  return client;
}

export function requireSupabaseAdmin() {
  const client = supabaseAdmin();
  if (!client) throw Object.assign(new Error('SUPABASE_SECRET_KEY is required for this server operation.'), { status:503 });
  return client;
}
