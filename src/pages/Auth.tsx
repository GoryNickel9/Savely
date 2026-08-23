import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { Loader2, TrendingUp, Shield, PieChart, Check, X, MailCheck, KeyRound } from 'lucide-react';
import { z } from 'zod';
import { passwordSchema, checkPasswordRequirements, passwordRequirementsList } from '@/lib/passwordValidation';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { challengeAndVerify } from '@/hooks/useMfa';

export default function Auth() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  // Toggle admin: se le registrazioni sono chiuse, il form di signup viene
  // disabilitato (l'enforcement reale è il trigger su auth.users).
  const [registrationsEnabled, setRegistrationsEnabled] = useState<boolean | null>(null);
  // MFA challenge state: when the user has an active TOTP factor, we require a
  // second step after the password succeeds.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const { user, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const authSchema = z.object({
    email: z.string().email(t('Email non valida')),
    password: passwordSchema,
    fullName: z.string().optional(),
  });

  useEffect(() => {
    // In caso di errore (funzione non disponibile) resta abilitato.
    supabase.rpc('get_registrations_enabled').then(({ data }) => {
      setRegistrationsEnabled(data !== false);
    });
  }, []);

  useEffect(() => {
    // Navigate to "/" only when fully authenticated and no MFA is pending.
    // The `loading` guard ensures we don't navigate during the MFA check
    // (which happens after a successful password sign-in, before `loading`
    // is set to false).
    if (user && !resetSent && !loading && !mfaFactorId) {
      navigate('/');
    }
  }, [user, navigate, resetSent, loading, mfaFactorId]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password, fullName });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.issues.forEach((err) => {
          if (err.path[0] === 'email') fieldErrors.email = err.message;
          if (err.path[0] === 'password') fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    const { error } = await signIn(email, password);

    if (error) {
      setLoading(false);
      toast.error(t('Errore di accesso'), { description: error.message === 'Invalid login credentials'
          ? t('Email o password non corretti')
          : error.message });
      return;
    }

    // After a successful password login, check whether the user has an enrolled
    // TOTP factor. If so and the session is only aal1, require the MFA code.
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totpFactor = (factorsData?.totp ?? [])[0];
        if (totpFactor) {
          setMfaFactorId(totpFactor.id);
          setMfaCode('');
          setLoading(false);
          return; // stay on /auth, the MFA step UI will render
        }
      }
    } catch {
      // If MFA checks fail, proceed to normal navigation.
    }
    // No MFA required → navigate to the dashboard.
    setLoading(false);
    navigate('/');
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setMfaVerifying(true);
    try {
      await challengeAndVerify(mfaFactorId, mfaCode);
      setMfaFactorId(null);
      setMfaCode('');
      // Navigation to "/" is handled by the useEffect on `user`.
    } catch (err) {
      toast.error(t('Codice 2FA non valido'), { description: (err as Error).message || t('Verifica non riuscita, riprova') });
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleMfaCancel = async () => {
    // Abort the MFA step: sign the partial session out and return to the form.
    await supabase.auth.signOut();
    setMfaFactorId(null);
    setMfaCode('');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!privacyAccepted) {
      toast.error(t('Consenso obbligatorio'), { description: t('Devi accettare la Privacy Policy, la Cookie Policy e i Termini di servizio per registrarti.') });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);

    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = t('Questa email è già registrata. Prova ad accedere.');
      }
      toast.error(t('Errore di registrazione'), { description: message });
    } else {
      toast(t('Registrazione completata!'), { description: t('Benvenuto in Savely') });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error(t('Inserisci la tua email'));
      return;
    }

    setResetLoading(true);
    const { error } = await resetPassword(resetEmail);
    setResetLoading(false);

    if (error) {
      toast.error(t('Errore'), { description: error.message });
    } else {
      setSentEmail(resetEmail);
      setResetSent(true);
      setResetDialogOpen(false);
      setResetEmail('');
    }
  };

  return (
    <div className="min-h-screen flex dark">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-background to-accent/20 p-12 flex-col justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold">{t('Savely')}</h1>
          <p className="text-muted-foreground mt-2">{t('La tua finanza personale, semplificata')}</p>
        </div>
        
        <div className="space-y-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('Traccia le tue finanze')}</h3>
              <p className="text-sm text-muted-foreground">{t('Monitora entrate, uscite e investimenti in un unico posto')}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent/10 text-accent">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('Analisi del portfolio')}</h3>
              <p className="text-sm text-muted-foreground">{t('Visualizza la tua asset allocation e performance')}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-success/10 text-success">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('Sicuro e privato')}</h3>
              <p className="text-sm text-muted-foreground">{t('I tuoi dati finanziari sono protetti e criptati')}</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
              {t('Privacy')}
            </a>
            <a href="/cookies" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
              {t('Cookie')}
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
              {t('Termini')}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">{t('© {{year}} Savely. Tutti i diritti riservati.', { year: new Date().getFullYear() })}</p>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md glass border-border/50">
          <CardHeader className="space-y-1 text-center">
            <div className="lg:hidden mb-4">
              <h1 className="text-3xl font-display font-bold text-gradient">{t('Savely')}</h1>
              <p className="text-muted-foreground mt-1">{t('La tua finanza personale semplificata')}</p>
            </div>
            <CardTitle className="text-2xl font-display">{t('Benvenuto')}</CardTitle>
            <CardDescription>{t('Accedi o crea un account per continuare')}</CardDescription>
          </CardHeader>
          <CardContent>
            {resetSent ? (
              <div className="text-center space-y-6 py-8">
                <div className="mx-auto p-3 rounded-xl bg-primary/10 text-primary w-fit">
                  <MailCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-display mb-2">{t('Controlla la tua email')}</h2>
                  <p className="text-muted-foreground">
                    {t('Abbiamo inviato le istruzioni per recuperare la password a')} <strong>{sentEmail}</strong>.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setResetSent(false)}>
                  {t('Torna al login')}
                </Button>
              </div>
            ) : mfaFactorId ? (
              <form onSubmit={handleMfaVerify} className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto p-3 rounded-xl bg-primary/10 text-primary w-fit">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-display">{t('Verifica in due passaggi')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('Inserisci il codice a 6 cifre dalla tua app di autenticazione.')}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <InputOTP maxLength={6} value={mfaCode} onChange={(v) => setMfaCode(v)}>
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
                <Button type="submit" className="w-full" disabled={mfaVerifying || mfaCode.length !== 6}>
                  {mfaVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('Verifica')}
                </Button>
                <Button type="button" variant="link" className="w-full text-muted-foreground" onClick={handleMfaCancel}>
                  {t('Annulla')}
                </Button>
              </form>
            ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">{t('Accedi')}</TabsTrigger>
                <TabsTrigger value="signup">{t('Registrati')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-signin">{t('Email')}</Label>
                    <Input
                      id="email-signin"
                      type="email"
                      placeholder={t('nome@esempio.com')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signin">{t('Password')}</Label>
                    <Input
                      id="password-signin"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={errors.password ? 'border-destructive' : ''}
                    />
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('Accedi')}
                  </Button>
                  
                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="link" className="w-full text-muted-foreground">
                        {t('Password dimenticata?')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('Recupera Password')}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">{t('Email')}</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder={t('nome@esempio.com')}
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={resetLoading}>
                          {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t('Invia link di recupero')}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  {registrationsEnabled === false && (
                    <Alert variant="destructive">
                      <AlertTitle>{t('Registrazioni chiuse')}</AlertTitle>
                      <AlertDescription>
                        {t('Le registrazioni sono temporaneamente disabilitate. Torna più tardi.')}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="fullname">{t('Nome completo')}</Label>
                    <Input
                      id="fullname"
                      type="text"
                      placeholder={t('Mario Rossi')}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-signup">{t('Email')}</Label>
                    <Input
                      id="email-signup"
                      type="email"
                      placeholder={t('nome@esempio.com')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signup">{t('Password')}</Label>
                    <Input
                      id="password-signup"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={errors.password ? 'border-destructive' : ''}
                    />
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                    
                    {/* Password Requirements Indicator */}
                    {password && (
                      <div className="mt-3 space-y-2 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-2">{t('Requisiti password:')}</p>
                        {passwordRequirementsList.map((req) => {
                          const isMet = checkPasswordRequirements(password)[req.key];
                          return (
                            <div key={req.key} className="flex items-center gap-2 text-sm">
                              {isMet ? (
                                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                              )}
                              <span className={isMet ? 'text-green-600' : 'text-muted-foreground'}>
                                {req.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border p-3 bg-muted/30">
                    <Checkbox
                      id="privacy-consent"
                      checked={privacyAccepted}
                      onCheckedChange={(v) => setPrivacyAccepted(v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="privacy-consent" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                      {t('Ho letto e accetto la')}{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {t('Privacy Policy')}
                      </a>
                      {t(', la')}{' '}
                      <a href="/cookies" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {t('Cookie Policy')}
                      </a>{' '}
                      {t('e i')}{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {t('Termini di servizio')}
                      </a>
                      .
                    </label>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || registrationsEnabled === false}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('Crea account')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
