import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MainLayout from '@/components/layout/MainLayout';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TransactionType, Category } from '@/lib/types';
import { Plus, Edit2, Trash2, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { EMOJI_OPTIONS, COLOR_OPTIONS } from '@/lib/constants';

export default function Categories() {
  const { t } = useTranslation();
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories();
  
  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#6b7280');
  const [catType, setCatType] = useState<TransactionType>('expense');

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('📦');
  const [editColor, setEditColor] = useState('#6b7280');
  const [editType, setEditType] = useState<TransactionType>('expense');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await createCategory.mutateAsync({ name: catName.trim(), icon: catIcon, color: catColor, type: catType });
      toast(t('Categoria creata!'));
      setCreateOpen(false);
      setCatName('');
      setCatIcon('📦');
      setCatColor('#6b7280');
      setCatType('expense');
    } catch {
      toast.error(t('Errore'));
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editingCategory) return;
    try {
      await updateCategory.mutateAsync({ 
        id: editingCategory, 
        name: editName.trim(), 
        icon: editIcon, 
        color: editColor, 
        type: editType 
      });
      toast(t('Categoria aggiornata!'));
      setEditOpen(false);
      setEditingCategory(null);
      setEditName('');
      setEditIcon('📦');
      setEditColor('#6b7280');
      setEditType('expense');
    } catch {
      toast.error(t('Errore'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('Sei sicuro di voler eliminare questa categoria?'))) return;
    try {
      await deleteCategory.mutateAsync(id);
      toast(t('Categoria eliminata!'));
    } catch {
      toast.error(t('Errore'));
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category.id);
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditColor(category.color);
    setEditType(category.type);
    setEditOpen(true);
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">{t('Categorie')}</h1>
            <p className="text-muted-foreground">{t('Gestisci le tue categorie')}</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><FolderPlus className="w-4 h-4 mr-2" />{t('Nuova Categoria')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('Nuova Categoria')}</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <Input placeholder={t('Nome categoria')} value={catName} onChange={e => setCatName(e.target.value)} required />
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">{t('Icona')}</label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => setCatIcon(emoji)}
                        className={`w-10 h-10 text-xl rounded-lg border transition-all ${catIcon === emoji ? 'border-primary bg-primary/20' : 'border-border hover:border-primary/50'}`}
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
                        onClick={() => setCatColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${catColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <Select value={catType} onValueChange={(v) => setCatType(v as TransactionType)}>
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

        <div className="space-y-8">
          {/* Expense Categories */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-red-500">●</span> {t('Spese')}
            </h2>
            <div className="grid gap-3">
              {expenseCategories.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">{t('Nessuna categoria di spesa')}</div>
              ) : (
                expenseCategories.map(category => (
                  <div key={category.id} className="glass rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{category.icon}</span>
                      <div>
                        <div className="font-medium">{category.name}</div>
                        <div className="text-sm text-muted-foreground">{category.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border-2"
                        style={{ backgroundColor: category.color, borderColor: category.color }}
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Income Categories */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-green-500">●</span> {t('Entrate')}
            </h2>
            <div className="grid gap-3">
              {incomeCategories.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">{t('Nessuna categoria di entrata')}</div>
              ) : (
                incomeCategories.map(category => (
                  <div key={category.id} className="glass rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{category.icon}</span>
                      <div>
                        <div className="font-medium">{category.name}</div>
                        <div className="text-sm text-muted-foreground">{category.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border-2"
                        style={{ backgroundColor: category.color, borderColor: category.color }}
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('Modifica Categoria')}</DialogTitle></DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <Input placeholder={t('Nome categoria')} value={editName} onChange={e => setEditName(e.target.value)} required />
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">{t('Icona')}</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setEditIcon(emoji)}
                      className={`w-10 h-10 text-xl rounded-lg border transition-all ${editIcon === emoji ? 'border-primary bg-primary/20' : 'border-border hover:border-primary/50'}`}
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
                      onClick={() => setEditColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${editColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <Select value={editType} onValueChange={(v) => setEditType(v as TransactionType)}>
                <SelectTrigger><SelectValue placeholder={t('Tipo')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t('Spesa')}</SelectItem>
                  <SelectItem value="income">{t('Entrata')}</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={updateCategory.isPending}>
                {updateCategory.isPending ? t('Aggiornamento...') : t('Aggiorna Categoria')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}