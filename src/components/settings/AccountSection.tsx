import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  passwordSchema,
  checkPasswordRequirements,
  passwordRequirementsList,
} from '@/lib/passwordValidation';

/**
 * Sezione "Informazioni Account" di Settings: card profilo e dialog di
 * modifica credenziali (email/password). Estratta da Settings.tsx (TD-006).
 */
export default function AccountSection() {
  const { user, updateEmail, updatePassword } = useAuth();
  const { t } = useTranslation();

  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      // Always require current password for security
      if (!currentPassword) {
        throw new Error(t('Inserisci la password attuale per confermare le modifiche'));
      }

      // Update email if changed
      if (newEmail && newEmail !== user?.email) {
        const { error } = await updateEmail(newEmail);
        if (error) throw error;
        toast(t('Email aggiornata con successo'));
      }

      // Update password if provided
      if (newPassword) {
        // Validate password using the new schema
        try {
          passwordSchema.parse(newPassword);
        } catch (error: unknown) {
          throw new Error((error as { issues?: Array<{ message: string }> }).issues?.[0]?.message || t('La password non soddisfa i requisiti di sicurezza'));
        }

        if (newPassword !== confirmPassword) {
          throw new Error(t('Le password non coincidono'));
        }
        if (newPassword === currentPassword) {
          throw new Error(t('La nuova password non può essere uguale a quella attuale'));
        }
        const { error } = await updatePassword(newPassword);
        if (error) throw error;
        toast(t('Password aggiornata con successo'));
      }

      setAccountEditOpen(false);
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      toast.error(t('Errore'), { description: (error as Error).message || t('Impossibile aggiornare le credenziali') });
    } finally {
      setIsUpdating(false);
    }
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('Utente');

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-medium">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{userName}</h2>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          {t('Informazioni Account')}
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">{t('Nome')}</span>
            <span className="font-medium">{userName}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">{t('Email')}</span>
            <span className="font-medium">{user?.email}</span>
          </div>
        </div>
        <div className="mt-4">
          <Dialog open={accountEditOpen} onOpenChange={setAccountEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Edit2 className="w-4 h-4 mr-2" />
                {t('Modifica credenziali')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('Modifica credenziali')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAccountUpdate} className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t('Password attuale')}</label>
                  <Input
                    type="password"
                    placeholder={t('Inserisci la password attuale per confermare')}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t('Nuova email')}</label>
                  <Input
                    type="email"
                    placeholder="nuova@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t('Nuova password')}</label>
                  <Input
                    type="password"
                    placeholder={t('Lascia vuoto per non cambiare')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />

                  {/* Password Requirements Indicator */}
                  {newPassword && (
                    <div className="mt-3 space-y-2 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">{t('Requisiti password:')}</p>
                      {passwordRequirementsList.map((req) => {
                        const isMet = checkPasswordRequirements(newPassword)[req.key];
                        return (
                          <div key={req.key} className="flex items-center gap-2 text-sm">
                            {isMet ? (
                              <Check className="w-4 h-4 text-green-500 shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-red-500 shrink-0" />
                            )}
                            <span className={isMet ? 'text-green-600' : 'text-muted-foreground'}>
                              {t(req.label)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {newPassword && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">{t('Conferma nuova password')}</label>
                    <Input
                      type="password"
                      placeholder={t('Conferma la nuova password')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isUpdating}>
                  {isUpdating ? t('Aggiornamento...') : t('Aggiorna')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
