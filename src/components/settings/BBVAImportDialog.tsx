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
import { Check, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BBVAImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface BBVATransaction {
  date: string;
  nota: string;
  amount: number;
  isIncome: boolean;
}

interface AutoImportTransaction extends BBVATransaction {
  categoryId: string;
  editedNota: string;
}

type ImportStep = 'upload' | 'review' | 'importing' | 'complete';

export default function BBVAImportDialog({ open, onOpenChange, userId }: BBVAImportDialogProps) {
  const { toast } = useToast();
  const { categories, refetch: refetchCategories } = useCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [transactions, setTransactions] = useState<BBVATransaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [declinedNotes, setDeclinedNotes] = useState<Set<string>>(new Set());
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
  const [dbCategoryMappings, setDbCategoryMappings] = useState<Record<string, { categoryId: string; keyword: string }>>({});
  const [editedNota, setEditedNota] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [acceptedTransactions, setAcceptedTransactions] = useState<Array<BBVATransaction & { categoryId: string; editedNota: string }>>([]);
  const [autoImportedTransactions, setAutoImportedTransactions] = useState<AutoImportTransaction[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [autoImportedCount, setAutoImportedCount] = useState(0);
  const [dividendiCategoryId, setDividendiCategoryId] = useState<string | null>(null);

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  const incomeCategories = categories?.filter(c => c.type === 'income') || [];

  const currentTransaction = transactions[currentIndex];

  // Create Dividendi category if it doesn't exist
  const ensureDividendiCategory = async (): Promise<string | null> => {
    // First check in current categories
    const existing = incomeCategories.find(c => c.name.toLowerCase() === 'dividendi');
    if (existing) {
      return existing.id;
    }

    // Create it
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

    // Refetch categories to update the list
    refetchCategories();
    
    return data?.id || null;
  };

  // Load existing category mappings from database (SHARED across all banks)
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
            // Store lowercase for matching
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

  useEffect(() => {
    if (currentTransaction) {
      setEditedNota(currentTransaction.nota || '');
      // Check if we have a saved mapping for this nota
      const savedMapping = categoryMappings[currentTransaction.nota.toLowerCase()];
      setSelectedCategory(savedMapping || '');
    }
  }, [currentIndex, currentTransaction, categoryMappings]);

  const parseAmount = (value: string | number): number => {
    if (typeof value === 'number') return value;
    // Handle Italian number format (1.234,56 -> 1234.56)
    const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  // Find matching category from database mappings
  const findMatchingCategory = (nota: string): { categoryId: string; keyword: string } | null => {
    const notaLower = nota.toLowerCase();
    
    for (const [keyword, mapping] of Object.entries(dbCategoryMappings)) {
      if (notaLower.includes(keyword)) {
        return mapping;
      }
    }
    return null;
  };

  // Check for BBVA interest transaction
  const isBBVAInterest = (nota: string): boolean => {
    return nota.toUpperCase().includes('SPESE ACCREDITO') && 
           nota.toUpperCase().includes('A FRONTE DEL SALDO MENSILE');
  };

  // Check for excluded transaction
  const isExcludedTransaction = (nota: string): boolean => {
    return nota.toUpperCase().includes('SPORT. AUT.');
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
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

      // Find header row
      const headerRowIndex = rows.findIndex(row => 
        row.some(cell => cell?.toString().toLowerCase().includes('nota') || 
                        cell?.toString().toLowerCase().includes('importo'))
      );

      if (headerRowIndex === -1) {
        toast({
          title: 'Formato non valido',
          description: 'Il file non sembra essere un estratto conto BBVA.',
          variant: 'destructive',
        });
        return;
      }

      const headers = rows[headerRowIndex].map(h => h?.toString().toLowerCase().trim() || '');
      const dateIndex = headers.findIndex(h => h.includes('data'));
      const notaIndex = headers.findIndex(h => h.includes('nota'));
      const importoIndex = headers.findIndex(h => h.includes('importo'));

      const manualReview: BBVATransaction[] = [];
      const autoImported: AutoImportTransaction[] = [];
      let excluded = 0;

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const nota = row[notaIndex]?.toString().trim() || '';
        
        // Skip "TRASFERIMENTO" transactions
        if (nota.toUpperCase().includes('TRASFERIMENTO')) {
          continue;
        }

        // Skip "SPORT. AUT." transactions
        if (isExcludedTransaction(nota)) {
          excluded++;
          continue;
        }

        const amountRaw = row[importoIndex];
        const amount = parseAmount(amountRaw);
        if (amount === 0) continue;

        let dateValue = row[dateIndex];
        let dateStr = '';
        
        if (dateValue) {
          if (typeof dateValue === 'number') {
            // Excel serial date
            const date = new Date((dateValue - 25569) * 86400 * 1000);
            dateStr = date.toISOString().split('T')[0];
          } else {
            // Try to parse as date string (YYYY-MM-DD or DD/MM/YYYY)
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

        const isIncome = amount > 0;
        const transaction: BBVATransaction = {
          date: dateStr,
          nota,
          amount: Math.abs(amount),
          isIncome,
        };

        // Check for BBVA interest - auto import as Dividendi
        if (isBBVAInterest(nota) && dividendiId) {
          autoImported.push({
            ...transaction,
            categoryId: dividendiId,
            editedNota: 'Interessi BBVA',
          });
          continue;
        }

        // Check for matching category from database
        const matchingCategory = findMatchingCategory(nota);
        if (matchingCategory) {
          autoImported.push({
            ...transaction,
            categoryId: matchingCategory.categoryId,
            editedNota: matchingCategory.keyword,
          });
          continue;
        }

        // Needs manual review
        manualReview.push(transaction);
      }

      if (manualReview.length === 0 && autoImported.length === 0) {
        toast({
          title: 'Nessuna transazione',
          description: 'Non ho trovato transazioni valide nel file.',
          variant: 'destructive',
        });
        return;
      }

      setTransactions(manualReview);
      setAutoImportedTransactions(autoImported);
      setCurrentIndex(0);
      setDeclinedNotes(new Set());
      setCategoryMappings({});
      setAcceptedTransactions([]);
      setAutoImportedCount(autoImported.length);

      if (manualReview.length === 0) {
        // All transactions were auto-imported, go straight to import
        setStep('importing');
        executeImportDirect(autoImported, []);
      } else {
        setStep('review');
      }

      const autoMsg = autoImported.length > 0 ? `, ${autoImported.length} automatiche` : '';
      const excludedMsg = excluded > 0 ? `, ${excluded} escluse` : '';
      
      toast({
        title: 'File caricato',
        description: `${manualReview.length} da revisionare${autoMsg}${excludedMsg}.`,
      });
    } catch (error) {
      console.error('BBVA import error:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile leggere il file.',
        variant: 'destructive',
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

    // Save the category mapping for this nota keyword (use editedNota as keyword)
    const keyword = editedNota.toLowerCase().trim();
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
        editedNota: editedNota,
        categoryId: selectedCategory,
      },
    ]);

    moveToNext();
  };

  const handleDecline = () => {
    // Add the nota to declined set for auto-decline
    if (currentTransaction.nota) {
      setDeclinedNotes(prev => new Set(prev).add(currentTransaction.nota.toLowerCase()));
    }
    setSkippedCount(prev => prev + 1);
    moveToNext();
  };

  const moveToNext = () => {
    let nextIndex = currentIndex + 1;
    
    // Skip transactions that match declined notes
    while (nextIndex < transactions.length) {
      const next = transactions[nextIndex];
      if (next.nota && declinedNotes.has(next.nota.toLowerCase())) {
        setSkippedCount(prev => prev + 1);
        nextIndex++;
      } else {
        break;
      }
    }

    if (nextIndex >= transactions.length) {
      // All done, start importing
      executeImport();
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const executeImportDirect = async (autoTx: AutoImportTransaction[], manualTx: Array<BBVATransaction & { categoryId: string; editedNota: string }>) => {
    const allTransactions = [...autoTx, ...manualTx];
    const total = allTransactions.length;
    let imported = 0;

    for (const tx of allTransactions) {
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        type: tx.isIncome ? 'income' : 'expense',
        amount: tx.amount,
        currency: 'EUR',
        category_id: tx.categoryId,
        description: tx.editedNota,
        date: tx.date,
      });

      if (!error) {
        imported++;
      }

      setImportProgress(((imported) / total) * 100);
    }

    setImportedCount(imported);
    setStep('complete');
  };

  const executeImport = async () => {
    setStep('importing');
    setImportProgress(0);

    const allTransactions = [...autoImportedTransactions, ...acceptedTransactions];
    const total = allTransactions.length;
    let imported = 0;

    // Save new category mappings to database (SHARED across all banks)
    for (const [keyword, categoryId] of Object.entries(categoryMappings)) {
      await supabase.from('category_mappings').upsert({
        user_id: userId,
        description: keyword,
        category_id: categoryId,
        source: 'shared',
      }, {
        onConflict: 'user_id,description,source',
      });
    }

    for (const tx of allTransactions) {
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        type: tx.isIncome ? 'income' : 'expense',
        amount: tx.amount,
        currency: 'EUR',
        category_id: tx.categoryId,
        description: tx.editedNota,
        date: tx.date,
      });

      if (!error) {
        imported++;
      }

      setImportProgress(((imported) / total) * 100);
    }

    setImportedCount(imported);
    setStep('complete');
  };

  const handleClose = () => {
    setStep('upload');
    setTransactions([]);
    setCurrentIndex(0);
    setDeclinedNotes(new Set());
    setCategoryMappings({});
    setAcceptedTransactions([]);
    setAutoImportedTransactions([]);
    setImportProgress(0);
    setImportedCount(0);
    setSkippedCount(0);
    setAutoImportedCount(0);
    setEditedNota('');
    setSelectedCategory('');
    onOpenChange(false);
  };

  const availableCategories = currentTransaction?.isIncome ? incomeCategories : expenseCategories;
  const progress = transactions.length > 0 ? ((currentIndex + 1) / transactions.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importa da BBVA</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Carica il tuo estratto conto BBVA in formato CSV o Excel.'}
            {step === 'review' && `Revisiona le transazioni (${currentIndex + 1}/${transactions.length})${autoImportedCount > 0 ? ` - ${autoImportedCount} automatiche` : ''}`}
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
                <span className={`font-bold ${currentTransaction.isIncome ? 'text-green-500' : 'text-red-500'}`}>
                  {currentTransaction.isIncome ? '+' : '-'}€{currentTransaction.amount.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Nota originale:</span>
                <p className="text-xs mt-1 break-all">{currentTransaction.nota}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nota (diventerà il mapping per transazioni future)</Label>
              <Input
                value={editedNota}
                onChange={(e) => setEditedNota(e.target.value)}
                placeholder="Parola chiave per questa transazione"
              />
              <p className="text-xs text-muted-foreground">
                Le future transazioni che contengono questa parola saranno importate automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              {availableCategories.length > 0 ? (
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
              ) : (
                <p className="text-sm text-muted-foreground">Caricamento categorie...</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={handleDecline}
              >
                <X className="w-4 h-4 mr-2" />
                Rifiuta
              </Button>
              <Button 
                className="flex-1"
                onClick={handleAccept}
                disabled={!selectedCategory}
              >
                <Check className="w-4 h-4 mr-2" />
                Accetta
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Se rifiuti, tutte le transazioni future con la stessa nota saranno rifiutate automaticamente.
            </p>
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
                {importedCount} transazioni importate{autoImportedCount > 0 ? ` (${autoImportedCount} automatiche)` : ''}, {skippedCount} ignorate
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
