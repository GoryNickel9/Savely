import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, User, Download, Upload, FileSpreadsheet, Trash2, Settings2, Edit2, FolderPlus, Folder, FolderPen, Check, X, ShieldCheck, FileText } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
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
import SpendyImportDialog from '@/components/settings/SpendyImportDialog';
import RevolutImportDialog from '@/components/settings/RevolutImportDialog';
import BankImportDialog from '@/components/settings/BankImportDialog';
import ISINMappingsDialog from '@/components/settings/ISINMappingsDialog';
import CoupleSettingsSection from '@/components/settings/CoupleSettingsSection';
import SecuritySection from '@/components/settings/SecuritySection';
import { Category, TransactionType, CurrencyCode } from '@/lib/types';
import { EMOJI_OPTIONS, COLOR_OPTIONS, CURRENCY_SYMBOLS } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { serializeCsvRows } from '@/lib/csv';

export default function Settings() {
  const { user, signOut, updateEmail, updatePassword } = useAuth();
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories();
  const { defaultCurrency, updateDefaultCurrency } = useProfile();
  const { permissions } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [spendyDialogOpen, setSpendyDialogOpen] = useState(false);
  const [revolutDialogOpen, setRevolutDialogOpen] = useState(false);
  const [bankImportDialogOpen, setBankImportDialogOpen] = useState(false);
  const [isinMappingsDialogOpen, setIsinMappingsDialogOpen] = useState(false);
  
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
  const [categoryDeleteOpen, setCategoryDeleteOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  
  // New category dialog state
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [newCatColor, setNewCatColor] = useState('#6b7280');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const exportData = async () => {
    if (!user) return;
    setIsExporting(true);

    try {
      // Fetch all data — include every user-scoped table for GDPR portability (art. 20).
      // Tabelle non presenti nei tipi generati vengono interrogate con cast `any`.
      const tables = [
        'transactions',
        'categories',
        'budgets',
        'savings_goals',
        'portfolio_assets',
        'asset_price_history',
        'recurring_expenses',
        'category_mappings',
        'isin_mappings',
        'manual_price_updates',
        'poker_manual_expenses',
        'poker_monthly_expenses',
        'poker_next_cut',
        'poker_hourly_earnings',
        'poker_rakeback',
        'liquido_sigaretta',
        'cbd',
        'thc',
        'tgc_cards',
        'library_items',
        'couple_connection_requests',
        'couple_connections',
        'couple_budgets',
        'shared_expenses',
      ] as const;

      const results = await Promise.all(
        tables.map((t) =>
          (supabase.from(t as unknown as keyof typeof supabase) as unknown as { select: (q: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> })
            .select('*')
            .then((res) => ({ table: t, ...res }))
            // Tabelle non ancora create nel DB o senza RLS tornerebbero errore:
            // le ignoriamo per non bloccare l'export delle altre.
            .catch((err) => ({ table: t, data: null, error: { message: String(err) } }))
        )
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
        toast({
          title: 'Nessun dato',
          description: 'Non ci sono dati da esportare',
          variant: 'destructive',
        });
        return;
      }

      const filename = `spendy_export_${new Date().toISOString().split('T')[0]}.csv`;
      const csvContent = serializeCsvRows(rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, filename);

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
        } catch (error: unknown) {
          throw new Error((error as { errors?: Array<{ message: string }> }).errors?.[0]?.message || 'La password non soddisfa i requisiti di sicurezza');
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
    } catch (error: unknown) {
      toast({
        title: 'Errore',
        description: (error as Error).message || 'Impossibile aggiornare le credenziali',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openCategoryEdit = (category: Category) => {
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

  const handleCategoryDelete = async () => {
    if (!deletingCategory) return;
    try {
      await deleteCategory.mutateAsync(deletingCategory);
      toast({ title: 'Categoria eliminata!' });
      setCategoryDeleteOpen(false);
      setDeletingCategory(null);
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const openCategoryDelete = (category: Category) => {
    setDeletingCategory(category.id);
    setCategoryDeleteOpen(true);
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
                        autoComplete="current-password"
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
                        autoComplete="new-password"
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
                          autoComplete="new-password"
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

          {/* Main Currency Section */}
          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Valuta Principale
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Le transazioni vengono visualizzate in questa valuta. Il controvalore viene calcolato al cambio del momento dell'inserimento.
            </p>
            <Select
              value={defaultCurrency}
              onValueChange={async (v) => {
                try {
                  await updateDefaultCurrency.mutateAsync(v as CurrencyCode);
                  toast({ title: 'Valuta principale aggiornata!' });
                } catch {
                  toast({ title: 'Errore', variant: 'destructive' });
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[]).map(code => (
                  <SelectItem key={code} value={code}>
                    {code} — {CURRENCY_SYMBOLS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      Importa dati esportati da{' '}
                      <a 
                        href="https://drive.proton.me/urls/BAP9T2DZ4R#xeUPYTXklGaD" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Spendy Desktop
                      </a>
                      .
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
                      Importa transazioni dalla tua banca.{' '}
                      Non hai file CSV?{' '}
                      <a
                        href="https://bank2-csv-khaki.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Clicca qui.
                      </a>
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
                        onClick={() => setBankImportDialogOpen(true)}
                        className="w-full sm:w-auto"
                      >
                        <Upload className="w-5 h-5 mr-2" />
                        BBVA / Trade Republic
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
                        onClick={() => exportData()}
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
                        Modifica o elimina le tue categorie, le loro emoji e i colori.
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
                              <Button variant="ghost" size="icon" onClick={() => openCategoryDelete(category)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" />
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

          {/* Category Delete Confirmation Dialog */}
          <AlertDialog open={categoryDeleteOpen} onOpenChange={setCategoryDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare la categoria?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione eliminerà la categoria. Le transazioni associate non verranno eliminate ma non avranno più una categoria assegnata.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCategoryDelete}
                  disabled={deleteCategory.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteCategory.isPending ? 'Eliminazione...' : 'Elimina'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Couple Expenses Section */}
          {permissions?.couple_expenses && <CoupleSettingsSection />}

          {/* Security: 2FA + login activity + sessions */}
          <SecuritySection />

          {/* Privacy & Data (GDPR) */}
          <div className="border-t border-border pt-6 space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Privacy e Dati
            </h3>
            <p className="text-sm text-muted-foreground">
              In conformityà al Regolamento (UE) 2016/679 (GDPR), hai diritto di accedere, rettificare, cancellare,
              esportare (portabilità) e opporti al trattamento dei tuoi dati personali.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setImportExportDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Esporta tutti i miei dati
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/privacy">
                  <FileText className="w-4 h-4 mr-2" />
                  Privacy Policy
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Per richieste relative ai tuoi dati scrivi a{' '}
              <a href="mailto:[EMAIL RIMOSSA]" className="text-primary hover:underline">
                [EMAIL RIMOSSA]
              </a>
              . Per cancellare definitivamente il tuo account, vedi la sezione "Zona Pericolo" sottostante.
            </p>
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
