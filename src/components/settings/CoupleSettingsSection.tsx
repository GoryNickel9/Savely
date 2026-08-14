import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Copy, Check, Clock, UserCheck, Link2Off, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useCouplePairStatus } from '@/hooks/useCouplePairStatus';
import { useToast } from '@/hooks/use-toast';
import { validateCoupleCode } from '@/lib/coupleExpenses';

export default function CoupleSettingsSection() {
  const {
    isLoading,
    myCode,
    connection,
    sentRequests,
    receivedRequests,
    sendRequest,
    cancelRequest,
    rejectRequest,
    acceptRequest,
    revokeConnection,
  } = useCouplePairStatus();

  const { toast } = useToast();
  const { t } = useTranslation();
  const [partnerCode, setPartnerCode] = useState('');
  const [copied, setCopied] = useState(false);

  // The first pending sent request (we allow at most one active pair anyway)
  const pendingSent = sentRequests[0] ?? null;
  const pendingReceived = receivedRequests[0] ?? null;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleCopyCode = async () => {
    if (!myCode) return;
    await navigator.clipboard.writeText(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: t('Codice copiato negli appunti') });
  };

  const handleSend = async () => {
    const validationError = validateCoupleCode(partnerCode);
    if (validationError) {
      toast({ title: t('Codice non valido'), description: validationError, variant: 'destructive' });
      return;
    }
    try {
      await sendRequest.mutateAsync(partnerCode.trim().toUpperCase());
      setPartnerCode('');
      toast({ title: t('Richiesta inviata'), description: t('Il tuo partner riceverà la tua richiesta.') });
    } catch (err: unknown) {
      toast({
        title: t('Errore'),
        description: (err as Error).message ?? t('Impossibile inviare la richiesta.'),
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async () => {
    if (!pendingSent) return;
    try {
      await cancelRequest.mutateAsync(pendingSent.id);
      toast({ title: t('Richiesta annullata') });
    } catch (err: unknown) {
      toast({ title: t('Errore'), description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!pendingReceived) return;
    try {
      await rejectRequest.mutateAsync(pendingReceived.id);
      toast({ title: t('Richiesta rifiutata') });
    } catch (err: unknown) {
      toast({ title: t('Errore'), description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleAccept = async () => {
    if (!pendingReceived) return;
    try {
      await acceptRequest.mutateAsync(pendingReceived.id);
      toast({ title: t('Connessione stabilita!'), description: t('Ora sei collegato con il tuo partner.') });
    } catch (err: unknown) {
      toast({ title: t('Errore'), description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleRevoke = async () => {
    if (!connection) return;
    try {
      await revokeConnection.mutateAsync(connection.id);
      toast({ title: t('Connessione revocata'), description: t('Le spese condivise sono ora archiviate in sola lettura.') });
    } catch (err: unknown) {
      toast({ title: t('Errore'), description: (err as Error).message, variant: 'destructive' });
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="border-t border-border pt-6">
        <div className="animate-pulse text-muted-foreground text-sm">{t('Caricamento sezione famiglia...')}</div>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-6 space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-400" />
        {t('Spese Familiari')}
      </h3>

      {/* Your couple code — always visible */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t('Il tuo codice familiare')}</p>
        <div className="flex items-center gap-2">
          <div className="glass rounded-lg px-4 py-2 font-mono text-lg tracking-widest font-bold select-all">
            {myCode ?? '—'}
          </div>
          <Button variant="outline" size="icon" onClick={handleCopyCode} title={t('Copia codice')}>
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('Condividi questo codice con il tuo partner per collegarvi.')}
        </p>
      </div>

      {/* ---- State 4: active connection ---- */}
      {connection && (
        <div className="glass rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-400" />
            <span className="font-medium">{t('Connessione attiva')}</span>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              {t('Attiva')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('Sei collegato con il tuo partner. Puoi condividere spese e gestire un budget comune.')}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10">
                <Link2Off className="w-4 h-4 mr-2" />
                {t('Revoca connessione')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('Revocare la connessione?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('La connessione verrà revocata. Le spese condivise esistenti diventeranno un archivio in sola lettura e non potrete più condividere nuove spese. Questa azione non può essere annullata direttamente — dovrete inviare una nuova richiesta di collegamento.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Annulla')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevoke}
                  disabled={revokeConnection.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {revokeConnection.isPending ? t('Revoca in corso...') : t('Revoca connessione')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* ---- State 3: request received ---- */}
      {!connection && pendingReceived && (
        <div className="glass rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-400" />
            <span className="font-medium">{t('Richiesta ricevuta')}</span>
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
              {t('In attesa')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('Hai ricevuto una richiesta di collegamento. Accettala per iniziare a condividere le spese.')}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={acceptRequest.isPending || rejectRequest.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {acceptRequest.isPending ? t('Accettazione...') : t('Accetta')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={acceptRequest.isPending || rejectRequest.isPending}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              {rejectRequest.isPending ? t('Rifiuto...') : t('Rifiuta')}
            </Button>
          </div>
        </div>
      )}

      {/* ---- State 2: request sent ---- */}
      {!connection && !pendingReceived && pendingSent && (
        <div className="glass rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span className="font-medium">{t('Richiesta inviata')}</span>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
              {t('In attesa')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('La tua richiesta è in attesa di accettazione. Condividi il tuo codice familiare con il partner in modo che possa trovarti.')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={cancelRequest.isPending}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            {cancelRequest.isPending ? t('Annullamento...') : t('Annulla richiesta')}
          </Button>
        </div>
      )}

      {/* ---- State 1: no connection, no pending requests ---- */}
      {!connection && !pendingSent && !pendingReceived && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('Inserisci il codice familiare del tuo partner per inviare una richiesta di collegamento.')}
          </p>
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('Es. ABCD2345')}
              value={partnerCode}
              onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="font-mono tracking-widest uppercase w-40"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            />
            <Button
              onClick={handleSend}
              disabled={sendRequest.isPending || partnerCode.trim().length === 0}
            >
              {sendRequest.isPending ? t('Invio...') : t('Collega')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
