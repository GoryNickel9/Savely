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
import { Check, X, FileSpreadsheet, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';

interface TradeRepublicImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface ParsedTransaction {
  date: string;
  tipo: string;
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

export default function TradeRepublicImportDialog({ open, onOpenChange, userId }: TradeRepublicImportDialogProps) {
  const { toast } = useToast();
  const { categories, refetch: refetchCategories } = useCategories();
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
  
  // Review state (like BBVA)
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
  
  const [dividendiCategoryId, setDividendiCategoryId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState({ transactions: 0, investments: 0 });
  const [skippedCount, setSkippedCount] = useState(0);
  const [autoImportedCount, setAutoImportedCount] = useState(0);

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  const incomeCategories = categories?.filter(c => c.type === 'income') || [];

  const currentTransaction = manualTransactions[currentIndex];

  // Create Dividendi category if it doesn't exist
  const ensureDividendiCategory = async (): Promise<string | null> => {
    const existing = incomeCategories.find(c => c.name.toLowerCase() === 'dividendi');
    if (existing) {
      return existing.id;
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: 'Dividendi',
        icon: '💰',
        color: '#22c55e',
        type: 'income',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating Dividendi category:', error);
      return null;
    }

    refetchCategories();
    return data?.id || null;
  };

  // Load existing category mappings from database (SHARED - no source filter)
  useEffect(() => {
    const loadMappings = async () => {
      const { data } = await supabase
        .from('category_mappings')
        .select('description, category_id')
        .eq('user_id', userId);
      
      if (data) {
        const mappings: Record<string, { categoryId: string; keyword: string }> = {};
        data.forEach(m => {
          if (m.description && m.category_id) {
            mappings[m.description.toLowerCase()] = {
              categoryId: m.category_id,
              keyword: m.description
            };
          }
        });
        setDbCategoryMappings(mappings);
      }
    };
    
    if (open && userId) {
      loadMappings();
    }
  }, [open, userId]);

  // Ensure Dividendi category exists when dialog opens
  useEffect(() => {
    const setupDividendi = async () => {
      if (open && userId && categories && categories.length > 0) {
        const catId = await ensureDividendiCategory();
        setDividendiCategoryId(catId);
      }
    };
    setupDividendi();
  }, [open, userId, categories]);

  // Update form when current transaction changes
  useEffect(() => {
    if (currentTransaction) {
      setEditedDescrizione(currentTransaction.descrizione || '');
      setEditedNote('');
      // Check if we have a saved mapping
      const savedMapping = categoryMappings[currentTransaction.descrizione.toLowerCase()];
      setSelectedCategory(savedMapping || '');
    }
  }, [currentIndex, currentTransaction, categoryMappings]);

  const parseAmount = (value: string | number | undefined): number => {
    if (value === undefined || value === '') return 0;
    const strValue = value.toString();
    // Handle Italian number format (1.234,56 -> 1234.56)
    // Check if it has a comma (Italian decimal separator)
    if (strValue.includes(',')) {
      const cleaned = strValue.replace(/\./g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    }
    // Already a proper number or uses dot as decimal
    return parseFloat(strValue) || 0;
  };

  const extractISIN = (tipo: string): string | null => {
    const match = tipo.match(/[A-Z]{2}[A-Z0-9]{10}/);
    return match ? match[0] : null;
  };

  // Find matching category from database mappings (shared across all banks)
  const findMatchingCategory = (descrizione: string): { categoryId: string; keyword: string } | null => {
    const descLower = descrizione.toLowerCase();
    
    for (const [keyword, mapping] of Object.entries(dbCategoryMappings)) {
      if (descLower.includes(keyword)) {
        return mapping;
      }
    }
    return null;
  };

  // Check for Trade Republic interest transaction
  const isInterestPayment = (descrizione: string): boolean => {
    return descrizione.toLowerCase().includes('interessi') && 
           descrizione.toLowerCase().includes('interest payment');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Ensure Dividendi category exists before processing
      let dividendiId = dividendiCategoryId;
      if (!dividendiId) {
        dividendiId = await ensureDividendiCategory();
        setDividendiCategoryId(dividendiId);
      }

      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Use raw: false to get formatted strings instead of parsed numbers
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as string[][];

      // Find header row
      const headerRowIndex = rows.findIndex(row => 
        row.some(cell => cell?.toString().toLowerCase().includes('tipo') || 
                        cell?.toString().toLowerCase().includes('descrizione'))
      );

      if (headerRowIndex === -1) {
        toast({
          title: 'Formato non valido',
          description: 'Il file non sembra essere un estratto conto Trade Republic.',
          variant: 'destructive',
        });
        return;
      }

      const headers = rows[headerRowIndex].map(h => h?.toString().toLowerCase().trim() || '');
      const dateIndex = headers.findIndex(h => h.includes('data'));
      const tipoIndex = headers.findIndex(h => h.includes('tipo'));
      const descrizioneIndex = headers.findIndex(h => h.includes('descrizione'));
      const entrataIndex = headers.findIndex(h => h.includes('entrata'));
      const uscitaIndex = headers.findIndex(h => h.includes('uscita'));

      const parsed: ParsedTransaction[] = [];
      const isinsFound = new Map<string, string>();
      const autoImported: AutoImportTransaction[] = [];

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const tipo = row[tipoIndex]?.toString().trim() || '';
        const descrizione = row[descrizioneIndex]?.toString().trim() || '';
        const entrataRaw = row[entrataIndex];
        const uscitaRaw = row[uscitaIndex];

        const entrataAmount = parseAmount(entrataRaw);
        const uscitaAmount = parseAmount(uscitaRaw);

        if (entrataAmount === 0 && uscitaAmount === 0) continue;

        let dateValue = row[dateIndex];
        let dateStr = '';
        
        if (dateValue) {
          if (typeof dateValue === 'number') {
            const date = new Date((dateValue - 25569) * 86400 * 1000);
            dateStr = date.toISOString().split('T')[0];
          } else {
            const str = dateValue.toString();
            if (str.includes('-')) {
              dateStr = str.split('T')[0];
            } else if (str.includes('/')) {
              const [d, m, y] = str.split('/');
              dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            } else {
              dateStr = new Date().toISOString().split('T')[0];
            }
          }
        } else {
          dateStr = new Date().toISOString().split('T')[0];
        }

        // Check if it's an investment
        const isInvestment = tipo.toLowerCase().includes('saving') || 
                            tipo.toLowerCase().includes('buy trade') ||
                            tipo.toLowerCase().includes('savings plan');

        if (isInvestment) {
          const isin = extractISIN(tipo);
          if (isin) {
            const nameMatch = tipo.match(/[A-Z]{2}[A-Z0-9]{10}\s+(.+)/);
            const investmentName = nameMatch ? nameMatch[1].trim() : tipo;
            isinsFound.set(isin, investmentName);
            
            parsed.push({
              date: dateStr,
              tipo,
              descrizione,
              amount: uscitaAmount || entrataAmount,
              type: 'investment',
              isin,
              investmentName,
            });
          }
        } else {
          const txType = entrataAmount > 0 ? 'income' : 'expense';
          const amount = entrataAmount > 0 ? entrataAmount : uscitaAmount;
          
          const transaction: ParsedTransaction = {
            date: dateStr,
            tipo,
            descrizione,
            amount,
            type: txType,
          };

          // Check for Trade Republic interest - auto import as Dividendi
          if (isInterestPayment(descrizione) && dividendiId) {
            autoImported.push({
              ...transaction,
              categoryId: dividendiId,
              editedDescrizione: 'Interessi Trade Republic',
              note: '',
            });
            continue;
          }

          // Check for matching category from database (shared mappings)
          const matchingCategory = findMatchingCategory(descrizione);
          if (matchingCategory) {
            autoImported.push({
              ...transaction,
              categoryId: matchingCategory.categoryId,
              editedDescrizione: matchingCategory.keyword,
              note: '',
            });
            continue;
          }

          // Needs manual review
          parsed.push(transaction);
        }
      }

      if (parsed.length === 0 && autoImported.length === 0) {
        toast({
          title: 'Nessuna transazione',
          description: 'Non ho trovato transazioni valide nel file.',
          variant: 'destructive',
        });
        return;
      }

      setTransactions(parsed);
      setAutoImportedTransactions(autoImported);
      setAutoImportedCount(autoImported.length);

      // Load existing ISIN mappings from DB
      const { data: existingMappings } = await supabase
        .from('isin_mappings')
        .select('*')
        .eq('user_id', userId);

      const mappingsMap: Record<string, ISINMapping> = {};
      existingMappings?.forEach(m => {
        mappingsMap[m.isin] = {
          isin: m.isin,
          symbol: m.symbol,
          name: m.name,
          assetType: m.asset_type,
        };
      });
      setIsinMappings(mappingsMap);

      // Find unknown ISINs
      const unknowns: Array<{ isin: string; name: string }> = [];
      isinsFound.forEach((name, isin) => {
        if (!mappingsMap[isin]) {
          unknowns.push({ isin, name });
        }
      });

      // Separate investment transactions from regular ones
      const investmentTxs = parsed.filter(t => t.type === 'investment');
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
        // Only investments and auto-imported, go straight to import
        executeImport(investmentTxs, mappingsMap, autoImported, []);
      }

      const autoMsg = autoImported.length > 0 ? `, ${autoImported.length} automatiche` : '';
      toast({
        title: 'File caricato',
        description: `Trovate ${parsed.length + autoImported.length} transazioni${autoMsg}.`,
      });
    } catch (error) {
      console.error('Trade Republic import error:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile leggere il file.',
        variant: 'destructive',
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveISINMapping = async () => {
    const current = unknownIsins[currentIsinIndex];
    
    let mapping: ISINMapping;
    
    if (useExisting && selectedExistingAsset) {
      const asset = assets.find(a => a.id === selectedExistingAsset);
      if (!asset) return;
      
      mapping = {
        isin: current.isin,
        symbol: asset.symbol || '',
        name: asset.name,
        assetType: asset.type,
      };
    } else {
      if (!newSymbol || !newAssetName) {
        toast({
          title: 'Dati mancanti',
          description: 'Inserisci simbolo e nome dell\'asset.',
          variant: 'destructive',
        });
        return;
      }
      
      mapping = {
        isin: current.isin,
        symbol: newSymbol.toUpperCase(),
        name: newAssetName,
        assetType: 'etf',
      };
    }

    // Save to DB
    await supabase.from('isin_mappings').upsert({
      user_id: userId,
      isin: mapping.isin,
      symbol: mapping.symbol,
      name: mapping.name,
      asset_type: mapping.assetType,
    });

    const newMappings = { ...isinMappings, [current.isin]: mapping };
    setIsinMappings(newMappings);
    
    // Reset form
    setNewSymbol('');
    setNewAssetName('');
    setSelectedExistingAsset('');
    setUseExisting(false);

    if (currentIsinIndex + 1 >= unknownIsins.length) {
      // Done with ISINs, proceed to transaction review
      if (manualTransactions.length > 0) {
        setCurrentIndex(0);
        setStep('review');
      } else {
        // Only investments and auto-imported
        const investmentTxs = transactions.filter(t => t.type === 'investment');
        executeImport(investmentTxs, newMappings, autoImportedTransactions, []);
      }
    } else {
      setCurrentIsinIndex(prev => prev + 1);
    }
  };

  const handleAccept = () => {
    if (!selectedCategory) {
      toast({
        title: 'Seleziona una categoria',
        description: 'Devi selezionare una categoria per accettare la transazione.',
        variant: 'destructive',
      });
      return;
    }

    // Save the category mapping for this description keyword
    const keyword = editedDescrizione.toLowerCase().trim();
    if (keyword) {
      setCategoryMappings(prev => ({
        ...prev,
        [keyword]: selectedCategory,
      }));
    }

    // Add to accepted transactions
    setAcceptedTransactions(prev => [
      ...prev,
      {
        ...currentTransaction,
        editedDescrizione: editedDescrizione,
        note: editedNote,
        categoryId: selectedCategory,
      },
    ]);

    moveToNext();
  };

  const handleDecline = () => {
    if (currentTransaction.descrizione) {
      setDeclinedDescriptions(prev => new Set(prev).add(currentTransaction.descrizione.toLowerCase()));
    }
    setSkippedCount(prev => prev + 1);
    moveToNext();
  };

  const moveToNext = () => {
    let nextIndex = currentIndex + 1;
    
    // Skip transactions that match declined descriptions
    while (nextIndex < manualTransactions.length) {
      const next = manualTransactions[nextIndex];
      if (next.descrizione && declinedDescriptions.has(next.descrizione.toLowerCase())) {
        setSkippedCount(prev => prev + 1);
        nextIndex++;
      } else {
        break;
      }
    }

    if (nextIndex >= manualTransactions.length) {
      // All done, start importing
      const investmentTxs = transactions.filter(t => t.type === 'investment');
      executeImport(investmentTxs, isinMappings, autoImportedTransactions, acceptedTransactions);
    } else {
      setCurrentIndex(nextIndex);
    }
  };

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

    // Save new category mappings to database (SHARED - source = 'shared')
    for (const [keyword, categoryId] of Object.entries(categoryMappings)) {
      await supabase.from('category_mappings').upsert({
        user_id: userId,
        description: keyword,
        category_id: categoryId,
        source: 'shared', // Shared across all imports
      }, {
        onConflict: 'user_id,description,source',
      });
    }

    // Import investments
    for (const tx of investmentTxs) {
      if (tx.isin) {
        const mapping = isinMap[tx.isin];
        if (mapping) {
          const existingAsset = assets.find(a => 
            a.symbol?.toUpperCase() === mapping.symbol.toUpperCase()
          );

          if (!existingAsset) {
            await createAsset.mutateAsync({
              name: mapping.name,
              symbol: mapping.symbol,
              type: mapping.assetType as 'etf' | 'stock' | 'crypto' | 'bond' | 'cash' | 'real_estate' | 'other',
              quantity: 1,
              purchase_price: tx.amount,
              purchase_date: tx.date,
              notes: `Importato da Trade Republic - ISIN: ${tx.isin}`,
            });
          }
          investmentCount++;
        }
      }
      processed++;
      setImportProgress((processed / total) * 100);
    }

    // Import regular transactions
    for (const tx of allRegularTxs) {
      const description = tx.note 
        ? `${tx.editedDescrizione} - ${tx.note}` 
        : tx.editedDescrizione;

      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        type: tx.type as 'income' | 'expense',
        amount: tx.amount,
        currency: 'EUR',
        category_id: tx.categoryId,
        description,
        date: tx.date,
      });

      if (!error) {
        transactionCount++;
      }
      processed++;
      setImportProgress((processed / total) * 100);
    }

    setImportedCount({ transactions: transactionCount, investments: investmentCount });
    setStep('complete');
  };

  const handleClose = () => {
    setStep('upload');
    setTransactions([]);
    setManualTransactions([]);
    setAutoImportedTransactions([]);
    setIsinMappings({});
    setUnknownIsins([]);
    setCurrentIsinIndex(0);
    setCurrentIndex(0);
    setDeclinedDescriptions(new Set());
    setCategoryMappings({});
    setAcceptedTransactions([]);
    setImportProgress(0);
    setImportedCount({ transactions: 0, investments: 0 });
    setSkippedCount(0);
    setAutoImportedCount(0);
    setEditedDescrizione('');
    setEditedNote('');
    setSelectedCategory('');
    setNewSymbol('');
    setNewAssetName('');
    setSelectedExistingAsset('');
    setUseExisting(false);
    onOpenChange(false);
  };

  const currentIsin = unknownIsins[currentIsinIndex];
  const availableCategories = currentTransaction?.type === 'income' ? incomeCategories : expenseCategories;
  const progress = manualTransactions.length > 0 ? ((currentIndex + 1) / manualTransactions.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importa da Trade Republic</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Carica il tuo estratto conto Trade Republic in formato CSV.'}
            {step === 'review-isins' && `Associa ISIN a ticker (${currentIsinIndex + 1}/${unknownIsins.length})`}
            {step === 'review' && `Revisiona le transazioni (${currentIndex + 1}/${manualTransactions.length})${autoImportedCount > 0 ? ` - ${autoImportedCount} automatiche` : ''}`}
            {step === 'importing' && 'Importazione in corso...'}
            {step === 'complete' && 'Importazione completata!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full h-32 flex flex-col items-center justify-center gap-2 border-dashed"
            >
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
              <span>Clicca per caricare il file</span>
              <span className="text-xs text-muted-foreground">CSV o Excel</span>
            </Button>
          </div>
        )}

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
                <Button
                  variant={!useExisting ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseExisting(false)}
                >
                  Crea nuovo
                </Button>
                <Button
                  variant={useExisting ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseExisting(true)}
                  disabled={assets.length === 0}
                >
                  Usa esistente
                </Button>
              </div>

              {!useExisting ? (
                <>
                  <div className="space-y-2">
                    <Label>Simbolo (Ticker)</Label>
                    <Input
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                      placeholder="es. VWCE"
                    />
                    {newSymbol && assets.some(a => a.symbol?.toUpperCase() === newSymbol.toUpperCase()) && (
                      <p className="text-xs text-yellow-500 flex items-center gap-1">
                        ⚠️ Esiste già un asset con questo simbolo
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Asset</Label>
                    <Input
                      value={newAssetName}
                      onChange={(e) => setNewAssetName(e.target.value)}
                      placeholder="es. Vanguard FTSE All-World"
                      defaultValue={currentIsin.name}
                    />
                    {newAssetName && assets.some(a => a.name.toLowerCase() === newAssetName.toLowerCase()) && (
                      <p className="text-xs text-yellow-500 flex items-center gap-1">
                        ⚠️ Esiste già un asset con questo nome
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Asset esistente</Label>
                  <Select value={selectedExistingAsset} onValueChange={setSelectedExistingAsset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets
                        .filter((asset, index, self) => 
                          asset.symbol 
                            ? index === self.findIndex(a => a.symbol?.toUpperCase() === asset.symbol?.toUpperCase())
                            : index === self.findIndex(a => a.name === asset.name)
                        )
                        .map((asset) => (
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

        {step === 'review' && currentTransaction && (
          <div className="space-y-4">
            <Progress value={progress} className="h-2" />

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Data</span>
                <span className="font-medium">{currentTransaction.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tipo originale</span>
                <span className="text-sm truncate max-w-[200px]" title={currentTransaction.tipo}>
                  {currentTransaction.tipo}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Descrizione originale</span>
                <span className="text-sm truncate max-w-[200px]" title={currentTransaction.descrizione}>
                  {currentTransaction.descrizione}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Importo</span>
                <span className={`font-bold ${currentTransaction.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                  €{currentTransaction.amount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrizione (modificabile)</Label>
              <Input
                value={editedDescrizione}
                onChange={(e) => setEditedDescrizione(e.target.value)}
                placeholder="Descrizione transazione"
              />
            </div>

            <div className="space-y-2">
              <Label>Note (opzionale)</Label>
              <Input
                value={editedNote}
                onChange={(e) => setEditedNote(e.target.value)}
                placeholder="Note aggiuntive"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        {step === 'importing' && (
          <div className="space-y-4 py-4">
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-muted-foreground">
              Importazione in corso... {Math.round(importProgress)}%
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Importazione completata!</p>
              <p className="text-sm text-muted-foreground">
                {importedCount.transactions} transazioni, {importedCount.investments} investimenti
                {skippedCount > 0 && `, ${skippedCount} saltate`}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Chiudi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
