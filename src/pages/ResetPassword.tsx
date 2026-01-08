import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Check, X } from 'lucide-react';
import { z } from 'zod';
import { confirmPasswordSchema, checkPasswordRequirements, passwordRequirementsList } from '@/lib/passwordValidation';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [hasAccess, setHasAccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user arrived via password reset link
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasAccess(true);
      } else if (session) {
        // User is already logged in, allow password change
        setHasAccess(true);
      }
    });

    // Also check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasAccess(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      confirmPasswordSchema.parse({ password, confirmPassword });
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { password?: string; confirmPassword?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'password') fieldErrors.password = err.message;
          if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
        });
        setErrors(fieldErrors);
      }
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Password aggiornata!',
        description: 'La tua password è stata cambiata con successo.',
      });
      navigate('/');
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <Card className="w-full max-w-md glass border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">Link non valido</CardTitle>
            <CardDescription>
              Questo link di recupero password non è valido o è scaduto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Torna al login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md glass border-border/50">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto p-3 rounded-xl bg-primary/10 text-primary w-fit mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-display">Nuova Password</CardTitle>
          <CardDescription>Inserisci la tua nuova password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nuova Password</Label>
              <Input
                id="password"
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={errors.confirmPassword ? 'border-destructive' : ''}
              />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aggiorna Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
