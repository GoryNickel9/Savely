import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TrendingUp, TrendingDown, Briefcase, ArrowLeft, Check, AlertTriangle, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateImportFile } from '@/lib/importFileSecurity';
import { parseCsvObjects } from '@/lib/csv';

type ImportType = 'income' | 'expense' | 'investment';
type ImportStep = 'select-type' | 'preview-categories' | 'resolve-duplicates' | 'importing';

interface NewCategory {
  name: string;
  icon: string;
  color: string;
  mappedTo?: string; // ID of existing category to map to
}

interface ExistingCategory {
  id: string;
  name: string;
  icon: string | null;
}

interface DuplicateTransaction {
  csvRow: Record<string, unknown>;
  existing: {
    id: string;
    amount: number;
    date: string;
    description: string | null;
    category_name: string | null;
  };
  keep: 'existing' | 'new' | 'both';
}

interface ImportProgress {
  current: number;
  total: number;
  status: string;
}

const DEFAULT_ICONS_INCOME = ['💰', '💵', '📈', '💳', '🏦', '💎', '🎯', '🎁'];
const DEFAULT_ICONS_EXPENSE = ['💸', '🛒', '🍔', '🚗', '🏠', '💊', '🎬', '📦'];
const DEFAULT_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', 
  '#ef4444', '#ec4899', '#14b8a6', '#6b7280'
];

interface SpendyImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export default function SpendyImportDialog({ open, onOpenChange, userId }: SpendyImportDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<ImportStep>('select-type');
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [newCategories, setNewCategories] = useState<NewCategory[]>([]);
  const [existingCategories, setExistingCategories] = useState<ExistingCategory[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateTransaction[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Helper to parse numbers (supports both Italian and English formats)
  const parseItalianNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const str = String(value).trim();
    
    // Check if it's Italian format (has comma as decimal separator)
    if (str.includes(',')) {
      // Italian format: dot as thousands separator, comma as decimal separator
      const normalized = str.replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized) || 0;
    } else {
      // English format: dot as decimal separator
      return parseFloat(str) || 0;
    }
  };

  // Helper to clean BOM and normalize column names
  const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.replace(/^\uFEFF/, '').trim();
      cleaned[cleanKey] = row[key];
    }
    return cleaned;
  };

  // Legacy CSV exports can contain numeric date serials (e.g. 45444.08)
  const normalizeDate = (value: unknown): string => {
    const fallback = new Date().toISOString().slice(0, 10);
    
    const s = String(value ?? '').trim();
    if (!s) return fallback;
    
    // Keep YYYY-MM-DD as-is (this should be checked first!)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    
    // Handle DD/MM/YYYY format (Italian date format)
    const italianDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (italianDateMatch) {
      const [, day, month, year] = italianDateMatch;
      const date = new Date(`${year}-${month}-${day}`);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
    
    // If it's a numeric date serial, convert it
    if (typeof value === 'number' && Number.isFinite(value)) {
      // Spreadsheet serial epoch: 1899-12-30
      const excelEpoch = Date.UTC(1899, 11, 30);
      const days = Math.floor(value);
      const date = new Date(excelEpoch + days * 86400000);
      return date.toISOString().slice(0, 10);
    }
    
    // If it's a numeric-like string, try parsing as a date serial
    const maybeNum = Number(s);
    if (Number.isFinite(maybeNum) && !s.includes('-')) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const days = Math.floor(maybeNum);
      const date = new Date(excelEpoch + days * 86400000);
      return date.toISOString().slice(0, 10);
    }
    
    // Last resort: Date parser
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    
    return fallback;
  };

  const checkForDuplicates = async (rows: Record<string, unknown>[], type: ImportType) => {
    if (type === 'investment') return [];

    // Get existing transactions
    const { data: existingTxs } = await supabase
      .from('transactions')
      .select('id, amount, date, description, category:categories(name)')
      .eq('user_id', userId)
      .eq('type', type);

    if (!existingTxs || existingTxs.length === 0) return [];

    const duplicatesFound: DuplicateTransaction[] = [];

    for (const row of rows) {
      const rowAmount = Number(row.importo) || 0;
      const rowDate = normalizeDate(row.data);
      const rowDesc = String(row.note || '');

      // Check for potential duplicates: same amount + date
      const match = existingTxs.find(tx => 
        Number(tx.amount) === rowAmount && 
        tx.date === rowDate
      );

      if (match) {
        duplicatesFound.push({
          csvRow: row,
          existing: {
            id: match.id,
            amount: Number(match.amount),
            date: match.date,
            description: match.description,
            category_name: (match.category as { name: string } | null)?.name || null,
          },
          keep: 'existing', // default to keep existing
        });
      }
    }

    return duplicatesFound;
  };

  const detectFileType = (rows: Record<string, unknown>[], fileName?: string): 'income' | 'expense' | 'investment' | null => {
    if (rows.length === 0) return null;
    
    // First, check filename pattern (Spendy Desktop naming convention)
    if (fileName) {
      const lowerFileName = fileName.toLowerCase();
      if (lowerFileName.startsWith('entrate_')) {
        return 'income';
      }
      if (lowerFileName.startsWith('spese_')) {
        return 'expense';
      }
      if (lowerFileName.startsWith('investimenti_')) {
        return 'investment';
      }
    }
    
    // Fallback: analyze content
    const firstRow = rows[0];
    const columns = Object.keys(firstRow).map(k => k.toLowerCase());
    
    // Check for investment CSV (Italian format)
    const investmentColumns = ['id', 'data', 'ticker', 'investito', 'valore_attuale', 'prezzo_carico', 'benchmark', 'data_vendita', 'prezzo_vendita'];
    const hasInvestmentColumns = investmentColumns.every(col =>
      columns.some(c => c.includes(col.toLowerCase()))
    );
    
    if (hasInvestmentColumns || columns.includes('ticker')) {
      return 'investment';
    }
    
    // Check for income/expense (Spendy Desktop format)
    const transactionColumns = ['data', 'importo', 'categoria', 'note'];
    const hasTransactionColumns = transactionColumns.some(col =>
      columns.includes(col.toLowerCase())
    );
    
    if (hasTransactionColumns) {
      // Try to determine if income or expense based on first amount
      const firstAmount = Number(firstRow.importo);
      if (firstAmount > 0) {
        return 'income';
      } else {
        return 'expense';
      }
    }
    
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      validateImportFile(file);

      const rawRows = parseCsvObjects(await file.text()) as Record<string, unknown>[];
      const rows = rawRows.map(cleanRow);

      console.log('Parsed rows:', rows.length, 'First row:', rows[0]);

      if (rows.length === 0) {
        toast({
          title: t('File vuoto'),
          description: t('Il file non contiene dati da importare.'),
          variant: 'destructive',
        });
        return;
      }

      // Auto-detect file type
      const detectedType = detectFileType(rows, file.name);

      if (!detectedType) {
        toast({
          title: t('Formato non riconosciuto'),
          description: t('Impossibile determinare il tipo di file. Verifica il formato.'),
          variant: 'destructive',
        });
        return;
      }

      setImportType(detectedType);
      setParsedRows(rows);

      if (detectedType === 'income' || detectedType === 'expense') {
        // Get unique categories from the file
        const uniqueCategories = [...new Set(rows.map(row => String(row.categoria || 'Altro')))];
        
        // Get existing categories with their IDs
        const { data: existingCats } = await supabase
          .from('categories')
          .select('id, name, icon')
          .eq('user_id', userId)
          .eq('type', detectedType);

        const existingCatsList = existingCats || [];
        setExistingCategories(existingCatsList);

        const existingNames = existingCatsList.map(c => c.name);

        // Find new categories
        const newCats = uniqueCategories
          .filter(name => !existingNames.includes(name))
          .map((name, index) => ({
            name,
            icon: detectedType === 'income'
              ? DEFAULT_ICONS_INCOME[index % DEFAULT_ICONS_INCOME.length]
              : DEFAULT_ICONS_EXPENSE[index % DEFAULT_ICONS_EXPENSE.length],
            color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
            mappedTo: undefined, // No mapping by default
          }));

        setNewCategories(newCats);

        // Check for duplicates
        const foundDuplicates = await checkForDuplicates(rows, detectedType);
        setDuplicates(foundDuplicates);

        setStep('preview-categories');
      } else {
        // For investments, go directly to import
        await executeImport(rows, [], []);
      }
    } catch (error) {
      console.error('File parse error:', error);
      toast({
        title: t('Errore lettura file'),
        description: t('Impossibile leggere il file. Verifica il formato.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateCategoryIcon = (index: number, icon: string) => {
    setNewCategories(prev => prev.map((cat, i) => 
      i === index ? { ...cat, icon } : cat
    ));
  };

  const updateCategoryColor = (index: number, color: string) => {
    setNewCategories(prev => prev.map((cat, i) => 
      i === index ? { ...cat, color } : cat
    ));
  };

  const updateCategoryMapping = (index: number, mappedTo: string | undefined) => {
    setNewCategories(prev => prev.map((cat, i) => 
      i === index ? { ...cat, mappedTo } : cat
    ));
  };

  const updateDuplicateChoice = (index: number, choice: 'existing' | 'new' | 'both') => {
    setDuplicates(prev => prev.map((dup, i) => 
      i === index ? { ...dup, keep: choice } : dup
    ));
  };

  const executeImport = async (
    rows: Record<string, unknown>[], 
    categoriesToCreate: NewCategory[],
    duplicatesToHandle: DuplicateTransaction[]
  ) => {
    if (!importType) return;

    setStep('importing');
    setImportProgress({ current: 0, total: rows.length, status: t('Preparazione...') });

    try {
      let importedCount = 0;
      const totalRows = rows.length;

      // Create set of duplicate row indices to skip or handle specially
      const duplicateRows = new Set(
        duplicatesToHandle
          .filter(d => d.keep === 'existing')
          .map(d => rows.indexOf(d.csvRow))
      );

      // Delete existing transactions that will be replaced
      const toDelete = duplicatesToHandle
        .filter(d => d.keep === 'new')
        .map(d => d.existing.id);

      if (toDelete.length > 0) {
        await supabase.from('transactions').delete().in('id', toDelete);
      }

      if (importType === 'income' || importType === 'expense') {
        const categoryMap = new Map<string, string>();

        // Create new categories (only those not mapped)
        setImportProgress({ current: 0, total: totalRows, status: t('Creazione categorie...') });
        for (const cat of categoriesToCreate) {
          if (cat.mappedTo) {
            // Use the mapped category
            categoryMap.set(cat.name, cat.mappedTo);
          } else {
            // Create new category
            const { data: newCat } = await supabase
              .from('categories')
              .insert({
                user_id: userId,
                name: cat.name,
                type: importType,
                icon: cat.icon,
                color: cat.color,
              })
              .select('id')
              .single();

            if (newCat) {
              categoryMap.set(cat.name, newCat.id);
            }
          }
        }

        // Get existing categories
        const { data: existingCats } = await supabase
          .from('categories')
          .select('id, name')
          .eq('user_id', userId)
          .eq('type', importType);

        existingCats?.forEach(cat => {
          if (!categoryMap.has(cat.name)) {
            categoryMap.set(cat.name, cat.id);
          }
        });

        // Import transactions
        for (let i = 0; i < rows.length; i++) {
          // Skip if we're keeping the existing duplicate
          if (duplicateRows.has(i)) {
            setImportProgress({
              current: i + 1,
              total: totalRows,
              status: t('Saltato duplicato... ({{current}}/{{total}})', { current: i + 1, total: totalRows })
            });
            continue;
          }

          const row = rows[i];
          const categoryName = String(row.categoria || 'Altro');
          const categoryId = categoryMap.get(categoryName);

          const { error } = await supabase.from('transactions').insert({
            user_id: userId,
            amount: parseItalianNumber(row.importo),
            type: importType,
            description: String(row.note || ''),
            date: normalizeDate(row.data),
            currency: 'EUR',
            category_id: categoryId || null,
          });

          if (!error) importedCount++;
          setImportProgress({
            current: i + 1,
            total: totalRows,
            status: t('Importazione transazioni... ({{current}}/{{total}})', { current: i + 1, total: totalRows })
          });
        }
      } else if (importType === 'investment') {
        // Fetch existing assets to check for duplicates
        const { data: existingAssets } = await supabase
          .from('portfolio_assets')
          .select('symbol, purchase_date, purchase_price, quantity')
          .eq('user_id', userId);
        
        // Create a Set for quick duplicate lookup (key: symbol|purchase_date|purchase_price|quantity)
        // Include quantity to allow same ticker/date/price with different amounts
        const existingKeys = new Set(
          (existingAssets || []).map(a => 
            `${(a.symbol || '').toLowerCase()}|${a.purchase_date}|${a.purchase_price}|${a.quantity}`
          )
        );
        
        let skippedDuplicates = 0;

        // New CSV format: id,data,ticker,investito,valore_attuale,prezzo_carico,benchmark,data_vendita,prezzo_vendita
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          
          // Parse values from the new CSV format using Italian number format
          const ticker = String(row.ticker || '').trim();
          const investito = parseItalianNumber(row.investito);
          const prezzoCarico = parseItalianNumber(row.prezzo_carico);
          const valoreAttuale = row.valore_attuale ? parseItalianNumber(row.valore_attuale) : null;
          const dataAcquisto = normalizeDate(row.data);
          
          // Log parsed values for debugging
          console.log(`Row ${i}:`, {
            ticker,
            investito,
            prezzoCarico,
            valoreAttuale,
            dataAcquisto,
            rawData: row.data
          });

          // Consider a position "sold" only if BOTH sale date and sale price are present.
          const rawDataVendita = String(row.data_vendita ?? '').trim();
          const rawPrezzoVendita = String(row.prezzo_vendita ?? '').trim();
          
          const prezzoVenditaNum = rawPrezzoVendita ? parseItalianNumber(rawPrezzoVendita) : Number.NaN;
          const prezzoVendita = Number.isFinite(prezzoVenditaNum) ? prezzoVenditaNum : null;
          const dataVendita = rawDataVendita && prezzoVendita !== null ? normalizeDate(rawDataVendita) : null;

          // Calculate quantity: investito / prezzo_carico
          const quantity = prezzoCarico > 0 ? investito / prezzoCarico : 0;
          
          // Check for duplicate: same ticker + purchase_date + purchase_price + quantity
          const key = `${ticker.toLowerCase()}|${dataAcquisto}|${prezzoCarico}|${quantity}`;
          if (existingKeys.has(key)) {
            skippedDuplicates++;
            setImportProgress({
              current: i + 1,
              total: totalRows,
              status: t('Importazione investimenti... ({{current}}/{{total}}) - Saltato duplicato', { current: i + 1, total: totalRows })
            });
            continue;
          }
          
          // Determine asset type from ticker
          let assetType: 'stock' | 'etf' | 'crypto' | 'bond' | 'cash' | 'real_estate' | 'other' = 'stock';
          if (ticker.includes('-EUR') || ticker.includes('-USD') || ticker.includes('BTC') || ticker.includes('ETH') || ticker.includes('DOT') || ticker.includes('BNB')) {
            assetType = 'crypto';
          } else if (ticker.includes('.MI') || ticker.includes('.DE') || ticker.includes('.PA')) {
            assetType = 'etf';
          }
          
          // Create the asset name from ticker
          const assetName = ticker || 'Investimento';
          
          const { error } = await supabase.from('portfolio_assets').insert({
            user_id: userId,
            name: assetName,
            symbol: ticker || null,
            type: assetType,
            quantity: quantity,
            purchase_price: prezzoCarico,
            current_price: valoreAttuale,
            purchase_date: dataAcquisto,
            sold_at: dataVendita,
            sold_price: prezzoVendita,
            notes: '',
          });

          if (!error) {
            importedCount++;
            // Add to existing keys to prevent duplicates within the same import
            existingKeys.add(key);
          }
          setImportProgress({
            current: i + 1,
            total: totalRows,
            status: t('Importazione investimenti... ({{current}}/{{total}})', { current: i + 1, total: totalRows })
          });
        }

        if (skippedDuplicates > 0) {
          toast({
            title: t('Duplicati rilevati'),
            description: t('{{count}} investimenti duplicati non sono stati importati.', { count: skippedDuplicates }),
          });
        }
      }

      const skipped = duplicatesToHandle.filter(d => d.keep === 'existing').length;
      toast({
        title: t('Import completato'),
        description: t('Importati {{count}} record{{skipped}}', { count: importedCount, skipped: skipped > 0 ? t(', saltati {{count}} duplicati', { count: skipped }) : '' }),
      });

      handleClose();
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: t('Errore import'),
        description: t('Si è verificato un errore durante l\'import.'),
        variant: 'destructive',
      });
      setStep('select-type');
      setImportProgress(null);
    }
  };

  const handleClose = () => {
    setStep('select-type');
    setImportType(null);
    setParsedRows([]);
    setNewCategories([]);
    setExistingCategories([]);
    setDuplicates([]);
    setImportProgress(null);
    onOpenChange(false);
  };

  const handleCategoriesConfirmed = () => {
    if (duplicates.length > 0) {
      setStep('resolve-duplicates');
    } else {
      executeImport(parsedRows, newCategories, []);
    }
  };

  const handleConfirmImport = () => {
    executeImport(parsedRows, newCategories, duplicates);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) handleClose();
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'select-type' && t('Importa Dati')}
            {step === 'preview-categories' && t('Anteprima categorie')}
            {step === 'resolve-duplicates' && t('Gestisci duplicati')}
            {step === 'importing' && t('Importazione in corso...')}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-type' && t('Carica un file CSV. Il sistema rileverà automaticamente il tipo di dati (entrate, uscite o investimenti).')}
            {step === 'preview-categories' && t('Verranno importate {{count}} transazioni. Configura le categorie.', { count: parsedRows.length })}
            {step === 'resolve-duplicates' && t('Trovati {{count}} possibili duplicati. Scegli quali tenere.', { count: duplicates.length })}
            {step === 'importing' && t('Attendere il completamento dell\'importazione.')}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {step === 'select-type' && (
          <div className="grid gap-4 py-4">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('Carica un file CSV. Il sistema rileverà automaticamente il tipo di dati.')}
              </p>
              <Button
                variant="default"
                className="h-16 text-lg w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Upload className="w-6 h-6 mr-3" />
                {isLoading ? t('Analisi file...') : t('Seleziona file')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('Formato supportato: CSV')}
              </p>
            </div>
          </div>
        )}

        {step === 'preview-categories' && (
          <div className="space-y-4">
            {/* Existing categories list */}
            {existingCategories.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground">{t('Categorie esistenti ({{count}})', { count: existingCategories.length })}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {existingCategories.map(cat => (
                    <span key={cat.id} className="px-2 py-1 bg-muted rounded-md text-sm flex items-center gap-1">
                      <Check className="w-3 h-3 text-green-500" />
                      {cat.icon} {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {newCategories.length > 0 ? (
              <div>
                <Label className="text-sm font-medium">{t('Nuove categorie ({{count}})', { count: newCategories.length })}</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('Puoi mappare a una categoria esistente o crearne una nuova.')}
                </p>
                <ScrollArea className="h-[300px] mt-2">
                  <div className="space-y-4 pr-4">
                    {newCategories.map((cat, index) => (
                      <div key={cat.name} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{cat.name}</div>
                        </div>

                        {/* Mapping dropdown */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('Associa a categoria')}</Label>
                          <Select 
                            value={cat.mappedTo || 'create-new'} 
                            onValueChange={(v) => updateCategoryMapping(index, v === 'create-new' ? undefined : v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="create-new">➕ {t('Crea nuova categoria')}</SelectItem>
                              {existingCategories.map(existing => (
                                <SelectItem key={existing.id} value={existing.id}>
                                  {existing.icon} {existing.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Only show icon/color picker if creating new */}
                        {!cat.mappedTo && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">{t('Icona')}</Label>
                              <div className="flex flex-wrap gap-2">
                                {(importType === 'income' ? DEFAULT_ICONS_INCOME : DEFAULT_ICONS_EXPENSE).map(icon => (
                                  <button
                                    key={icon}
                                    type="button"
                                    onClick={() => updateCategoryIcon(index, icon)}
                                    className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                                      cat.icon === icon 
                                        ? 'border-primary bg-primary/10' 
                                        : 'border-transparent hover:border-muted-foreground/30'
                                    }`}
                                  >
                                    {icon}
                                  </button>
                                ))}
                              </div>
                              <Input
                                value={cat.icon}
                                onChange={(e) => updateCategoryIcon(index, e.target.value)}
                                placeholder={t('Icona personalizzata')}
                                className="w-20"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">{t('Colore')}</Label>
                              <div className="flex flex-wrap gap-2">
                                {DEFAULT_COLORS.map(color => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => updateCategoryColor(index, color)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                                      cat.color === color 
                                        ? 'border-foreground scale-110' 
                                        : 'border-transparent hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              <Input
                                type="color"
                                value={cat.color}
                                onChange={(e) => updateCategoryColor(index, e.target.value)}
                                className="w-20 h-8 p-1"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                {t('Tutte le categorie esistono già. Procedi con l\'importazione.')}
              </p>
            )}

            {duplicates.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <span className="text-sm">{t('Trovati {{count}} possibili duplicati', { count: duplicates.length })}</span>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('select-type')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('Indietro')}
              </Button>
              <Button onClick={handleCategoriesConfirmed}>
                {duplicates.length > 0 ? t('Gestisci duplicati') : t('Importa {{count}} transazioni', { count: parsedRows.length })}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'resolve-duplicates' && (
          <div className="space-y-4">
            <ScrollArea className="h-[350px]">
              <div className="space-y-4 pr-4">
                {duplicates.map((dup, index) => (
                  <div key={`${dup.existing.id}-${index}`} className="p-4 border rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('Nel file CSV')}</Label>
                        <div className="mt-1">
                          <p className="font-medium">€{parseItalianNumber(dup.csvRow.importo).toFixed(2)}</p>
                          <p className="text-muted-foreground">{normalizeDate(dup.csvRow.data)}</p>
                          <p className="text-xs">{String(dup.csvRow.categoria || 'Altro')}</p>
                          {dup.csvRow.note && <p className="text-xs italic">{String(dup.csvRow.note)}</p>}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('Già presente')}</Label>
                        <div className="mt-1">
                          <p className="font-medium">€{dup.existing.amount.toFixed(2)}</p>
                          <p className="text-muted-foreground">{dup.existing.date}</p>
                          <p className="text-xs">{dup.existing.category_name || t('Senza categoria')}</p>
                          {dup.existing.description && <p className="text-xs italic">{dup.existing.description}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={dup.keep === 'existing' ? 'default' : 'outline'}
                        onClick={() => updateDuplicateChoice(index, 'existing')}
                      >
                        {t('Tieni esistente')}
                      </Button>
                      <Button
                        size="sm"
                        variant={dup.keep === 'new' ? 'default' : 'outline'}
                        onClick={() => updateDuplicateChoice(index, 'new')}
                      >
                        {t('Sostituisci con nuovo')}
                      </Button>
                      <Button
                        size="sm"
                        variant={dup.keep === 'both' ? 'default' : 'outline'}
                        onClick={() => updateDuplicateChoice(index, 'both')}
                      >
                        {t('Tieni entrambi')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('preview-categories')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('Indietro')}
              </Button>
              <Button onClick={handleConfirmImport}>
                {t('Conferma e importa')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && importProgress && (
          <div className="py-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">{importProgress.status}</p>
              <Progress 
                value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0} 
                className="h-3"
              />
              <p className="text-lg font-semibold mt-2">
                {importProgress.current} / {importProgress.total}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
