import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Ottieni i parametri dalla URL
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');

        // Strip tokens from URL to prevent leakage via browser history/referrer
        if (accessToken || refreshToken) {
          globalThis.history.replaceState({}, '', globalThis.location.pathname);
        }

        if (type === 'signup' || type === 'email_change') {
          // Per signup o cambio email, Supabase gestisce automaticamente la sessione
          // Dobbiamo solo aspettare che la sessione venga aggiornata
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            throw error;
          }

          if (session) {
            setStatus('success');
            // Reindirizza alla dashboard dopo un breve delay
            setTimeout(() => {
              navigate('/', { replace: true });
            }, 1500);
          } else {
            // Se non c'è sessione, prova a usare i token se presenti
            if (accessToken && refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (sessionError) {
                throw sessionError;
              }

              setStatus('success');
              setTimeout(() => {
                navigate('/', { replace: true });
              }, 1500);
            } else {
              throw new Error(t('Nessuna sessione trovata'));
            }
          }
        } else if (type === 'recovery') {
          // Per il reset password, reindirizza alla pagina di reset
          setStatus('success');
          setTimeout(() => {
            navigate('/reset-password', { replace: true });
          }, 1500);
        } else {
          // Per altri tipi, reindirizza alla dashboard
          setStatus('success');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1500);
        }
      } catch (error) {
        console.error('Errore durante il callback di autenticazione:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : t('Si è verificato un errore'));
        // Reindirizza alla pagina di auth dopo un breve delay
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">{t('Verifica in corso...')}</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="space-y-4">
            <div className="text-green-500 text-6xl mx-auto">✓</div>
            <h2 className="text-2xl font-semibold text-foreground">
              {searchParams.get('type') === 'signup' ? t('Email verificata!') : t('Operazione completata!')}
            </h2>
            <p className="text-muted-foreground">
              {t('Verrai reindirizzato automaticamente...')}
            </p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-4">
            <div className="text-red-500 text-6xl mx-auto">✕</div>
            <h2 className="text-2xl font-semibold text-foreground">{t('Si è verificato un errore')}</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <p className="text-sm text-muted-foreground">
              {t('Verrai reindirizzato alla pagina di login...')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}