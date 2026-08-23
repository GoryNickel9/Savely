import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import MainLayout from '@/components/layout/MainLayout';
import { useLibraryItems } from '@/hooks/useLibraryItems';
import { LibraryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Search, Loader2, Pencil, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { parseAmount } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const VOLUME_RANGE_RE = /^(\d+)\s*[-–]\s*(\d+)$/;

function parseVolumeRange(s: string): number[] | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const rangeMatch = VOLUME_RANGE_RE.exec(trimmed);
  if (rangeMatch) {
    const from = Number.parseInt(rangeMatch[1], 10);
    const to = Number.parseInt(rangeMatch[2], 10);
    if (from > 0 && to >= from && (to - from) < 100) {
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    }
    return null;
  }
  const single = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(single) && single > 0) return [single];
  return null;
}

export default function LibreriaManga() {
  const { t } = useTranslation();
  const { items, isLoading, createItem, updateItem, deleteItem, totalCost, totalReselling, totalGain } = useLibraryItems('manga');

  const [filterText, setFilterText] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterPublisher, setFilterPublisher] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [volumeRange, setVolumeRange] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [resellingValue, setResellingValue] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editPublisher, setEditPublisher] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editResellingValue, setEditResellingValue] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editNotes, setEditNotes] = useState('');

  const uniqueAuthors = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => { if (i.author) s.add(i.author); });
    return Array.from(s).sort();
  }, [items]);

  const uniquePublishers = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => { if (i.publisher) s.add(i.publisher); });
    return Array.from(s).sort();
  }, [items]);

  const uniqueYears = useMemo(() => {
    const s = new Set<number>();
    items.forEach((i) => { if (i.year) s.add(i.year); });
    return Array.from(s).sort((a, b) => b - a);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (filterText && !i.title.toLowerCase().includes(filterText.toLowerCase())) return false;
      if (filterAuthor !== 'all' && i.author !== filterAuthor) return false;
      if (filterPublisher !== 'all' && i.publisher !== filterPublisher) return false;
      if (filterYear !== 'all' && String(i.year) !== filterYear) return false;
      return true;
    });
  }, [items, filterText, filterAuthor, filterPublisher, filterYear]);

  const volumes = parseVolumeRange(volumeRange);
  const parsedYear = year.trim() ? Number.parseInt(year.trim(), 10) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      if (volumes) {
        for (const vol of volumes) {
          await createItem.mutateAsync({
            category: 'manga',
            title: `${title.trim()} Vol. ${vol}`,
            author: author.trim() || undefined,
            publisher: publisher.trim() || undefined,
            year: parsedYear,
            cover_image: coverImageUrl.trim() || undefined,
            purchase_price: purchasePrice ? parseAmount(purchasePrice) : undefined,
            reselling_value: resellingValue ? parseAmount(resellingValue) : undefined,
            quantity: 1,
            notes: notes.trim() || undefined,
          });
        }
        toast(volumes.length > 1 ? t('{{count}} volumi aggiunti!', { count: volumes.length }) : t('Volume aggiunto!'));
      } else {
        await createItem.mutateAsync({
          category: 'manga',
          title: title.trim(),
          author: author.trim() || undefined,
          publisher: publisher.trim() || undefined,
          year: parsedYear,
          cover_image: coverImageUrl.trim() || undefined,
          purchase_price: purchasePrice ? parseAmount(purchasePrice) : undefined,
          reselling_value: resellingValue ? parseAmount(resellingValue) : undefined,
          quantity: Number.parseInt(quantity, 10) || 1,
          notes: notes.trim() || undefined,
        });
        toast(t('Manga aggiunto!'));
      }
      resetAddDialog();
    } catch {
      toast.error(t('Errore'));
    }
  };

  const resetAddDialog = () => {
    setOpen(false);
    setTitle('');
    setAuthor('');
    setPublisher('');
    setYear('');
    setCoverImageUrl('');
    setVolumeRange('');
    setPurchasePrice('');
    setResellingValue('');
    setQuantity('1');
    setNotes('');
  };

  const openEdit = (item: LibraryItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditAuthor(item.author ?? '');
    setEditPublisher(item.publisher ?? '');
    setEditYear(item.year != null ? String(item.year) : '');
    setEditCoverImage(item.cover_image ?? '');
    setEditPurchasePrice(item.purchase_price != null ? String(item.purchase_price) : '');
    setEditResellingValue(item.reselling_value != null ? String(item.reselling_value) : '');
    setEditQuantity(String(item.quantity));
    setEditNotes(item.notes ?? '');
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await updateItem.mutateAsync({
        id: editingItem.id,
        title: editTitle.trim() || editingItem.title,
        author: editAuthor.trim() || undefined,
        publisher: editPublisher.trim() || undefined,
        year: editYear.trim() ? Number.parseInt(editYear.trim(), 10) : undefined,
        cover_image: editCoverImage.trim() || undefined,
        purchase_price: editPurchasePrice ? parseAmount(editPurchasePrice) : undefined,
        reselling_value: editResellingValue ? parseAmount(editResellingValue) : undefined,
        quantity: Number.parseInt(editQuantity, 10) || 1,
        notes: editNotes.trim() || undefined,
      });
      toast(t('Manga aggiornato!'));
      setEditOpen(false);
    } catch {
      toast.error(t('Errore'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
      toast(t('Manga rimosso'));
    } catch {
      toast.error(t('Errore'));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/libreria" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold">{t('Manga')}</h1>
              <p className="text-muted-foreground">{t('La tua collezione di manga')}</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t('Aggiungi Manga')}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>{t('Aggiungi Manga')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="title">{t('Titolo *')}</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('Es. Berserk')}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="author">{t('Autore')}</Label>
                    <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t('Es. Kentaro Miura')} />
                  </div>
                  <div>
                    <Label htmlFor="publisher">{t('Editore')}</Label>
                    <Input id="publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder={t('Es. Panini Comics')} />
                  </div>
                  <div>
                    <Label htmlFor="year">{t('Anno')}</Label>
                    <Input id="year" type="number" min="1900" max="2100" value={year} onChange={(e) => setYear(e.target.value)} placeholder={t('Es. 1997')} />
                  </div>
                  <div>
                    <Label htmlFor="volume_range">{t('N° volume o range')}</Label>
                    <Input
                      id="volume_range"
                      value={volumeRange}
                      onChange={(e) => setVolumeRange(e.target.value)}
                      placeholder={t('Es. 3 oppure 1-5')}
                    />
                    {volumeRange && !volumes && (
                      <p className="text-xs text-destructive mt-1">{t('Formato non valido. Usa 3 oppure 1-5.')}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="cover_image_url">{t('URL copertina')}</Label>
                  <Input
                    id="cover_image_url"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder={t('https://… (da Amazon, MyAnimeList, ecc.)')}
                  />
                  {coverImageUrl && (
                    <img
                      src={coverImageUrl}
                      alt={t('Anteprima copertina')}
                      className="mt-2 h-24 w-16 object-cover rounded"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchase_price">{t('Acquistato a (€)')}</Label>
                    <Input id="purchase_price" type="number" step="0.01" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <Label htmlFor="reselling_value">{t('Reselling Value (€)')}</Label>
                    <Input id="reselling_value" type="number" step="0.01" min="0" value={resellingValue} onChange={(e) => setResellingValue(e.target.value)} placeholder="0.00" />
                  </div>
                  {!volumes && (
                    <div>
                      <Label htmlFor="quantity">{t('Quantità')}</Label>
                      <Input id="quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="notes">{t('Note')}</Label>
                    <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Facoltativo')} />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetAddDialog}>{t('Annulla')}</Button>
                  <Button type="submit" disabled={!title.trim() || createItem.isPending || (volumeRange.trim() !== '' && !volumes)}>
                    {createItem.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {volumes && volumes.length > 1 ? t('Aggiungi {{count}} volumi', { count: volumes.length }) : t('Aggiungi')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('Investimento')}</p>
            <p className="text-xl font-display font-bold">€{totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('Valore Reselling')}</p>
            <p className="text-xl font-display font-bold">€{totalReselling.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('Profitto / Perdita')}</p>
            <p className={`text-xl font-display font-bold ${totalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalGain >= 0 ? '+' : ''}€{totalGain.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="glass rounded-xl p-4 grid sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t('Cerca titolo…')} value={filterText} onChange={(e) => setFilterText(e.target.value)} />
          </div>
          <Select value={filterAuthor} onValueChange={setFilterAuthor}>
            <SelectTrigger><SelectValue placeholder={t('Autore')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('Tutti gli autori')}</SelectItem>
              {uniqueAuthors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPublisher} onValueChange={setFilterPublisher}>
            <SelectTrigger><SelectValue placeholder={t('Editore')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('Tutti gli editori')}</SelectItem>
              {uniquePublishers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger><SelectValue placeholder={t('Anno')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('Tutti gli anni')}</SelectItem>
              {uniqueYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {items.length === 0 ? t('Nessun manga aggiunto. Inizia aggiungendo il primo!') : t('Nessun risultato per i filtri selezionati.')}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="glass rounded-xl p-4 flex items-center gap-4">
                {item.cover_image ? (
                  <img src={item.cover_image} alt={item.title} className="w-12 h-16 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-12 h-16 bg-muted rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.author ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{item.publisher ?? '—'}{item.year ? ` · ${item.year}` : ''}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm"><span className="text-muted-foreground">{t('Acquistato: ')}</span>{item.purchase_price != null ? `€${item.purchase_price.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}</p>
                  <p className="text-sm"><span className="text-muted-foreground">{t('Reselling: ')}</span>{item.reselling_value != null ? `€${item.reselling_value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}</p>
                  {item.quantity > 1 && <p className="text-xs text-muted-foreground">x{item.quantity}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="w-full max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{t('Modifica — {{title}}', { title: editingItem?.title ?? '' })}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="edit_title">{t('Titolo')}</Label>
                  <Input id="edit_title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_author">{t('Autore')}</Label>
                  <Input id="edit_author" value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_publisher">{t('Editore')}</Label>
                  <Input id="edit_publisher" value={editPublisher} onChange={(e) => setEditPublisher(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_year">{t('Anno')}</Label>
                  <Input id="edit_year" type="number" min="1900" max="2100" value={editYear} onChange={(e) => setEditYear(e.target.value)} />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_cover_image">{t('URL copertina')}</Label>
                <Input
                  id="edit_cover_image"
                  value={editCoverImage}
                  onChange={(e) => setEditCoverImage(e.target.value)}
                  placeholder="https://…"
                />
                {editCoverImage && (
                  <img
                    src={editCoverImage}
                    alt={t('Anteprima copertina')}
                    className="mt-2 h-24 w-16 object-cover rounded"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_purchase_price">{t('Acquistato a (€)')}</Label>
                  <Input id="edit_purchase_price" type="number" step="0.01" min="0" value={editPurchasePrice} onChange={(e) => setEditPurchasePrice(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label htmlFor="edit_reselling_value">{t('Reselling Value (€)')}</Label>
                  <Input id="edit_reselling_value" type="number" step="0.01" min="0" value={editResellingValue} onChange={(e) => setEditResellingValue(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label htmlFor="edit_quantity">{t('Quantità')}</Label>
                  <Input id="edit_quantity" type="number" min="1" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_notes">{t('Note')}</Label>
                  <Input id="edit_notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{t('Annulla')}</Button>
                <Button type="submit" disabled={updateItem.isPending}>
                  {updateItem.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('Salva')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
