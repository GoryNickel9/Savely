import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import { LogOut, Download, Trash2, ShieldCheck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AccountSection from '@/components/settings/AccountSection';
import CurrencySection from '@/components/settings/CurrencySection';
import LanguageSection from '@/components/settings/LanguageSection';
import ImportExportSection from '@/components/settings/ImportExportSection';
import CategoriesSection from '@/components/settings/CategoriesSection';
import CoupleSettingsSection from '@/components/settings/CoupleSettingsSection';
import SecuritySection from '@/components/settings/SecuritySection';

/**
 * Pagina Impostazioni: shell che compone le sezioni estratte in
 * @/components/settings (TD-006). Le uniche logiche rimaste qui sono la
 * sezione Privacy (condivide il dialog Import/Export) e la Zona Pericolo.
 */
export default function Settings() {
  const { signOut } = useAuth();
  const { permissions } = usePermissions();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Controllato qui perché il dialog è aperto sia dalla sezione
  // Import/Export sia dal bottone di esportazione nella sezione Privacy.
  const [importExportDialogOpen, setImportExportDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('Impostazioni')}</h1>
          <p className="text-muted-foreground">{t('Gestisci il tuo account')}</p>
        </div>

        <div className="glass rounded-xl p-6 space-y-6">
          <AccountSection />
          <CurrencySection />
          <LanguageSection />
          <ImportExportSection open={importExportDialogOpen} onOpenChange={setImportExportDialogOpen} />
          <CategoriesSection />

          {/* Couple Expenses Section */}
          {permissions?.couple_expenses && <CoupleSettingsSection />}

          {/* Security: 2FA + login activity + sessions */}
          <SecuritySection />

          {/* Privacy & Data (GDPR) */}
          <div className="border-t border-border pt-6 space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              {t('Privacy e Dati')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('In conformityà al Regolamento (UE) 2016/679 (GDPR), hai diritto di accedere, rettificare, cancellare, esportare (portabilità) e opporti al trattamento dei tuoi dati personali.')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setImportExportDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('Esporta tutti i miei dati')}
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/privacy">
                  <FileText className="w-4 h-4 mr-2" />
                  {t('Privacy Policy')}
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('Per richieste relative ai tuoi dati scrivi a')}{' '}
              <a href="mailto:lucabaldino10@proton.me" className="text-primary hover:underline">
                lucabaldino10@proton.me
              </a>
              {t('. Per cancellare definitivamente il tuo account, vedi la sezione "Zona Pericolo" sottostante.')}
            </p>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-border pt-6 space-y-4">
            <h3 className="font-medium text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {t('Zona Pericolo')}
            </h3>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                onClick={signOut}
                className="w-full sm:w-auto"
              >
                <LogOut className="w-5 h-5 mr-2" />
                {t('Esci dall\'account')}
              </Button>

              {/* Delete Account completely */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    {t('Elimina account')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('Sei sicuro?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('Questa azione è irreversibile. Tutti i tuoi dati verranno eliminati permanentemente, incluse transazioni, budget, obiettivi e portfolio. L\'account verrà chiuso.')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('Annulla')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) {
                            toast.error(t('Errore'), { description: t('Sessione non valida') });
                            return;
                          }

                          const response = await supabase.functions.invoke('delete-account');

                          // Trasporto/errore di livello RPC (network, non-2xx senza body JSON).
                          if (response.error) {
                            throw response.error;
                          }
                          // Errore logico restituito nel body dalla edge function
                          // (es. 401 "Invalid user", 500 "Failed to delete account").
                          // Senza questo check verrebbe ignorato e l'utente sarebbe
                          // sloggato/redirectato nonostante l'account non sia stato
                          // effettivamente eliminato (finding L6).
                          if (response.data?.error) {
                            throw new Error(response.data.error);
                          }

                          toast(t('Account eliminato'), { description: t('Il tuo account è stato eliminato con successo') });
                          await signOut();
                          navigate('/auth');
                        } catch (error) {
                          console.error('Delete account error:', error);
                          toast.error(t('Errore'), { description: t('Impossibile eliminare l\'account') });
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? t('Eliminazione...') : t('Elimina definitivamente')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
