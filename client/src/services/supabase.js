import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseEnabled = Boolean(url && publishableKey);
export const supabase = supabaseEnabled ? createClient(url,publishableKey,{
  auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
}) : null;

export async function accessToken() {
  if (!supabase) return null;
  const { data:{ session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}
