import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, ShieldCheck, ShieldX, Smartphone, Monitor, Trash2, Loader2, LogOut, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useFactors, useEnrollTotp, useVerifyEnrollment, useUnenrollFactor, challengeAndVerify } from '@/hooks/useMfa';
import { useActiveSessions, useDeleteSession } from '@/hooks/useActiveSessions';
import { supabase } from '@/integrations/supabase/client';
import { parseUserAgent } from '@/lib/userAgent';
import { validateTotpCode, extractSecretFromUri } from '@/lib/mfa';

/**
 * Security section: 2FA (TOTP) enrollment/management + current accesses +
 * "sign out other sessions". Rendered inside Settings.tsx.
 */
export default function SecuritySection() {
  const { t } = useTranslation();
  const { data: factorsData, isLoading: factorsLoading } = useFactors();
  const enroll = useEnrollTotp();
  const verify = useVerifyEnrollment();
  const unenroll = useUnenrollFactor();

  const { data: sessions, isLoading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useActiveSessions();
  const deleteSession = useDeleteSession();

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [pendingEnrollment, setPendingEnrollment] = useState<{ factorId: string; uri: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [unenrollTarget, setUnenrollTarget] = useState<string | null>(null);
  const [unenrollCode, setUnenrollCode] = useState('');
  const [unenrollVerifying, setUnenrollVerifying] = useState(false);

  const currentUa = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const factors = factorsData?.factors ?? [];
  const aal = factorsData?.aalCurrent ?? 'aal1';

  // --- Enrollment flow ------------------------------------------------------
  const startEnrollment = async () => {
    try {
      const result = await enroll.mutateAsync();
      setPendingEnrollment(result);
      setCode('');
      setEnrollOpen(true);
    } catch (err) {
      toast.error(t('Errore'), { description: (err as Error).message || t('Impossibile avviare la configurazione 2FA') });
    }
  };

  const confirmEnrollment = async () => {
    if (!pendingEnrollment) return;
    const codeErr = validateTotpCode(code);
    if (codeErr) {
      toast.error(t('Codice non valido'), { description: codeErr });
      return;
    }
    try {
      await verify.mutateAsync({ factorId: pendingEnrollment.factorId, code });
      toast(t('2FA attivato!'), { description: t('Da ora dovrai inserire il codice dell\'app al login.') });
      setEnrollOpen(false);
      setPendingEnrollment(null);
      setCode('');
    } catch (err) {
      toast.error(t('Verifica fallita'), { description: (err as Error).message || t('Codice non corretto, riprova') });
    }
  };

  const cancelEnrollment = () => {
    // Best-effort cleanup of the unverified factor.
    if (pendingEnrollment) {
      unenroll.mutate(pendingEnrollment.factorId);
    }
    setEnrollOpen(false);
    setPendingEnrollment(null);
    setCode('');
  };

  const handleUnenrollVerify = async () => {
    if (!unenrollTarget) return;
    const codeErr = validateTotpCode(unenrollCode);
    if (codeErr) {
      toast.error(t('Codice non valido'), { description: codeErr });
      return;
    }
    setUnenrollVerifying(true);
    try {
      await challengeAndVerify(unenrollTarget, unenrollCode);
      await unenroll.mutateAsync(unenrollTarget);
      toast(t('2FA disattivato'));
      setUnenrollTarget(null);
      setUnenrollCode('');
    } catch (err) {
      toast.error(t('Errore'), { description: (err as Error).message });
    } finally {
      setUnenrollVerifying(false);
    }
  };

  const handleSignOutOthers = async () => {
    setSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      await refetchSessions();
      toast(t('Altre sessioni chiuse'));
    } catch (err) {
      toast.error(t('Errore'), { description: (err as Error).message });
    } finally {
      setSigningOutOthers(false);
    }
  };

  const handleDisconnectSession = async (sessionId: string) => {
    setDisconnectingId(sessionId);
    try {
      await deleteSession.mutateAsync(sessionId);
      toast(t('Dispositivo disconnesso'));
    } catch (err) {
      toast.error(t('Errore'), { description: (err as Error).message });
    } finally {
      setDisconnectingId(null);
    }
  };

  const twoFactorActive = factors.length > 0;

  return (
    <div className="border-t border-border pt-6 space-y-6">
      <h3 className="font-medium flex items-center gap-2">
        <Shield className="w-5 h-5" />
        {t('Sicurezza')}
      </h3>

      {/* 2FA status */}
      <div className="glass rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {twoFactorActive ? (
              <ShieldCheck className="w-5 h-5 text-success" />
            ) : (
              <ShieldX className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">{t('Autenticazione a due fattori (2FA)')}</p>
              <p className="text-sm text-muted-foreground">
                {twoFactorActive
                  ? t('Attiva · livello {{level}}', { level: aal.toUpperCase() })
                  : t('Non configurata — aggiungi un livello di sicurezza al tuo account')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!twoFactorActive && (
              <Button onClick={startEnrollment} disabled={enroll.isPending}>
                {enroll.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                {t('Attiva 2FA')}
              </Button>
            )}
            {twoFactorActive && factors.map((f) => (
              <Button
                key={f.id}
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setUnenrollTarget(f.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('Rimuovi')}
              </Button>
            ))}
          </div>
        </div>
        {factorsLoading && <p className="text-sm text-muted-foreground">{t('Caricamento…')}</p>}
      </div>

      {/* Current accesses */}
      <div className="glass rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">{t('Accessi attuali')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOutOthers}
            disabled={signingOutOthers}
          >
            {signingOutOthers ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            {t('Disconnetti altre sessioni')}
          </Button>
        </div>

        {sessionsLoading ? (
          <p className="text-sm text-muted-foreground">{t('Caricamento…')}</p>
        ) : sessionsError ? (
          <p className="text-sm text-destructive">{t('Errore nel caricamento delle sessioni.')}</p>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('Nessuna sessione attiva.')}</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.map((session) => {
              const ua = parseUserAgent(session.user_agent);
              const Icon = ua.kind === 'mobile' ? Smartphone : Monitor;
              const isCurrent = session.user_agent === currentUa;
              return (
                <li
                  key={session.id}
                  className={`flex items-center gap-3 text-sm py-1.5 ${isCurrent ? 'rounded-md bg-primary/5 p-3' : 'border-b border-border/50 last:border-0'}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{ua.browser} su {ua.os}</span>
                    {isCurrent && <span className="text-muted-foreground"> · {t('Questo dispositivo')}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isCurrent && <Badge variant="secondary" className="text-xs">{t('Attuale')}</Badge>}
                    {!isCurrent && session.session_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDisconnectSession(session.session_id!)}
                        disabled={disconnectingId === session.session_id}
                        title={t('Disconnetti questo dispositivo')}
                      >
                        {disconnectingId === session.session_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(session.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Enrollment dialog */}
      <Dialog open={enrollOpen} onOpenChange={(o) => !o && cancelEnrollment()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Configura l\'autenticazione a due fattori')}</DialogTitle>
            <DialogDescription>
              {t('Scansiona il QR code con la tua app di autenticazione (Google Authenticator, Authy, 1Password…) e inserisci il codice a 6 cifre.')}
            </DialogDescription>
          </DialogHeader>

          {pendingEnrollment && (
            <div className="space-y-4">
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <QRCodeSVG value={pendingEnrollment.uri} size={192} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('Chiave manuale (se non puoi scansionare)')}</Label>
                <code className="block text-xs font-mono bg-muted p-2 rounded break-all">
                  {extractSecretFromUri(pendingEnrollment.uri) ?? pendingEnrollment.secret}
                </code>
              </div>
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {t('Salva questa chiave in un posto sicuro: è l\'unico backup se perdi il telefono. Senza di essa potresti non riuscire più ad accedere al tuo account.')}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t('Codice di verifica')}</Label>
                <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cancelEnrollment}>{t('Annulla')}</Button>
            <Button onClick={confirmEnrollment} disabled={verify.isPending || code.length !== 6}>
              {verify.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('Verifica e attiva')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unenroll 2FA verification */}
      <Dialog open={!!unenrollTarget} onOpenChange={(o) => { if (!o) { setUnenrollTarget(null); setUnenrollCode(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Disattivare il 2FA?')}</DialogTitle>
            <DialogDescription>
              {t('Inserisci il codice della tua app di autenticazione per confermare la disattivazione.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('Codice di verifica')}</Label>
              <InputOTP maxLength={6} value={unenrollCode} onChange={(v) => setUnenrollCode(v.replace(/\D/g, ''))}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUnenrollTarget(null); setUnenrollCode(''); }}>
              {t('Annulla')}
            </Button>
            <Button
              onClick={handleUnenrollVerify}
              disabled={unenrollVerifying || unenrollCode.length !== 6}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unenrollVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('Disattiva')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
