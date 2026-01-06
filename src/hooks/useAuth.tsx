import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    
    // DEBUG: Log per verificare l'URL di redirect
    console.log('📧 Email verification redirect URL:', redirectUrl);
    console.log('🌐 Current origin:', window.location.origin);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    
    if (error) {
      console.error('❌ Sign up error:', error);
    } else {
      console.log('✅ Sign up successful, email sent to:', email);
    }
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
