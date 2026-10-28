import { requireSupabase, supabaseForToken } from '../config/supabase.js';

const bearer = req => req.headers.authorization?.replace(/^Bearer\s+/i,'');

async function verify(req) {
  const token = bearer(req);
  if (!token) return null;
  const client = requireSupabase(supabaseForToken(token));
  const { data:{ user }, error } = await client.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error('Invalid or expired authentication token.'), { status:401 });
  req.accessToken = token;
  req.user = { ...user, uid:user.id };
  return req.user;
}

export async function optionalAuth(req,res,next) {
  try { await verify(req); next(); }
  catch (error) { res.status(error.status || 401).json({ message:error.message }); }
}

export async function requireAuth(req,res,next) {
  try {
    const user = await verify(req);
    if (!user) return res.status(401).json({ message:'Authentication required.' });
    next();
  } catch (error) { res.status(error.status || 401).json({ message:error.message }); }
}

export async function requireAdmin(req,res,next) {
  try {
    const user = await verify(req);
    if (!user) return res.status(401).json({ message:'Authentication required.' });
    if (user.app_metadata?.role !== 'admin') return res.status(403).json({ message:'Administrator access required.' });
    next();
  } catch (error) { res.status(error.status || 401).json({ message:error.message }); }
}
