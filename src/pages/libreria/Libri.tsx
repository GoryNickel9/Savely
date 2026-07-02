import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useLibraryItems } from '@/hooks/useLibraryItems';
import { LibraryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Search, Loader2, Pencil, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseAmount } from '@/lib/utils';

interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

async function searchGoogleBooks(q: string): Promise<GoogleBook[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(q)}&langRestrict=it&maxResults=20&orderBy=relevance`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Errore nella ricerca');
  const json = await res.json();
  const items = (json.items ?? []) as GoogleBook[];
  const seen = new Set<string>();
  return items.filter((b) => {
    if (!b.volumeInfo) return false;
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

function getBookYear(book: GoogleBook): number | undefined {
  const d = book.volumeInfo.publishedDate;
  if (!d) return undefined;
  const y = Number.parseInt(d.substring(0, 4), 10);
  return Number.isNaN(y) ? undefined : y;
}

export default function LibreriaLibri() {
  const { items, isLoading, createItem, updateItem, deleteItem, totalCost, totalReselling, totalGain } = useLibraryItems('libri');
  const { toast } = useToast();

  // Search / filter state
  const [filterText, setFilterText] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterPublisher, setFilterPublisher] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  // Add dialog state
  const [open, setOpen] = useState(false);
  const [apiQuery, setApiQuery] = useState('');
  const [apiResults, setApiResults] = useState<GoogleBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GoogleBook | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [resellingValue, setResellingValue] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
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

  const handleApiSearch = async () => {
    if (!apiQuery.trim()) return;
    setSearching(true);
    setApiResults([]);
    try {
      const docs = await searchGoogleBooks(apiQuery);
      setApiResults(docs);
    } catch {
      toast({ title: 'Errore nella ricerca', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    try {
      await createItem.mutateAsync({
        category: 'libri',
        title: selectedDoc.volumeInfo.title,
        author: selectedDoc.volumeInfo.authors?.[0] ?? undefined,
        publisher: selectedDoc.volumeInfo.publisher ?? undefined,
        year: getBookYear(selectedDoc),
        cover_image: selectedDoc.volumeInfo.imageLinks?.thumbnail?.replace('http://', 'https://') ?? undefined,
        api_id: selectedDoc.id,
        purchase_price: purchasePrice ? parseAmount(purchasePrice) : undefined,
        reselling_value: resellingValue ? parseAmount(resellingValue) : undefined,
        quantity: parseInt(quantity) || 1,
        notes: notes || undefined,
      });
      toast({ title: 'Libro aggiunto!' });
      resetAddDialog();
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const resetAddDialog = () => {
    setOpen(false);
    setApiQuery('');
    setApiResults([]);
    setSelectedDoc(null);
    setPurchasePrice('');
    setResellingValue('');
    setQuantity('1');
    setNotes('');
  };

  const openEdit = (item: LibraryItem) => {
    setEditingItem(item);
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
        purchase_price: editPurchasePrice ? parseAmount(editPurchasePrice) : undefined,
        reselling_value: editResellingValue ? parseAmount(editResellingValue) : undefined,
        quantity: parseInt(editQuantity) || 1,
        notes: editNotes || undefined,
      });
      toast({ title: 'Libro aggiornato!' });
      setEditOpen(false);
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
      toast({ title: 'Libro rimosso' });
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/libreria" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold">Libri</h1>
              <p className="text-muted-foreground">La tua collezione di libri</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi Libro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Aggiungi Libro</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* API search */}
                <div>
                  <Label>Cerca titolo (Google Books)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={apiQuery}
                      onChange={(e) => setApiQuery(e.target.value)}
                      placeholder="Es. Il Nome della Rosa"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApiSearch())}
                    />
                    <Button type="button" variant="secondary" onClick={handleApiSearch} disabled={searching}>
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Results */}
                {apiResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {apiResults.map((doc) => (
                      <button
                        type="button"
                        key={doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        className={`w-full flex items-center gap-3 p-3 text-left hover:bg-secondary transition-colors ${selectedDoc?.id === doc.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                      >
                        {doc.volumeInfo.imageLinks?.smallThumbnail ? (
                          <img
                            src={doc.volumeInfo.imageLinks.smallThumbnail.replace('http://', 'https://')}
                            alt=""
                            className="w-10 h-14 object-cover rounded flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-muted rounded flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.volumeInfo.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{doc.volumeInfo.authors?.join(', ')}</p>
                          <p className="text-xs text-muted-foreground">{doc.volumeInfo.publisher}{doc.volumeInfo.publishedDate ? ` · ${doc.volumeInfo.publishedDate.substring(0, 4)}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedDoc && (
                  <div className="glass rounded-lg p-3 text-sm">
                    <span className="font-medium">Selezionato:</span> {selectedDoc.volumeInfo.title}
                    {selectedDoc.volumeInfo.authors?.[0] && <span className="text-muted-foreground"> — {selectedDoc.volumeInfo.authors[0]}</span>}
                  </div>
                )}

                {/* User fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchase_price">Acquistato a (€)</Label>
                    <Input id="purchase_price" type="number" step="0.01" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <Label htmlFor="reselling_value">Reselling Value (€)</Label>
                    <Input id="reselling_value" type="number" step="0.01" min="0" value={resellingValue} onChange={(e) => setResellingValue(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantità</Label>
                    <Input id="quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="notes">Note</Label>
                    <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Facoltativo" />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetAddDialog}>Annulla</Button>
                  <Button type="submit" disabled={!selectedDoc || createItem.isPending}>
                    {createItem.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Aggiungi
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">Investimento</p>
            <p className="text-xl font-display font-bold">€{totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">Valore Reselling</p>
            <p className="text-xl font-display font-bold">€{totalReselling.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">Profitto / Perdita</p>
            <p className={`text-xl font-display font-bold ${totalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalGain >= 0 ? '+' : ''}€{totalGain.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-xl p-4 grid sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cerca titolo…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <Select value={filterAuthor} onValueChange={setFilterAuthor}>
            <SelectTrigger><SelectValue placeholder="Autore" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli autori</SelectItem>
              {uniqueAuthors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPublisher} onValueChange={setFilterPublisher}>
            <SelectTrigger><SelectValue placeholder="Editore" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli editori</SelectItem>
              {uniquePublishers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger><SelectValue placeholder="Anno" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli anni</SelectItem>
              {uniqueYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Items list */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {items.length === 0 ? 'Nessun libro aggiunto. Inizia aggiungendo il primo!' : 'Nessun risultato per i filtri selezionati.'}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="glass rounded-xl p-4 flex items-center gap-4">
                {item.cover_image ? (
                  <img src={item.cover_image} alt={item.title} className="w-12 h-16 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-12 h-16 bg-muted rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.author ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{item.publisher ?? '—'}{item.year ? ` · ${item.year}` : ''}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Acquistato: </span>
                    {item.purchase_price != null ? `€${item.purchase_price.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Reselling: </span>
                    {item.reselling_value != null ? `€${item.reselling_value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
                  </p>
                  {item.quantity > 1 && <p className="text-xs text-muted-foreground">x{item.quantity}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica — {editingItem?.title}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_purchase_price">Acquistato a (€)</Label>
                  <Input id="edit_purchase_price" type="number" step="0.01" min="0" value={editPurchasePrice} onChange={(e) => setEditPurchasePrice(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label htmlFor="edit_reselling_value">Reselling Value (€)</Label>
                  <Input id="edit_reselling_value" type="number" step="0.01" min="0" value={editResellingValue} onChange={(e) => setEditResellingValue(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label htmlFor="edit_quantity">Quantità</Label>
                  <Input id="edit_quantity" type="number" min="1" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_notes">Note</Label>
                  <Input id="edit_notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
                <Button type="submit" disabled={updateItem.isPending}>
                  {updateItem.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salva
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
