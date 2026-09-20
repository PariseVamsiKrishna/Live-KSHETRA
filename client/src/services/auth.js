import { supabase } from './supabase';

/**
 * Ensures an anonymous Supabase session exists.
 * Safe to call multiple times — returns existing session if active.
 * Uses Supabase Anonymous Sign-In (enable in Dashboard → Auth → Providers).
 */
export async function ensureAnonymousAuth() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    return { user: session.user, session };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('[Live Kshetra Auth] Anonymous sign-in failed:', error.message);
    throw error;
  }

  return { user: data.user, session: data.session };
}

/**
 * Returns the current user's ID, or null if not authenticated.
 */
export async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Listen for auth state changes.
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
