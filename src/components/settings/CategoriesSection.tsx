import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, FolderPen, FolderPlus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { Category, TransactionType } from '@/lib/types';
import { EMOJI_OPTIONS, COLOR_OPTIONS } from '@/lib/constants';

/**
 * Sezione "Gestione Categorie" di Settings: dialog di gestione, creazione,
 * modifica ed eliminazione (soft) delle categorie.
 * Estratta da Settings.tsx (TD-006).
 */
export default function CategoriesSection() {
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories();
  const { t } = useTranslation();

  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [categoryEditOpen, setCategoryEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('📦');
  const [editCatColor, setEditCatColor] = useState('#6b7280');
  const [editCatType, setEditCatType] = useState<TransactionType>('expense');
  const [categoryDeleteOpen, setCategoryDeleteOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [newCatColor, setNewCatColor] = useState('#6b7280');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');

  const openCategoryEdit = (category: Category) => {
    setEditingCategory(category.id);
    setEditCatName(category.name);
    setEditCatIcon(category.icon);
    setEditCatColor(category.color);
    setEditCatType(category.type);
    setCategoryEditOpen(true);
  };

  const openCategoryDelete = (category: Category) => {
    setDeletingCategory(category.id);
    setCategoryDeleteOpen(true);
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
      toast(t('Categoria creata!'));
      setNewCatOpen(false);
      setNewCatName('');
      setNewCatIcon('📦');
      setNewCatColor('#6b7280');
      setNewCatType('expense');
    } catch {
      toast.error(t('Errore'));
    }
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
      toast(t('Categoria aggiornata!'));
      setCategoryEditOpen(false);
      setEditingCategory(null);
      setEditCatName('');
      setEditCatIcon('📦');
      setEditCatColor('#6b7280');
      setEditCatType('expense');
    } catch {
      toast.error(t('Errore'));
    }
  };

  const handleCategoryDelete = async () => {
    if (!deletingCategory) return;
    try {
      await deleteCategory.mutateAsync(deletingCategory);
      toast(t('Categoria eliminata!'));
      setCategoryDeleteOpen(false);
      setDeletingCategory(null);
    } catch {
      toast.error(t('Errore'));
    }
  };

  return (
    <>
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
            <DialogContent className="max-w-2xl">
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
    </>
  );
}
