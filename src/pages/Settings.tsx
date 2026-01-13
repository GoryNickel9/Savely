import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, User, Download, Upload, FileSpreadsheet, Trash2, Settings2, Edit2, FolderPlus, Folder, FolderPen, Check, X } from 'lucide-react';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { passwordSchema, confirmPasswordSchema, checkPasswordRequirements, passwordRequirementsList } from '@/lib/passwordValidation';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx';
import SpendyImportDialog from '@/components/settings/SpendyImportDialog';
import RevolutImportDialog from '@/components/settings/RevolutImportDialog';
import BBVAImportDialog from '@/components/settings/BBVAImportDialog';
import TradeRepublicImportDialog from '@/components/settings/TradeRepublicImportDialog';
import ISINMappingsDialog from '@/components/settings/ISINMappingsDialog';
import { TransactionType } from '@/lib/types';
import { EMOJI_OPTIONS, COLOR_OPTIONS } from '@/lib/constants';

export default function Settings() {
  const { user, signOut, updateEmail, updatePassword } = useAuth();
  const { categories, createCategory, updateCategory } = useCategories();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Account edit dialog state
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Import/Export dialog state
  const [importExportDialogOpen, setImportExportDialogOpen] = useState(false);
  
  // Category management state
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [categoryEditOpen, setCategoryEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('📦');
  const [editCatColor, setEditCatColor] = useState('#6b7280');
  const [editCatType, setEditCatType] = useState<TransactionType>('expense');
  
  // New category dialog state
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [newCatColor, setNewCatColor] = useState('#6b7280');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
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

  const parseItalianNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const str = String(value).trim();
    // Remove dots (thousands separator) and replace comma with dot (decimal separator)
    const normalized = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
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
            amount: parseItalianNumber(row.amount),
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
            quantity: parseItalianNumber(row.quantity),
            purchase_price: parseItalianNumber(row.purchase_price),
            current_price: row.current_price ? parseItalianNumber(row.current_price) : null,
            symbol: row.symbol ? String(row.symbol) : null,
            purchase_date: String(row.purchase_date || new Date().toISOString().split('T')[0]),
          });
          if (!error) importedCount++;
        }
      }

      // Import investments from CSV
      if (wb.SheetNames.includes('Investimenti')) {
        const ws = wb.Sheets['Investimenti'];
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        
        for (const row of rows) {
          const ticker = String(row.ticker || '');
          const investito = parseItalianNumber(row.investito);
          const valoreAttuale = parseItalianNumber(row.valore_attuale);
          const prezzoCarico = parseItalianNumber(row.prezzo_carico);
          const dataVendita = row.data_vendita ? String(row.data_vendita) : null;
          const prezzoVendita = row.prezzo_vendita ? parseItalianNumber(row.prezzo_vendita) : null;

          // Determine asset type based on ticker
          let assetType: 'stock' | 'etf' | 'crypto' | 'bond' | 'cash' | 'real_estate' | 'other' = 'stock';
          if (ticker.includes('-EUR') || ticker.includes('BTC') || ticker.includes('ETH')) {
            assetType = 'crypto';
          } else if (ticker.includes('.MI') || ticker.includes('.L') || ticker.includes('.PA')) {
            assetType = 'stock';
          } else if (ticker.includes('ETF') || ticker.includes('IE00')) {
            assetType = 'etf';
          }

          const { error } = await supabase.from('portfolio_assets').insert({
            user_id: user.id,
            name: ticker,
            type: assetType,
            quantity: investito,
            purchase_price: prezzoCarico,
            current_price: valoreAttuale,
            symbol: ticker,
            purchase_date: String(row.data || new Date().toISOString().split('T')[0]),
          });
          if (!error) importedCount++;

          // If sold, create a sell transaction
          if (dataVendita && prezzoVendita) {
            const { error: sellError } = await supabase.from('transactions').insert({
              user_id: user.id,
              amount: prezzoVendita * investito,
              type: 'income',
              description: `Vendita ${ticker}`,
              date: dataVendita,
              currency: 'EUR',
            });
            if (!sellError) importedCount++;
          }
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

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    
    try {
      // Always require current password for security
      if (!currentPassword) {
        throw new Error('Inserisci la password attuale per confermare le modifiche');
      }
      
      // Update email if changed
      if (newEmail && newEmail !== user?.email) {
        const { error } = await updateEmail(newEmail);
        if (error) throw error;
        toast({ title: 'Email aggiornata con successo' });
      }
      
      // Update password if provided
      if (newPassword) {
        // Validate password using the new schema
        try {
          passwordSchema.parse(newPassword);
        } catch (error: any) {
          throw new Error(error.errors?.[0]?.message || 'La password non soddisfa i requisiti di sicurezza');
        }
        
        if (newPassword !== confirmPassword) {
          throw new Error('Le password non coincidono');
        }
        if (newPassword === currentPassword) {
          throw new Error('La nuova password non può essere uguale a quella attuale');
        }
        const { error } = await updatePassword(newPassword);
        if (error) throw error;
        toast({ title: 'Password aggiornata con successo' });
      }
      
      setAccountEditOpen(false);
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile aggiornare le credenziali',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openCategoryEdit = (category: any) => {
    setEditingCategory(category.id);
    setEditCatName(category.name);
    setEditCatIcon(category.icon);
    setEditCatColor(category.color);
    setEditCatType(category.type);
    setCategoryEditOpen(true);
  };

  const handleCategoryUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatName.trim() || !editingCategory) return;
    try {
      await updateCategory.mutateAsync({
        id: editingCategory,
        name: editCatName.trim(),
        icon: editCatIcon,
        color: editCatColor,
        type: editCatType
      });
      toast({ title: 'Categoria aggiornata!' });
      setCategoryEditOpen(false);
      setEditingCategory(null);
      setEditCatName('');
      setEditCatIcon('📦');
      setEditCatColor('#6b7280');
      setEditCatType('expense');
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await createCategory.mutateAsync({
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
        type: newCatType
      });
      toast({ title: 'Categoria creata!' });
      setNewCatOpen(false);
      setNewCatName('');
      setNewCatIcon('📦');
      setNewCatColor('#6b7280');
      setNewCatType('expense');
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utente';

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
              Informazioni Account
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{userName}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
            </div>
            <div className="mt-4">
              <Dialog open={accountEditOpen} onOpenChange={setAccountEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Modifica credenziali
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modifica credenziali</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAccountUpdate} className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Password attuale</label>
                      <Input
                        type="password"
                        placeholder="Inserisci la password attuale per confermare"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Nuova email</label>
                      <Input
                        type="email"
                        placeholder="nuova@email.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Nuova password</label>
                      <Input
                        type="password"
                        placeholder="Lascia vuoto per non cambiare"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      
                      {/* Password Requirements Indicator */}
                      {newPassword && (
                        <div className="mt-3 space-y-2 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium mb-2">Requisiti password:</p>
                          {passwordRequirementsList.map((req) => {
                            const isMet = checkPasswordRequirements(newPassword)[req.key];
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
                    {newPassword && (
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Conferma nuova password</label>
                        <Input
                          type="password"
                          placeholder="Conferma la nuova password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isUpdating}>
                      {isUpdating ? 'Aggiornamento...' : 'Aggiorna'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Import/Export Section */}
          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import / Export Dati
            </h3>
            
            <Dialog open={importExportDialogOpen} onOpenChange={setImportExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Gestisci Import / Export
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import / Export Dati</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
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
              </DialogContent>
            </Dialog>
          </div>

          {/* Categories Section */}
          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Folder className="w-5 h-5" />
              Gestione Categorie
            </h3>
            
            <div className="flex flex-wrap gap-2">
              <Dialog open={categoriesDialogOpen} onOpenChange={setCategoriesDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <FolderPen className="w-4 h-4 mr-2" />
                    Gestisci Categorie
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Gestisci Categorie</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Modifica le tue categorie, le loro emoji e i colori.
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      {categories.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">Nessuna categoria</div>
                      ) : (
                        categories.map(category => (
                          <div key={category.id} className="glass rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{category.icon}</span>
                              <div>
                                <div className="font-medium">{category.name}</div>
                                <div className="text-sm text-muted-foreground">{category.type === 'expense' ? 'Spesa' : 'Entrata'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded-full border-2"
                                style={{ backgroundColor: category.color, borderColor: category.color }}
                              />
                              <Button variant="ghost" size="icon" onClick={() => openCategoryEdit(category)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Nuova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuova Categoria</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateCategory} className="space-y-4">
                    <Input placeholder="Nome categoria" value={newCatName} onChange={e => setNewCatName(e.target.value)} required />
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Icona</label>
                      <div className="flex flex-wrap gap-2">
                        {EMOJI_OPTIONS.map(emoji => (
                          <button
                            type="button"
                            key={emoji}
                            onClick={() => setNewCatIcon(emoji)}
                            className={`w-10 h-10 text-xl rounded-lg border transition-all ${newCatIcon === emoji ? 'border-primary bg-primary/20' : 'border-border hover:border-primary/50'}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Colore</label>
                      <div className="flex flex-wrap gap-2">
                        {COLOR_OPTIONS.map(color => (
                          <button
                            type="button"
                            key={color}
                            onClick={() => setNewCatColor(color)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${newCatColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <Select value={newCatType} onValueChange={(v) => setNewCatType(v as TransactionType)}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Spesa</SelectItem>
                        <SelectItem value="income">Entrata</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="submit" className="w-full" disabled={createCategory.isPending}>
                      {createCategory.isPending ? 'Creazione...' : 'Crea Categoria'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Category Edit Dialog */}
          <Dialog open={categoryEditOpen} onOpenChange={setCategoryEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifica Categoria</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCategoryUpdate} className="space-y-4">
                <Input placeholder="Nome categoria" value={editCatName} onChange={e => setEditCatName(e.target.value)} required />
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Icona</label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => setEditCatIcon(emoji)}
                        className={`w-10 h-10 text-xl rounded-lg border transition-all ${editCatIcon === emoji ? 'border-primary bg-primary/20' : 'border-border hover:border-primary/50'}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Colore</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map(color => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setEditCatColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${editCatColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={updateCategory.isPending}>
                  {updateCategory.isPending ? 'Aggiornamento...' : 'Aggiorna Categoria'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

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
