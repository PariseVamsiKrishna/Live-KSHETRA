import React, { createContext, useContext, useState, useEffect } from 'react';
import { ensureAnonymousAuth, onAuthStateChange } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Attempt anonymous sign-in on mount
    ensureAnonymousAuth()
      .then(({ user, session }) => {
        setUser(user);
        setSession(session);
      })
      .catch((err) => {
        setError(err.message);
        console.error('[AuthContext]', err);
      })
      .finally(() => setLoading(false));

    // Keep in sync with auth state changes (token refresh, sign-out)
    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
