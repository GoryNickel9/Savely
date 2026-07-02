import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Check, X, FileSpreadsheet, TrendingUp, Plus } from 'lucide-react';
import { validateImportFile } from '@/lib/importFileSecurity';
import { parseCsvRows } from '@/lib/csv';

interface BankImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface ParsedTransaction {
  date: string;
  descrizione: string;
  amount: number;
  type: 'income' | 'expense' | 'investment';
  isin?: string;
  investmentName?: string;
}

interface AutoImportTransaction extends ParsedTransaction {
  categoryId: string;
  editedDescrizione: string;
  note: string;
}

interface ISINMapping {
  isin: string;
  symbol: string;
  name: string;
  assetType: string;
}

type ImportStep = 'upload' | 'review-isins' | 'review' | 'importing' | 'complete';

const DEFAULT_ICONS_INCOME = ['💰', '💵', '📈', '💳', '🏦', '💎', '🎯', '🎁'];
const DEFAULT_ICONS_EXPENSE = ['💸', '🛒', '🍔', '🚗', '🏠', '💊', '🎬', '📦'];
const DEFAULT_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#6b7280',
];

export default function BankImportDialog({ open, onOpenChange, userId }: BankImportDialogProps) {
  const { toast } = useToast();
  const { categories, refetch: refetchCategories, isLoading } = useCategories();
  const { assets, createAsset } = usePortfolio();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [isinMappings, setIsinMappings] = useState<Record<string, ISINMapping>>({});
  const [unknownIsins, setUnknownIsins] = useState<Array<{ isin: string; name: string }>>([]);
  const [currentIsinIndex, setCurrentIsinIndex] = useState(0);
  const [newSymbol, setNewSymbol] = useState('');
  const [newAssetName, setNewAssetName] = useState('');
  const [selectedExistingAsset, setSelectedExistingAsset] = useState('');
  const [useExisting, setUseExisting] = useState(false);

  const [manualTransactions, setManualTransactions] = useState<ParsedTransaction[]>([]);
  const [autoImportedTransactions, setAutoImportedTransactions] = useState<AutoImportTransaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [declinedDescriptions, setDeclinedDescriptions] = useState<Set<string>>(new Set());
  const [dbCategoryMappings, setDbCategoryMappings] = useState<Record<string, { categoryId: string; keyword: string }>>({});
  const [editedDescrizione, setEditedDescrizione] = useState('');
  const [editedNote, setEditedNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [acceptedTransactions, setAcceptedTransactions] = useState<Array<ParsedTransaction & { categoryId: string; editedDescrizione: string; note: string }>>([]);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});

  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('💰');
  const [newCategoryColor, setNewCategoryColor] = useState('#22c55e');

  const [dividendiCategoryId, setDividendiCategoryId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState({ transactions: 0, investments: 0 });
  const [skippedCount, setSkippedCount] = useState(0);
  const [autoImportedCount, setAutoImportedCount] = useState(0);

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  const incomeCategories = categories?.filter(c => c.type === 'income') || [];
  const isLoadingCategories = isLoading;

  const currentTransaction = manualTransactions[currentIndex];

  // ── helpers ──────────────────────────────────────────────────────────────

  const ensureDividendiCategory = async (): Promise<string | null> => {
    const existing = incomeCategories.find(c => c.name.toLowerCase() === 'dividendi');
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: 'Dividendi', icon: '💰', color: '#22c55e', type: 'income' })
      .select('id')
      .single();

    if (error) { console.error('Error creating Dividendi category:', error); return null; }
    refetchCategories();
    return data?.id || null;
  };

  const parseAmount = (value: string | number | undefined): number => {
    if (value === undefined || value === '') return 0;
    const s = value.toString();
    if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(s) || 0;
  };

  const extractISIN = (text: string): string | null => {
    const match = text.match(/[A-Z]{2}[A-Z0-9]{10}/);
    return match ? match[0] : null;
  };

  const parseDateStr = (dateValue: string | number | undefined): string => {
    if (!dateValue) return new Date().toISOString().split('T')[0];
    if (typeof dateValue === 'number') {
      return new Date((dateValue - 25569) * 86400 * 1000).toISOString().split('T')[0];
    }
    const s = dateValue.toString();
    if (s.includes('-')) return s.split('T')[0];
    if (s.includes('/')) {
      const [d, m, y] = s.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  const findMatchingCategory = (descrizione: string): { categoryId: string; keyword: string } | null => {
    const lower = descrizione.toLowerCase();
    for (const [keyword, mapping] of Object.entries(dbCategoryMappings)) {
      if (lower.includes(keyword)) return mapping;
    }
    return null;
  };

  const isAutoInterest = (descrizione: string): boolean => {
    const up = descrizione.toUpperCase();
    // BBVA interest
    if (up.includes('SPESE ACCREDITO') && up.includes('A FRONTE DEL SALDO MENSILE')) return true;
    // Trade Republic interest
    const lo = descrizione.toLowerCase();
    if (lo.includes('interessi') && lo.includes('interest payment')) return true;
    return false;
  };

  const isExcluded = (descrizione: string): boolean =>
    descrizione.toUpperCase().includes('SPORT. AUT.');

  const isTransfer = (descrizione: string): boolean =>
    descrizione.toUpperCase().includes('TRASFERIMENTO');

  const isInvestmentRow = (tipo: string): boolean =>
    tipo.toLowerCase().includes('saving') ||
    tipo.toLowerCase().includes('buy trade') ||
    tipo.toLowerCase().includes('savings plan');

  // ── effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadMappings = async () => {
      const { data } = await supabase
        .from('category_mappings')
        .select('description, category_id')
        .eq('user_id', userId);
      if (data) {
        const mappings: Record<string, { categoryId: string; keyword: string }> = {};
        data.forEach(m => {
          if (m.description && m.category_id)
            mappings[m.description.toLowerCase()] = { categoryId: m.category_id, keyword: m.description };
        });
        setDbCategoryMappings(mappings);
      }
    };
    if (open && userId) loadMappings();
  }, [open, userId]);

  useEffect(() => {
    const setup = async () => {
      if (open && userId && categories && categories.length > 0) {
        const catId = await ensureDividendiCategory();
        setDividendiCategoryId(catId);
      }
    };
    setup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, categories]);

  useEffect(() => {
    if (currentTransaction) {
      setEditedDescrizione(currentTransaction.descrizione || '');
      setEditedNote('');
      const saved = categoryMappings[currentTransaction.descrizione.toLowerCase()];
      setSelectedCategory(saved || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentTransaction]);

  // ── file parsing ──────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      validateImportFile(file);

      let dividendiId = dividendiCategoryId;
      if (!dividendiId) {
        dividendiId = await ensureDividendiCategory();
        setDividendiCategoryId(dividendiId);
      }

      const rows = parseCsvRows(await file.text());

      // Detect header row
      const headerRowIndex = rows.findIndex(row =>
        row.some(cell => {
          const c = cell?.toString().toLowerCase() || '';
          return c.includes('tipo') || c.includes('descrizione') || c.includes('nota') || c.includes('importo');
        })
      );

      if (headerRowIndex === -1) {
        toast({ title: 'Formato non valido', description: 'Impossibile rilevare le intestazioni del file.', variant: 'destructive' });
        return;
      }

      const headers = rows[headerRowIndex].map(h => h?.toString().toLowerCase().trim() || '');
      const dateIndex = headers.findIndex(h => h.includes('data'));
      const tipoIndex = headers.findIndex(h => h === 'tipo' || h.startsWith('tipo'));
      const descrizioneIndex = headers.findIndex(h => h.includes('descrizione') || h.includes('nota'));
      const entrataIndex = headers.findIndex(h => h.includes('entrata'));
      const uscitaIndex = headers.findIndex(h => h.includes('uscita'));
      // Single signed amount column (new BBVA CSV / generic)
      const importoIndex = (entrataIndex === -1 && uscitaIndex === -1)
        ? headers.findIndex(h => h.includes('importo'))
        : -1;

      const parsed: ParsedTransaction[] = [];
      const isinsFound = new Map<string, string>();
      const autoImported: AutoImportTransaction[] = [];

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const tipo = tipoIndex !== -1 ? row[tipoIndex]?.toString().trim() || '' : '';
        const descrizione = descrizioneIndex !== -1 ? row[descrizioneIndex]?.toString().trim() || '' : '';

        if (isTransfer(descrizione) || isTransfer(tipo)) continue;
        if (isExcluded(descrizione)) continue;

        let entrataAmount = 0;
        let uscitaAmount = 0;
        if (importoIndex !== -1) {
          const signed = parseAmount(row[importoIndex]);
          if (signed > 0) entrataAmount = signed;
          else uscitaAmount = Math.abs(signed);
        } else {
          entrataAmount = parseAmount(row[entrataIndex]);
          uscitaAmount = parseAmount(row[uscitaIndex]);
        }

        if (entrataAmount === 0 && uscitaAmount === 0) continue;

        const dateStr = parseDateStr(row[dateIndex] as string | number | undefined);
        const isInvestment = tipo !== '' && isInvestmentRow(tipo);

        if (isInvestment) {
          const isin = extractISIN(tipo);
          if (isin) {
            const nameMatch = tipo.match(/[A-Z]{2}[A-Z0-9]{10}\s+(.+)/);
            const investmentName = nameMatch ? nameMatch[1].trim() : tipo;
            isinsFound.set(isin, investmentName);
            parsed.push({
              date: dateStr,
              descrizione,
              amount: uscitaAmount || entrataAmount,
              type: 'investment',
              isin,
              investmentName,
            });
          }
          continue;
        }

        const txType = entrataAmount > 0 ? 'income' : 'expense';
        const amount = entrataAmount > 0 ? entrataAmount : uscitaAmount;
        const transaction: ParsedTransaction = { date: dateStr, descrizione, amount, type: txType };

        if (isAutoInterest(descrizione) && dividendiId) {
          autoImported.push({ ...transaction, categoryId: dividendiId, editedDescrizione: 'Interessi', note: '' });
          continue;
        }

        const matchingCategory = findMatchingCategory(descrizione);
        if (matchingCategory) {
          autoImported.push({ ...transaction, categoryId: matchingCategory.categoryId, editedDescrizione: matchingCategory.keyword, note: '' });
          continue;
        }

        parsed.push(transaction);
      }

      if (parsed.length === 0 && autoImported.length === 0) {
        toast({ title: 'Nessuna transazione', description: 'Non ho trovato transazioni valide nel file.', variant: 'destructive' });
        return;
      }

      setTransactions(parsed);
      setAutoImportedTransactions(autoImported);
      setAutoImportedCount(autoImported.length);

      // Load existing ISIN mappings
      const { data: existingMappings } = await supabase
        .from('isin_mappings')
        .select('*')
        .eq('user_id', userId);

      const mappingsMap: Record<string, ISINMapping> = {};
      existingMappings?.forEach(m => {
        mappingsMap[m.isin] = { isin: m.isin, symbol: m.symbol, name: m.name, assetType: m.asset_type };
      });
      setIsinMappings(mappingsMap);

      const unknowns: Array<{ isin: string; name: string }> = [];
      isinsFound.forEach((name, isin) => { if (!mappingsMap[isin]) unknowns.push({ isin, name }); });

      const regularTxs = parsed.filter(t => t.type !== 'investment');
      setManualTransactions(regularTxs);

      if (unknowns.length > 0) {
        setUnknownIsins(unknowns);
        setCurrentIsinIndex(0);
        setStep('review-isins');
      } else if (regularTxs.length > 0) {
        setCurrentIndex(0);
        setStep('review');
      } else {
        const investmentTxs = parsed.filter(t => t.type === 'investment');
        executeImport(investmentTxs, mappingsMap, autoImported, []);
      }

      const autoMsg = autoImported.length > 0 ? `, ${autoImported.length} automatiche` : '';
      toast({ title: 'File caricato', description: `${parsed.length + autoImported.length} transazioni trovate${autoMsg}.` });
    } catch (error) {
      console.error('Bank import error:', error);
      toast({ title: 'Errore', description: 'Impossibile leggere il file.', variant: 'destructive' });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── ISIN handling ─────────────────────────────────────────────────────────

  const handleSaveISINMapping = async () => {
    const current = unknownIsins[currentIsinIndex];
    let mapping: ISINMapping;

    if (useExisting && selectedExistingAsset) {
      const asset = assets.find(a => a.id === selectedExistingAsset);
      if (!asset) return;
      mapping = { isin: current.isin, symbol: asset.symbol || '', name: asset.name, assetType: asset.type };
    } else {
      if (!newSymbol || !newAssetName) {
        toast({ title: 'Dati mancanti', description: 'Inserisci simbolo e nome dell\'asset.', variant: 'destructive' });
        return;
      }
      mapping = { isin: current.isin, symbol: newSymbol.toUpperCase(), name: newAssetName, assetType: 'etf' };
    }

    await supabase.from('isin_mappings').upsert({
      user_id: userId, isin: mapping.isin, symbol: mapping.symbol, name: mapping.name, asset_type: mapping.assetType,
    });

    const newMappings = { ...isinMappings, [current.isin]: mapping };
    setIsinMappings(newMappings);
    setNewSymbol(''); setNewAssetName(''); setSelectedExistingAsset(''); setUseExisting(false);

    if (currentIsinIndex + 1 >= unknownIsins.length) {
      if (manualTransactions.length > 0) {
        setCurrentIndex(0);
        setStep('review');
      } else {
        const investmentTxs = transactions.filter(t => t.type === 'investment');
        executeImport(investmentTxs, newMappings, autoImportedTransactions, []);
      }
    } else {
      setCurrentIsinIndex(prev => prev + 1);
    }
  };

  // ── category creation ─────────────────────────────────────────────────────

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ title: 'Nome categoria richiesto', description: 'Inserisci un nome per la nuova categoria.', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: newCategoryName.trim(),
        icon: newCategoryIcon,
        color: newCategoryColor,
        type: currentTransaction?.type === 'income' ? 'income' : 'expense',
      })
      .select('id')
      .single();

    if (error) {
      toast({ title: 'Errore creazione categoria', description: 'Impossibile creare la categoria.', variant: 'destructive' });
      return;
    }
    refetchCategories();
    setSelectedCategory(data.id);
    setShowNewCategoryForm(false);
    setNewCategoryName('');
    toast({ title: 'Categoria creata', description: `Categoria "${newCategoryName}" creata con successo.` });
  };

  // ── review actions ────────────────────────────────────────────────────────

  const handleAccept = () => {
    if (!selectedCategory) {
      toast({ title: 'Seleziona una categoria', description: 'Devi selezionare una categoria per accettare la transazione.', variant: 'destructive' });
      return;
    }
    const keyword = editedDescrizione.toLowerCase().trim();
    if (keyword) setCategoryMappings(prev => ({ ...prev, [keyword]: selectedCategory }));

    setAcceptedTransactions(prev => [
      ...prev,
      { ...currentTransaction, editedDescrizione, note: editedNote, categoryId: selectedCategory },
    ]);
    moveToNext();
  };

  const handleDecline = () => {
    if (currentTransaction.descrizione)
      setDeclinedDescriptions(prev => new Set(prev).add(currentTransaction.descrizione.toLowerCase()));
    setSkippedCount(prev => prev + 1);
    moveToNext();
  };

  const moveToNext = () => {
    let nextIndex = currentIndex + 1;
    while (nextIndex < manualTransactions.length) {
      const next = manualTransactions[nextIndex];
      if (next.descrizione && declinedDescriptions.has(next.descrizione.toLowerCase())) {
        setSkippedCount(prev => prev + 1);
        nextIndex++;
      } else break;
    }

    if (nextIndex >= manualTransactions.length) {
      const investmentTxs = transactions.filter(t => t.type === 'investment');
      executeImport(investmentTxs, isinMappings, autoImportedTransactions, acceptedTransactions);
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  // ── import ────────────────────────────────────────────────────────────────

  const executeImport = async (
    investmentTxs: ParsedTransaction[],
    isinMap: Record<string, ISINMapping>,
    autoTxs: AutoImportTransaction[],
    manualTxs: Array<ParsedTransaction & { categoryId: string; editedDescrizione: string; note: string }>
  ) => {
    setStep('importing');
    setImportProgress(0);

    const allRegularTxs = [...autoTxs, ...manualTxs];
    const total = investmentTxs.length + allRegularTxs.length;
    let transactionCount = 0;
    let investmentCount = 0;
    let processed = 0;

    // Save category mappings (shared)
    const mappingEntries = Object.entries(categoryMappings);
    if (mappingEntries.length > 0) {
      await supabase.from('category_mappings').upsert(
        mappingEntries.map(([keyword, categoryId]) => ({
          user_id: userId, description: keyword, category_id: categoryId, source: 'shared',
        })),
        { onConflict: 'user_id,description,source' }
      );
    }

    // Import investments
    for (const tx of investmentTxs) {
      if (tx.isin) {
        const mapping = isinMap[tx.isin];
        if (mapping) {
          const existingAsset = assets.find(a => a.symbol?.toUpperCase() === mapping.symbol.toUpperCase());
          if (!existingAsset) {
            await createAsset.mutateAsync({
              name: mapping.name,
              symbol: mapping.symbol,
              type: mapping.assetType as 'etf' | 'stock' | 'crypto' | 'bond' | 'cash' | 'real_estate' | 'other',
              quantity: 1,
              purchase_price: tx.amount,
              purchase_date: tx.date,
              notes: `Importato da banca - ISIN: ${tx.isin}`,
            });
          }
          investmentCount++;
        }
      }
      processed++;
      setImportProgress((processed / total) * 100);
    }

    // Import regular transactions in batches
    const BATCH_SIZE = 1000;
    for (let i = 0; i < allRegularTxs.length; i += BATCH_SIZE) {
      const batch = allRegularTxs.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('transactions').insert(
        batch.map(tx => ({
          user_id: userId,
          type: tx.type as 'income' | 'expense',
          amount: tx.amount,
          currency: 'EUR' as const,
          category_id: tx.categoryId,
          description: tx.note ? `${tx.editedDescrizione} - ${tx.note}` : tx.editedDescrizione,
          date: tx.date,
        }))
      );
      if (!error) transactionCount += batch.length;
      processed += batch.length;
      setImportProgress((processed / total) * 100);
    }

    setImportedCount({ transactions: transactionCount, investments: investmentCount });
    setStep('complete');
  };

  // ── reset ─────────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep('upload');
    setTransactions([]); setManualTransactions([]); setAutoImportedTransactions([]);
    setIsinMappings({}); setUnknownIsins([]); setCurrentIsinIndex(0);
    setCurrentIndex(0); setDeclinedDescriptions(new Set());
    setCategoryMappings({}); setAcceptedTransactions([]);
    setImportProgress(0); setImportedCount({ transactions: 0, investments: 0 });
    setSkippedCount(0); setAutoImportedCount(0);
    setEditedDescrizione(''); setEditedNote(''); setSelectedCategory('');
    setNewSymbol(''); setNewAssetName(''); setSelectedExistingAsset(''); setUseExisting(false);
    setShowNewCategoryForm(false); setNewCategoryName(''); setNewCategoryIcon('💰'); setNewCategoryColor('#22c55e');
    onOpenChange(false);
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const currentIsin = unknownIsins[currentIsinIndex];
  const availableCategories = currentTransaction?.type === 'income' ? incomeCategories : expenseCategories;
  const progress = manualTransactions.length > 0 ? ((currentIndex + 1) / manualTransactions.length) * 100 : 0;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importa dalla tua banca</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Carica il tuo estratto conto in formato CSV.'}
            {step === 'review-isins' && `Associa ISIN a ticker (${currentIsinIndex + 1}/${unknownIsins.length})`}
            {step === 'review' && `Revisiona le transazioni (${currentIndex + 1}/${manualTransactions.length})${autoImportedCount > 0 ? ` - ${autoImportedCount} automatiche` : ''}`}
            {step === 'importing' && 'Importazione in corso...'}
            {step === 'complete' && 'Importazione completata!'}
          </DialogDescription>
        </DialogHeader>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            {isLoadingCategories ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Caricamento categorie...</p>
              </div>
            ) : (
              <>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-32 flex flex-col items-center justify-center gap-2 border-dashed"
                >
                  <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                  <span>Clicca per caricare il file</span>
                  <span className="text-xs text-muted-foreground">CSV (BBVA, Trade Republic, ecc.)</span>
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── REVIEW ISINs ── */}
        {step === 'review-isins' && currentIsin && (
          <div className="space-y-4">
            <Progress value={((currentIsinIndex + 1) / unknownIsins.length) * 100} className="h-2" />

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="font-medium">Nuovo ISIN trovato</span>
              </div>
              <div className="text-sm">
                <p><strong>ISIN:</strong> {currentIsin.isin}</p>
                <p><strong>Nome:</strong> {currentIsin.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant={!useExisting ? 'default' : 'outline'} size="sm" onClick={() => setUseExisting(false)}>
                  Crea nuovo
                </Button>
                <Button variant={useExisting ? 'default' : 'outline'} size="sm" onClick={() => setUseExisting(true)} disabled={assets.length === 0}>
                  Usa esistente
                </Button>
              </div>

              {!useExisting ? (
                <>
                  <div className="space-y-2">
                    <Label>Simbolo (Ticker)</Label>
                    <Input value={newSymbol} onChange={e => setNewSymbol(e.target.value.toUpperCase())} placeholder="es. VWCE" />
                    {newSymbol && assets.some(a => a.symbol?.toUpperCase() === newSymbol.toUpperCase()) && (
                      <p className="text-xs text-yellow-500">⚠️ Esiste già un asset con questo simbolo</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Asset</Label>
                    <Input value={newAssetName} onChange={e => setNewAssetName(e.target.value)} placeholder="es. Vanguard FTSE All-World" defaultValue={currentIsin.name} />
                    {newAssetName && assets.some(a => a.name.toLowerCase() === newAssetName.toLowerCase()) && (
                      <p className="text-xs text-yellow-500">⚠️ Esiste già un asset con questo nome</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Asset esistente</Label>
                  <Select value={selectedExistingAsset} onValueChange={setSelectedExistingAsset}>
                    <SelectTrigger><SelectValue placeholder="Seleziona asset" /></SelectTrigger>
                    <SelectContent>
                      {assets
                        .filter((asset, index, self) =>
                          asset.symbol
                            ? index === self.findIndex(a => a.symbol?.toUpperCase() === asset.symbol?.toUpperCase())
                            : index === self.findIndex(a => a.name === asset.name)
                        )
                        .map(asset => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.symbol ? `${asset.symbol} - ` : ''}{asset.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button onClick={handleSaveISINMapping} className="w-full">
              <Check className="w-4 h-4 mr-2" />
              Salva e Continua
            </Button>
          </div>
        )}

        {/* ── REVIEW TRANSACTIONS ── */}
        {step === 'review' && currentTransaction && (
          <div className="space-y-4">
            <Progress value={progress} className="h-2" />

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Data</span>
                <span className="font-medium">{currentTransaction.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Importo</span>
                <span className={`font-bold ${currentTransaction.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                  {currentTransaction.type === 'income' ? '+' : '-'}€{currentTransaction.amount.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Descrizione originale:</span>
                <p className="text-xs mt-1 break-all">{currentTransaction.descrizione}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrizione (diventerà il mapping per transazioni future)</Label>
              <Input
                value={editedDescrizione}
                onChange={e => setEditedDescrizione(e.target.value)}
                placeholder="Parola chiave per questa transazione"
              />
              <p className="text-xs text-muted-foreground">
                Le future transazioni che contengono questa parola saranno importate automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Note (opzionale)</Label>
              <Input value={editedNote} onChange={e => setEditedNote(e.target.value)} placeholder="Note aggiuntive" />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              {isLoadingCategories ? (
                <p className="text-sm text-muted-foreground">Caricamento categorie...</p>
              ) : showNewCategoryForm ? (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <Label className="text-xs">Nome categoria</Label>
                    <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Es. Alimentari" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Icona</Label>
                    <div className="flex flex-wrap gap-2">
                      {(currentTransaction.type === 'income' ? DEFAULT_ICONS_INCOME : DEFAULT_ICONS_EXPENSE).map(icon => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setNewCategoryIcon(icon)}
                          className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${newCategoryIcon === icon ? 'border-primary bg-primary/10' : 'border-transparent hover:border-muted-foreground/30'}`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Colore</Label>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewCategoryColor(color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${newCategoryColor === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowNewCategoryForm(false)} className="flex-1">Annulla</Button>
                    <Button size="sm" onClick={handleCreateCategory} className="flex-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Crea
                    </Button>
                  </div>
                </div>
              ) : availableCategories.length > 0 ? (
                <>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                    <SelectContent>
                      {availableCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setShowNewCategoryForm(true)} className="text-xs w-full mt-1">
                    <Plus className="w-3 h-3 mr-1" />
                    Crea nuova categoria
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">Nessuna categoria per questo tipo di transazione.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchCategories()} className="flex-1">Ricarica</Button>
                    <Button size="sm" onClick={() => setShowNewCategoryForm(true)} className="flex-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Crea nuova
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDecline} variant="outline" className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Salta
              </Button>
              <Button onClick={handleAccept} className="flex-1" disabled={!selectedCategory}>
                <Check className="w-4 h-4 mr-2" />
                Accetta
              </Button>
            </div>
          </div>
        )}

        {/* ── IMPORTING ── */}
        {step === 'importing' && (
          <div className="space-y-4 py-4">
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-muted-foreground">
              Importazione in corso... {Math.round(importProgress)}%
            </p>
          </div>
        )}

        {/* ── COMPLETE ── */}
        {step === 'complete' && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Importazione completata!</p>
              <p className="text-sm text-muted-foreground">
                {importedCount.transactions} transazioni
                {importedCount.investments > 0 && `, ${importedCount.investments} investimenti`}
                {skippedCount > 0 && `, ${skippedCount} saltate`}
                {autoImportedCount > 0 && `, ${autoImportedCount} automatiche`}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">Chiudi</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
