import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Download, Upload, FileSpreadsheet, Trash2, Settings2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
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
import * as XLSX from 'xlsx';
import SpendyImportDialog from '@/components/settings/SpendyImportDialog';
import RevolutImportDialog from '@/components/settings/RevolutImportDialog';
import BBVAImportDialog from '@/components/settings/BBVAImportDialog';
import TradeRepublicImportDialog from '@/components/settings/TradeRepublicImportDialog';
import ISINMappingsDialog from '@/components/settings/ISINMappingsDialog';
import { InvestimentiImportDialog } from '@/components/settings/InvestimentiImportDialog';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [spendyDialogOpen, setSpendyDialogOpen] = useState(false);
  const [revolutDialogOpen, setRevolutDialogOpen] = useState(false);
  const [bbvaDialogOpen, setBbvaDialogOpen] = useState(false);
  const [tradeRepublicDialogOpen, setTradeRepublicDialogOpen] = useState(false);
  const [isinMappingsDialogOpen, setIsinMappingsDialogOpen] = useState(false);
  const [investimentiDialogOpen, setInvestimentiDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportData = async (format: 'csv' | 'xlsx') => {
    if (!user) return;
    setIsExporting(true);

    try {
      // Fetch all data
      const [transactionsRes, categoriesRes, budgetsRes, savingsRes, portfolioRes] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('budgets').select('*'),
        supabase.from('savings_goals').select('*'),
        supabase.from('portfolio_assets').select('*'),
      ]);

      const wb = XLSX.utils.book_new();

      // Add sheets
      if (transactionsRes.data?.length) {
        const ws = XLSX.utils.json_to_sheet(transactionsRes.data);
        XLSX.utils.book_append_sheet(wb, ws, 'Transazioni');
      }
      if (categoriesRes.data?.length) {
        const ws = XLSX.utils.json_to_sheet(categoriesRes.data);
        XLSX.utils.book_append_sheet(wb, ws, 'Categorie');
      }
      if (budgetsRes.data?.length) {
        const ws = XLSX.utils.json_to_sheet(budgetsRes.data);
        XLSX.utils.book_append_sheet(wb, ws, 'Budget');
      }
      if (savingsRes.data?.length) {
        const ws = XLSX.utils.json_to_sheet(savingsRes.data);
        XLSX.utils.book_append_sheet(wb, ws, 'Obiettivi');
      }
      if (portfolioRes.data?.length) {
        const ws = XLSX.utils.json_to_sheet(portfolioRes.data);
        XLSX.utils.book_append_sheet(wb, ws, 'Portfolio');
      }

      // Check if workbook has sheets
      if (wb.SheetNames.length === 0) {
        toast({
          title: 'Nessun dato',
          description: 'Non ci sono dati da esportare',
          variant: 'destructive',
        });
        return;
      }

      const filename = `spendy_export_${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (format === 'csv') {
        // Export first sheet as CSV
        const csvContent = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, filename);
      } else {
        XLSX.writeFile(wb, filename);
      }

      toast({
        title: 'Export completato',
        description: `Dati esportati in ${filename}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Errore export',
        description: 'Si è verificato un errore durante l\'export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);

      let importedCount = 0;

      // Import transactions
      if (wb.SheetNames.includes('Transazioni')) {
        const ws = wb.Sheets['Transazioni'];
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        
        for (const row of rows) {
          const { error } = await supabase.from('transactions').insert({
            user_id: user.id,
            amount: Number(row.amount) || 0,
            type: row.type === 'income' ? 'income' : 'expense',
            description: String(row.description || ''),
            date: String(row.date || new Date().toISOString().split('T')[0]),
            currency: 'EUR',
          });
          if (!error) importedCount++;
        }
      }

      // Import categories
      if (wb.SheetNames.includes('Categorie')) {
        const ws = wb.Sheets['Categorie'];
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        
        for (const row of rows) {
          const { error } = await supabase.from('categories').insert({
            user_id: user.id,
            name: String(row.name || 'Categoria'),
            type: row.type === 'income' ? 'income' : 'expense',
            icon: String(row.icon || '💰'),
            color: String(row.color || '#22c55e'),
          });
          if (!error) importedCount++;
        }
      }

      // Import savings goals
      if (wb.SheetNames.includes('Obiettivi')) {
        const ws = wb.Sheets['Obiettivi'];
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        
        for (const row of rows) {
          const { error } = await supabase.from('savings_goals').insert({
            user_id: user.id,
            name: String(row.name || 'Obiettivo'),
            target_amount: Number(row.target_amount) || 0,
            current_amount: Number(row.current_amount) || 0,
            icon: String(row.icon || '🎯'),
            color: String(row.color || '#8b5cf6'),
            deadline: row.deadline ? String(row.deadline) : null,
          });
          if (!error) importedCount++;
        }
      }

      // Import portfolio
      if (wb.SheetNames.includes('Portfolio')) {
        const ws = wb.Sheets['Portfolio'];
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        
        for (const row of rows) {
          const { error } = await supabase.from('portfolio_assets').insert({
            user_id: user.id,
            name: String(row.name || 'Asset'),
            type: String(row.type || 'stock') as 'stock' | 'etf' | 'crypto' | 'bond' | 'cash' | 'real_estate' | 'other',
            quantity: Number(row.quantity) || 0,
            purchase_price: Number(row.purchase_price) || 0,
            current_price: row.current_price ? Number(row.current_price) : null,
            symbol: row.symbol ? String(row.symbol) : null,
            purchase_date: String(row.purchase_date || new Date().toISOString().split('T')[0]),
          });
          if (!error) importedCount++;
        }
      }

      toast({
        title: 'Import completato',
        description: `Importati ${importedCount} record`,
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Errore import',
        description: 'Si è verificato un errore durante l\'import. Verifica il formato del file.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };


  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Impostazioni</h1>
          <p className="text-muted-foreground">Gestisci il tuo account</p>
        </div>

        <div className="glass rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-medium">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold">Account</h2>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Informazioni Account
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">ID Utente</span>
                <span className="font-mono text-sm text-muted-foreground">{user?.id?.slice(0, 8)}...</span>
              </div>
            </div>
          </div>

          {/* Import/Export Section */}
          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import / Export Dati
            </h3>
            
            <div className="space-y-4">
              {/* Import from Spendy Desktop */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Importa dati esportati da Spendy Desktop.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSpendyDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Importa da Spendy Desktop
                </Button>
                {user && (
                  <SpendyImportDialog
                    open={spendyDialogOpen}
                    onOpenChange={setSpendyDialogOpen}
                    userId={user.id}
                  />
                )}
              </div>

              {/* Import from Banks */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Importa transazioni dalla tua banca.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRevolutDialogOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Revolut
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setTradeRepublicDialogOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Trade Republic
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setBbvaDialogOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    BBVA
                  </Button>
                </div>
                {user && (
                  <>
                    <RevolutImportDialog
                      open={revolutDialogOpen}
                      onOpenChange={setRevolutDialogOpen}
                      userId={user.id}
                    />
                    <BBVAImportDialog
                      open={bbvaDialogOpen}
                      onOpenChange={setBbvaDialogOpen}
                      userId={user.id}
                    />
                    <TradeRepublicImportDialog
                      open={tradeRepublicDialogOpen}
                      onOpenChange={setTradeRepublicDialogOpen}
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

              {/* Import Investimenti CSV */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Importa i tuoi investimenti da un file CSV con colonne italiane.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setInvestimentiDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Importa Investimenti CSV
                </Button>
                {user && (
                  <InvestimentiImportDialog
                    open={investimentiDialogOpen}
                    onOpenChange={setInvestimentiDialogOpen}
                    userId={user.id}
                  />
                )}
              </div>

              {/* ISIN Mappings Management */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Gestisci i mapping ISIN per gli investimenti importati.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsinMappingsDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Settings2 className="w-5 h-5 mr-2" />
                  Gestisci Mapping ISIN
                </Button>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Esporta tutti i tuoi dati in un file.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => exportData('xlsx')}
                    disabled={isExporting}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {isExporting ? 'Esportazione...' : 'Esporta Excel'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => exportData('csv')}
                    disabled={isExporting}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {isExporting ? 'Esportazione...' : 'Esporta CSV'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-border pt-6 space-y-4">
            <h3 className="font-medium text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Zona Pericolo
            </h3>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                onClick={signOut}
                className="w-full sm:w-auto"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Esci dall'account
              </Button>

              {/* Delete User Data (keep account) */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Elimina i miei dati
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare tutti i dati?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione eliminerà tutte le tue transazioni, categorie, budget, obiettivi di risparmio e investimenti. Il tuo account rimarrà attivo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          // Delete all user data in order (respecting foreign keys)
                          await supabase.from('asset_price_history').delete().eq('user_id', user!.id);
                          await supabase.from('budgets').delete().eq('user_id', user!.id);
                          await supabase.from('transactions').delete().eq('user_id', user!.id);
                          await supabase.from('categories').delete().eq('user_id', user!.id);
                          await supabase.from('savings_goals').delete().eq('user_id', user!.id);
                          await supabase.from('portfolio_assets').delete().eq('user_id', user!.id);

                          toast({ 
                            title: 'Dati eliminati', 
                            description: 'Tutti i tuoi dati sono stati eliminati. Il tuo account è ancora attivo.' 
                          });
                        } catch (error) {
                          console.error('Delete data error:', error);
                          toast({ 
                            title: 'Errore', 
                            description: 'Impossibile eliminare i dati', 
                            variant: 'destructive' 
                          });
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? 'Eliminazione...' : 'Elimina tutti i dati'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete Account completely */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Elimina account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione è irreversibile. Tutti i tuoi dati verranno eliminati permanentemente, incluse transazioni, budget, obiettivi e portfolio. L'account verrà chiuso.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) {
                            toast({ title: 'Errore', description: 'Sessione non valida', variant: 'destructive' });
                            return;
                          }

                          const response = await supabase.functions.invoke('delete-account');

                          if (response.error) {
                            throw response.error;
                          }

                          toast({ title: 'Account eliminato', description: 'Il tuo account è stato eliminato con successo' });
                          await signOut();
                          navigate('/auth');
                        } catch (error) {
                          console.error('Delete account error:', error);
                          toast({ title: 'Errore', description: 'Impossibile eliminare l\'account', variant: 'destructive' });
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? 'Eliminazione...' : 'Elimina definitivamente'}
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
