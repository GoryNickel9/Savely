import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, ShieldCheck, ShieldX, Smartphone, Monitor, Trash2, Loader2, LogOut, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useFactors, useEnrollTotp, useVerifyEnrollment, useUnenrollFactor, challengeAndVerify } from '@/hooks/useMfa';
import { useLoginActivity } from '@/hooks/useLoginActivity';
import { supabase } from '@/integrations/supabase/client';
import { parseUserAgent } from '@/lib/userAgent';
import { validateTotpCode, extractSecretFromUri } from '@/lib/mfa';

/**
 * Security section: 2FA (TOTP) enrollment/management + current accesses +
 * "sign out other sessions". Rendered inside Settings.tsx.
 */
export default function SecuritySection() {
  const { toast } = useToast();
  const { data: factorsData, isLoading: factorsLoading } = useFactors();
  const enroll = useEnrollTotp();
  const verify = useVerifyEnrollment();
  const unenroll = useUnenrollFactor();

  const { refetch: refetchActivity } = useLoginActivity();

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [pendingEnrollment, setPendingEnrollment] = useState<{ factorId: string; uri: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [unenrollTarget, setUnenrollTarget] = useState<string | null>(null);
  const [unenrollCode, setUnenrollCode] = useState('');
  const [unenrollVerifying, setUnenrollVerifying] = useState(false);

  const currentUa = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const currentDevice = parseUserAgent(currentUa);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

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
      toast({
        title: 'Errore',
        description: (err as Error).message || 'Impossibile avviare la configurazione 2FA',
        variant: 'destructive',
      });
    }
  };

  const confirmEnrollment = async () => {
    if (!pendingEnrollment) return;
    const codeErr = validateTotpCode(code);
    if (codeErr) {
      toast({ title: 'Codice non valido', description: codeErr, variant: 'destructive' });
      return;
    }
    try {
      await verify.mutateAsync({ factorId: pendingEnrollment.factorId, code });
      toast({ title: '2FA attivato!', description: 'Da ora dovrai inserire il codice dell\'app al login.' });
      setEnrollOpen(false);
      setPendingEnrollment(null);
      setCode('');
    } catch (err) {
      toast({
        title: 'Verifica fallita',
        description: (err as Error).message || 'Codice non corretto, riprova',
        variant: 'destructive',
      });
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
      toast({ title: 'Codice non valido', description: codeErr, variant: 'destructive' });
      return;
    }
    setUnenrollVerifying(true);
    try {
      await challengeAndVerify(unenrollTarget, unenrollCode);
      await unenroll.mutateAsync(unenrollTarget);
      toast({ title: '2FA disattivato' });
      setUnenrollTarget(null);
      setUnenrollCode('');
    } catch (err) {
      toast({ title: 'Errore', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUnenrollVerifying(false);
    }
  };

  const handleSignOutOthers = async () => {
    setSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      await refetchActivity();
      toast({ title: 'Altre sessioni chiuse' });
    } catch (err) {
      toast({ title: 'Errore', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSigningOutOthers(false);
    }
  };

  const twoFactorActive = factors.length > 0;

  return (
    <div className="border-t border-border pt-6 space-y-6">
      <h3 className="font-medium flex items-center gap-2">
        <Shield className="w-5 h-5" />
        Sicurezza
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
              <p className="font-medium">Autenticazione a due fattori (2FA)</p>
              <p className="text-sm text-muted-foreground">
                {twoFactorActive
                  ? `Attiva · livello ${aal.toUpperCase()}`
                  : 'Non configurata — aggiungi un livello di sicurezza al tuo account'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!twoFactorActive && (
              <Button onClick={startEnrollment} disabled={enroll.isPending}>
                {enroll.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Attiva 2FA
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
                Rimuovi
              </Button>
            ))}
          </div>
        </div>
        {factorsLoading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
      </div>

      {/* Current accesses */}
      <div className="glass rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">Accessi attuali</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOutOthers}
            disabled={signingOutOthers}
          >
            {signingOutOthers ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Disconnetti altre sessioni
          </Button>
        </div>

        {/* Current session */}
        <div className="flex items-center gap-3 text-sm py-1.5 rounded-md bg-primary/5 p-3">
          {currentDevice.kind === 'mobile' ? (
            <Smartphone className="w-4 h-4 text-primary flex-shrink-0" />
          ) : (
            <Monitor className="w-4 h-4 text-primary flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-medium">{currentDevice.browser} su {currentDevice.os}</span>
            <span className="text-muted-foreground"> · Questo dispositivo</span>
          </div>
          <Badge variant="secondary" className="text-xs">Attuale</Badge>
        </div>
      </div>

      {/* Enrollment dialog */}
      <Dialog open={enrollOpen} onOpenChange={(o) => !o && cancelEnrollment()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configura l'autenticazione a due fattori</DialogTitle>
            <DialogDescription>
              Scansiona il QR code con la tua app di autenticazione (Google Authenticator,
              Authy, 1Password…) e inserisci il codice a 6 cifre.
            </DialogDescription>
          </DialogHeader>

          {pendingEnrollment && (
            <div className="space-y-4">
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <QRCodeSVG value={pendingEnrollment.uri} size={192} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Chiave manuale (se non puoi scansionare)</Label>
                <code className="block text-xs font-mono bg-muted p-2 rounded break-all">
                  {extractSecretFromUri(pendingEnrollment.uri) ?? pendingEnrollment.secret}
                </code>
              </div>
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Salva questa chiave in un posto sicuro: è l'unico backup se perdi il telefono.
                  Senza di essa potresti non riuscire più ad accedere al tuo account.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Codice di verifica</Label>
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
            <Button variant="outline" onClick={cancelEnrollment}>Annulla</Button>
            <Button onClick={confirmEnrollment} disabled={verify.isPending || code.length !== 6}>
              {verify.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verifica e attiva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unenroll 2FA verification */}
      <Dialog open={!!unenrollTarget} onOpenChange={(o) => { if (!o) { setUnenrollTarget(null); setUnenrollCode(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disattivare il 2FA?</DialogTitle>
            <DialogDescription>
              Inserisci il codice della tua app di autenticazione per confermare la disattivazione.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Codice di verifica</Label>
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
              Annulla
            </Button>
            <Button
              onClick={handleUnenrollVerify}
              disabled={unenrollVerifying || unenrollCode.length !== 6}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unenrollVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Disattiva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
