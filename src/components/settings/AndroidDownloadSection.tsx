import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { downloadAndroidApk } from '@/lib/androidDownload';

export default function AndroidDownloadSection() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => active.current?.abort(), [user?.id]);

  async function download() {
    if (!user || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) throw new Error('Accedi di nuovo per scaricare Savely.');
      controller.signal.throwIfAborted();
      const { blob, name } = await downloadAndroidApk(session.access_token, controller.signal);
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage('APK verificato. Completa il download nel browser.');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Download Android non disponibile. Riprova più tardi.');
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }

  if (!user) return null;
  return (
    <section className="border-t border-border pt-6 space-y-3" aria-labelledby="android-download-heading">
      <h3 id="android-download-heading" className="font-medium flex items-center gap-2">
        <Smartphone className="w-5 h-5" aria-hidden="true" />{t('App Android')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('Scarica l’ultima versione di Savely per Android 8 o successivo. Android richiederà di autorizzare l’installazione dal browser.')}</p>
      <Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={busy} aria-busy={busy} onClick={download}>
        <Download className="w-4 h-4 mr-2" aria-hidden="true" />{t(busy ? 'Download in corso…' : 'Scarica APK Android')}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">{t(message)}</p>
    </section>
  );
}
