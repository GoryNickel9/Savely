import MainLayout from '@/components/layout/MainLayout';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, User, Download, Upload, FileSpreadsheet, Trash2, Settings2, Edit2, FolderPlus, Folder, FolderPen, Check, X, ShieldCheck, FileText, Languages } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router';
import { Link } from 'react-router';
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
import RevolutImportDialog from '@/components/settings/RevolutImportDialog';
import BankImportDialog from '@/components/settings/BankImportDialog';
import ISINMappingsDialog from '@/components/settings/ISINMappingsDialog';
import CoupleSettingsSection from '@/components/settings/CoupleSettingsSection';
import SecuritySection from '@/components/settings/SecuritySection';
import { Category, TransactionType, CurrencyCode } from '@/lib/types';
import { EMOJI_OPTIONS, COLOR_OPTIONS, CURRENCY_SYMBOLS, USER_TABLES } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { serializeCsvRows } from '@/lib/csv';
import { SUPPORTED_LANGUAGES, changeLanguage, type LanguageCode } from '@/i18n';

export default function Settings() {
  const { user, signOut, updateEmail, updatePassword } = useAuth();
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories();
  const { defaultCurrency, updateDefaultCurrency, updateLanguage } = useProfile();
  const { permissions } = usePermissions();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
        toast({
          title: t('Nessun dato'),
          description: t('Non ci sono dati da esportare'),
          variant: 'destructive',
        });
        return;
      }

      const filename = `savely_export_${new Date().toISOString().split('T')[0]}.csv`;
      const csvContent = serializeCsvRows(rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, filename);

      toast({
        title: t('Export completato'),
        description: t('Dati esportati in {{filename}}', { filename }),
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: t('Errore export'),
        description: t('Si è verificato un errore durante l\'export'),
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
        throw new Error(t('Inserisci la password attuale per confermare le modifiche'));
      }

      // Update email if changed
      if (newEmail && newEmail !== user?.email) {
        const { error } = await updateEmail(newEmail);
        if (error) throw error;
        toast({ title: t('Email aggiornata con successo') });
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
        toast({ title: t('Password aggiornata con successo') });
      }
      
      setAccountEditOpen(false);
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      toast({
        title: t('Errore'),
        description: (error as Error).message || t('Impossibile aggiornare le credenziali'),
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
      toast({ title: t('Categoria aggiornata!') });
      setCategoryEditOpen(false);
      setEditingCategory(null);
      setEditCatName('');
      setEditCatIcon('📦');
      setEditCatColor('#6b7280');
      setEditCatType('expense');
    } catch {
      toast({ title: t('Errore'), variant: 'destructive' });
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
      toast({ title: t('Categoria creata!') });
      setNewCatOpen(false);
      setNewCatName('');
      setNewCatIcon('📦');
      setNewCatColor('#6b7280');
      setNewCatType('expense');
    } catch {
      toast({ title: t('Errore'), variant: 'destructive' });
    }
  };

  const handleCategoryDelete = async () => {
    if (!deletingCategory) return;
    try {
      await deleteCategory.mutateAsync(deletingCategory);
      toast({ title: t('Categoria eliminata!') });
      setCategoryDeleteOpen(false);
      setDeletingCategory(null);
    } catch {
      toast({ title: t('Errore'), variant: 'destructive' });
    }
  };

  const openCategoryDelete = (category: Category) => {
    setDeletingCategory(category.id);
    setCategoryDeleteOpen(true);
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('Utente');

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('Impostazioni')}</h1>
          <p className="text-muted-foreground">{t('Gestisci il tuo account')}</p>
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
                                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <X className="w-4 h-4 text-red-500 flex-shrink-0" />
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

          {/* Main Currency Section */}
          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              {t('Valuta Principale')}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {t('Le transazioni vengono visualizzate in questa valuta. Il controvalore viene calcolato al cambio del momento dell\'inserimento.')}
            </p>
            <Select
              value={defaultCurrency}
              onValueChange={async (v) => {
                try {
                  await updateDefaultCurrency.mutateAsync(v as CurrencyCode);
                  toast({ title: t('Valuta principale aggiornata!') });
                } catch {
                  toast({ title: t('Errore'), variant: 'destructive' });
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

          {/* Language Section */}
          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Languages className="w-5 h-5" />
              {t('Lingua')}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {t('La lingua dell\'interfaccia. La preferenza è salvata sul tuo account e applicata automaticamente su tutti i dispositivi.')}
            </p>
            <Select
              value={i18n.language}
              onValueChange={async (v) => {
                changeLanguage(v as LanguageCode);
                try {
                  await updateLanguage.mutateAsync(v as LanguageCode);
                  toast({ title: t('Lingua aggiornata!') });
                } catch {
                  toast({ title: t('Errore'), variant: 'destructive' });
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.flag} {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Import/Export Section */}
          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {t('Import / Export Dati')}
            </h3>

            <Dialog open={importExportDialogOpen} onOpenChange={setImportExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  {t('Gestisci Import / Export')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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

          {/* Categories Section */}
          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Folder className="w-5 h-5" />
              {t('Gestione Categorie')}
            </h3>

            <div className="flex flex-wrap gap-2">
              <Dialog open={categoriesDialogOpen} onOpenChange={setCategoriesDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <FolderPen className="w-4 h-4 mr-2" />
                    {t('Gestisci Categorie')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t('Gestisci Categorie')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('Modifica o elimina le tue categorie, le loro emoji e i colori.')}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {categories.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">{t('Nessuna categoria')}</div>
                      ) : (
                        categories.map(category => (
                          <div key={category.id} className="glass rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{category.icon}</span>
                              <div>
                                <div className="font-medium">{category.name}</div>
                                <div className="text-sm text-muted-foreground">{category.type === 'expense' ? t('Spesa') : t('Entrata')}</div>
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
                    {t('Nuova Categoria')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('Nuova Categoria')}</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateCategory} className="space-y-4">
                    <Input placeholder={t('Nome categoria')} value={newCatName} onChange={e => setNewCatName(e.target.value)} required />
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">{t('Icona')}</label>
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
                      <label className="text-sm text-muted-foreground mb-2 block">{t('Colore')}</label>
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
                      <SelectTrigger><SelectValue placeholder={t('Tipo')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">{t('Spesa')}</SelectItem>
                        <SelectItem value="income">{t('Entrata')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="submit" className="w-full" disabled={createCategory.isPending}>
                      {createCategory.isPending ? t('Creazione...') : t('Crea Categoria')}
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
                <DialogTitle>{t('Modifica Categoria')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCategoryUpdate} className="space-y-4">
                <Input placeholder={t('Nome categoria')} value={editCatName} onChange={e => setEditCatName(e.target.value)} required />
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t('Icona')}</label>
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
                  <label className="text-sm text-muted-foreground mb-2 block">{t('Colore')}</label>
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
                  {updateCategory.isPending ? t('Aggiornamento...') : t('Aggiorna Categoria')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Category Delete Confirmation Dialog */}
          <AlertDialog open={categoryDeleteOpen} onOpenChange={setCategoryDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('Eliminare la categoria?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('Questa azione eliminerà la categoria. Le transazioni associate non verranno eliminate ma non avranno più una categoria assegnata.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Annulla')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCategoryDelete}
                  disabled={deleteCategory.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteCategory.isPending ? t('Eliminazione...') : t('Elimina')}
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
                            toast({ title: t('Errore'), description: t('Sessione non valida'), variant: 'destructive' });
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

                          toast({ title: t('Account eliminato'), description: t('Il tuo account è stato eliminato con successo') });
                          await signOut();
                          navigate('/auth');
                        } catch (error) {
                          console.error('Delete account error:', error);
                          toast({ title: t('Errore'), description: t('Impossibile eliminare l\'account'), variant: 'destructive' });
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
