import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, Shield, PieChart, Check, X, MailCheck, KeyRound } from 'lucide-react';
import { z } from 'zod';
import { passwordSchema, checkPasswordRequirements, passwordRequirementsList } from '@/lib/passwordValidation';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { challengeAndVerify } from '@/hooks/useMfa';

const authSchema = z.object({
  email: z.string().email('Email non valida'),
  password: passwordSchema,
  fullName: z.string().optional(),
});

export default function Auth() {
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
  // MFA challenge state: when the user has an active TOTP factor, we require a
  // second step after the password succeeds.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const { user, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
        error.errors.forEach((err) => {
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
      toast({
        title: 'Errore di accesso',
        description: error.message === 'Invalid login credentials'
          ? 'Email o password non corretti'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    // After a successful password login, check whether the user has an enrolled
    // TOTP factor. If so and the session is only aal1, require the MFA code.
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totpFactor = (factorsData.totp ?? [])[0];
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
      toast({
        title: 'Codice 2FA non valido',
        description: (err as Error).message || 'Verifica non riuscita, riprova',
        variant: 'destructive',
      });
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
      toast({
        title: 'Consenso obbligatorio',
        description: 'Devi accettare la Privacy Policy, la Cookie Policy e i Termini di servizio per registrarti.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);

    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = 'Questa email è già registrata. Prova ad accedere.';
      }
      toast({
        title: 'Errore di registrazione',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Registrazione completata!',
        description: 'Benvenuto in Spendy',
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({ title: 'Inserisci la tua email', variant: 'destructive' });
      return;
    }

    setResetLoading(true);
    const { error } = await resetPassword(resetEmail);
    setResetLoading(false);

    if (error) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
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
          <h1 className="text-4xl font-display font-bold">Spendy</h1>
          <p className="text-muted-foreground mt-2">La tua finanza personale, semplificata</p>
        </div>
        
        <div className="space-y-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Traccia le tue finanze</h3>
              <p className="text-sm text-muted-foreground">Monitora entrate, uscite e investimenti in un unico posto</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent/10 text-accent">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Analisi del portfolio</h3>
              <p className="text-sm text-muted-foreground">Visualizza la tua asset allocation e performance</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-success/10 text-success">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Sicuro e privato</h3>
              <p className="text-sm text-muted-foreground">I tuoi dati finanziari sono protetti e criptati</p>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground">© 2024 Spendy. Tutti i diritti riservati.</p>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
            Privacy
          </a>
          <a href="/cookies" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
            Cookie
          </a>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
            Termini
          </a>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md glass border-border/50">
          <CardHeader className="space-y-1 text-center">
            <div className="lg:hidden mb-4">
              <h1 className="text-3xl font-display font-bold text-gradient">Spendy</h1>
              <p className="text-muted-foreground mt-1">La tua finanza personale semplificata</p>
            </div>
            <CardTitle className="text-2xl font-display">Benvenuto</CardTitle>
            <CardDescription>Accedi o crea un account per continuare</CardDescription>
          </CardHeader>
          <CardContent>
            {resetSent ? (
              <div className="text-center space-y-6 py-8">
                <div className="mx-auto p-3 rounded-xl bg-primary/10 text-primary w-fit">
                  <MailCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-display mb-2">Controlla la tua email</h2>
                  <p className="text-muted-foreground">
                    Abbiamo inviato le istruzioni per recuperare la password a <strong>{sentEmail}</strong>.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setResetSent(false)}>
                  Torna al login
                </Button>
              </div>
            ) : mfaFactorId ? (
              <form onSubmit={handleMfaVerify} className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto p-3 rounded-xl bg-primary/10 text-primary w-fit">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-display">Verifica in due passaggi</h2>
                  <p className="text-sm text-muted-foreground">
                    Inserisci il codice a 6 cifre dalla tua app di autenticazione.
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
                  Verifica
                </Button>
                <Button type="button" variant="link" className="w-full text-muted-foreground" onClick={handleMfaCancel}>
                  Annulla
                </Button>
              </form>
            ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Accedi</TabsTrigger>
                <TabsTrigger value="signup">Registrati</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-signin">Email</Label>
                    <Input
                      id="email-signin"
                      type="email"
                      placeholder="nome@esempio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signin">Password</Label>
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
                    Accedi
                  </Button>
                  
                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="link" className="w-full text-muted-foreground">
                        Password dimenticata?
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Recupera Password</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="nome@esempio.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={resetLoading}>
                          {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Invia link di recupero
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullname">Nome completo</Label>
                    <Input
                      id="fullname"
                      type="text"
                      placeholder="Mario Rossi"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-signup">Email</Label>
                    <Input
                      id="email-signup"
                      type="email"
                      placeholder="nome@esempio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signup">Password</Label>
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
                        <p className="text-sm font-medium mb-2">Requisiti password:</p>
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
                      Ho letto e accetto la{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Privacy Policy
                      </a>
                      , la{' '}
                      <a href="/cookies" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Cookie Policy
                      </a>{' '}
                      e i{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Termini di servizio
                      </a>
                      .
                    </label>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crea account
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
