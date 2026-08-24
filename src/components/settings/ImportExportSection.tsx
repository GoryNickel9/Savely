import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, Download, Upload, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { USER_TABLES } from '@/lib/constants';
import { serializeCsvRows } from '@/lib/csv';
import RevolutImportDialog from '@/components/settings/RevolutImportDialog';
import BankImportDialog from '@/components/settings/BankImportDialog';
import ISINMappingsDialog from '@/components/settings/ISINMappingsDialog';

interface ImportExportSectionProps {
  /** Stato controllato: il dialog è aperto anche dal bottone nella sezione Privacy. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Sezione "Import / Export Dati" di Settings: import da banche, mapping ISIN
 * ed export CSV GDPR. Estratta da Settings.tsx (TD-006).
 */
export default function ImportExportSection({ open, onOpenChange }: ImportExportSectionProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [isExporting, setIsExporting] = useState(false);
  const [revolutDialogOpen, setRevolutDialogOpen] = useState(false);
  const [bankImportDialogOpen, setBankImportDialogOpen] = useState(false);
  const [isinMappingsDialogOpen, setIsinMappingsDialogOpen] = useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportData = async () => {
    if (!user) return;
    setIsExporting(true);

    try {
      // Fetch all data — include every user-scoped table for GDPR portability (art. 20).
      // La lista è centralizzata in `USER_TABLES` (@/lib/constants) ed è garantita
      // valida a compile-time dal tipo UserTableName.
      const tables = USER_TABLES;

      const results = await Promise.all(
        tables.map(async (t) => {
          try {
            const res = await supabase.from(t).select('*');
            return {
              table: t,
              data: res.data as unknown[] | null,
              error: res.error ? { message: res.error.message } : null,
            };
          } catch (err) {
            // Tabelle non ancora create nel DB o senza RLS tornerebbero errore:
            // le ignoriamo per non bloccare l'export delle altre.
            return { table: t, data: null, error: { message: String(err) } };
          }
        })
      );

      const rows: Array<Record<string, unknown>> = [];
      for (const r of results) {
        if (r.data && Array.isArray(r.data)) {
          for (const row of r.data) {
            rows.push({ entity: r.table, ...(row as Record<string, unknown>) });
          }
        }
      }

      if (rows.length === 0) {
        toast.error(t('Nessun dato'), { description: t('Non ci sono dati da esportare') });
        return;
      }

      const filename = `savely_export_${new Date().toISOString().split('T')[0]}.csv`;
      const csvContent = serializeCsvRows(rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, filename);

      toast(t('Export completato'), { description: t('Dati esportati in {{filename}}', { filename }) });
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('Errore export'), { description: t('Si è verificato un errore durante l\'export') });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="border-t border-border pt-6">
      <h3 className="font-medium mb-4 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5" />
        {t('Import / Export Dati')}
      </h3>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full sm:w-auto">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {t('Gestisci Import / Export')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('Import / Export Dati')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">


            {/* Import from Banks */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {t('Importa transazioni dalla tua banca.')}{' '}
                {t('Non hai file CSV?')}{' '}
                <a
                  href="https://bank.savely.cc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t('Clicca qui.')}
                </a>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRevolutDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  {t('Revolut')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBankImportDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  {t('BBVA / Trade Republic')}
                </Button>
              </div>
              {user && (
                <>
                  <RevolutImportDialog
                    open={revolutDialogOpen}
                    onOpenChange={setRevolutDialogOpen}
                    userId={user.id}
                  />
                  <BankImportDialog
                    open={bankImportDialogOpen}
                    onOpenChange={setBankImportDialogOpen}
                    userId={user.id}
                  />
                  <ISINMappingsDialog
                    open={isinMappingsDialogOpen}
                    onOpenChange={setIsinMappingsDialogOpen}
                    userId={user.id}
                  />
                </>
              )}
            </div>

            {/* ISIN Mappings Management */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {t('Gestisci i mapping ISIN per gli investimenti importati.')}
              </p>
              <Button
                variant="outline"
                onClick={() => setIsinMappingsDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Settings2 className="w-5 h-5 mr-2" />
                {t('Gestisci Mapping ISIN')}
              </Button>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {t('Esporta tutti i tuoi dati in un file.')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => exportData()}
                  disabled={isExporting}
                >
                  <Download className="w-5 h-5 mr-2" />
                  {isExporting ? t('Esportazione...') : t('Esporta CSV')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
