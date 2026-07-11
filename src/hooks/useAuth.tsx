import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Map Supabase auth events to login_activity.event_type values.
 * Returns null for events we don't track (e.g. INITIAL_SESSION, TOKEN_REFRESHED).
 */
function authEventToLoginType(
  event: string
): 'sign_in' | 'sign_out' | 'sign_up' | 'recovery' | 'mfa_challenge' | null {
  switch (event) {
    case 'SIGNED_IN':
      return 'sign_in';
    case 'SIGNED_OUT':
      return 'sign_out';
    case 'USER_UPDATED':
      // A successful sign-up fires SIGNED_IN with a session; treat USER_UPDATED
      // alone as a registration hint if it's the first event.
      return null;
    case 'PASSWORD_RECOVERY':
      return 'recovery';
    case 'MFA_CHALLENGE_VERIFIED':
      return 'mfa_challenge';
    default:
      return null;
  }
}

/**
 * Decode the session ID from the access_token JWT payload.
 */
function getSessionId(session: Session | null): string | null {
  if (!session?.access_token) return null;
  try {
    return JSON.parse(atob(session.access_token.split('.')[1])).sid ?? null;
  } catch {
    return null;
  }
}

/**
 * Insert a login_activity row. Fire-and-forget; failures are swallowed so the
 * auth flow never breaks on audit errors.
 */
function recordLoginEvent(event: string, userId: string | undefined, session: Session | null) {
  const eventType = authEventToLoginType(event);
  if (!eventType || !userId) return;
  supabase
    .from('login_activity')
    .insert({
      user_id: userId,
      event_type: eventType,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      session_id: getSessionId(session),
    })
    .then(() => undefined, () => undefined);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Best-effort login activity logging (audit). Failures are swallowed.
        recordLoginEvent(event, session?.user?.id, session);

        if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password', { replace: true });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Ensure a base set of categories exists for each user (needed for imports and UX)
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id')
          .limit(1);

        if (cancelled) return;
        if (error) return;

        if (!data || data.length === 0) {
          const defaults = [
            // Expense
            { name: 'Cibo', icon: '🍔', color: '#f97316', type: 'expense' as const },
            { name: 'Trasporti', icon: '🚗', color: '#3b82f6', type: 'expense' as const },
            { name: 'Casa', icon: '🏠', color: '#8b5cf6', type: 'expense' as const },
            { name: 'Shopping', icon: '🛍️', color: '#ec4899', type: 'expense' as const },
            { name: 'Intrattenimento', icon: '🎬', color: '#f59e0b', type: 'expense' as const },
            { name: 'Salute', icon: '💊', color: '#ef4444', type: 'expense' as const },
            { name: 'Altro', icon: '📦', color: '#6b7280', type: 'expense' as const },
            // Income
            { name: 'Stipendio', icon: '💰', color: '#22c55e', type: 'income' as const },
            { name: 'Freelance', icon: '💻', color: '#14b8a6', type: 'income' as const },
            { name: 'Investimenti', icon: '📈', color: '#8b5cf6', type: 'income' as const },
            { name: 'Altro', icon: '💵', color: '#6b7280', type: 'income' as const },
          ].map((c) => ({ ...c, user_id: user.id }));

          const { error: insertError } = await supabase
            .from('categories')
            .insert(defaults);

          if (cancelled) return;
          if (insertError) return;

          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, queryClient]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${siteUrl}/auth/callback`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    
    if (error) return { error: error as Error | null };
    
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      return { error: signInError as Error | null };
    }
    
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${siteUrl}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };

  const updateEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updateEmail, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
