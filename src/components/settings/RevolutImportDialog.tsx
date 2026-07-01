import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { validateImportFile } from '@/lib/importFileSecurity';
import { parseCsvObjects } from '@/lib/csv';

interface RevolutImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface RevolutTransaction {
  Type: string;
  Product: string;
  'Started Date': string;
  'Completed Date': string;
  Description: string;
  Amount: string;
  Fee: string;
  Currency: string;
  State: string;
  Balance: string;
}

interface PendingTransaction {
  description: string;
  amount: number;
  date: string;
  categoryId?: string;
}

export default function RevolutImportDialog({ open, onOpenChange, userId }: RevolutImportDialogProps) {
  const { toast } = useToast();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'categorize' | 'complete'>('upload');
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const expenseCategories = categories.filter(c => c.type === 'expense');

  const resetState = () => {
    setStep('upload');
    setPendingTransactions([]);
    setCategoryMappings({});
    setCurrentIndex(0);
    setImportedCount(0);
    setFailedCount(0);
    setSkippedCount(0);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Allow re-uploading the same file
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (categoriesLoading || expenseCategories.length === 0) {
      toast({
        title: 'Categorie mancanti',
        description: 'Crea almeno una categoria di uscita prima di importare da Revolut.',
        variant: 'destructive',
      });
      return;
    }

    try {
      validateImportFile(file);
    } catch (error) {
      toast({
        title: 'File non valido',
        description: error instanceof Error ? error.message : 'Il file selezionato non e valido.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const rows = parseCsvObjects(await file.text()) as unknown as RevolutTransaction[];

      // Filter only Card Payment transactions with COMPLETED state
      const cardPayments = rows.filter(
        row => row.Type === 'Card Payment' && row.State === 'COMPLETED'
      );

      if (cardPayments.length === 0) {
        toast({
          title: 'Nessuna transazione',
          description: 'Nessun pagamento con carta trovato nel file',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      // Load existing category mappings
      const { data: existingMappings } = await supabase
        .from('category_mappings')
        .select('description, category_id')
        .eq('user_id', userId)
        .eq('source', 'revolut');

      const mappingsMap: Record<string, string> = {};
      existingMappings?.forEach(m => {
        mappingsMap[m.description.toLowerCase()] = m.category_id!;
      });

      // Check for existing transactions to avoid duplicates
      const { data: existingTransactions } = await supabase
        .from('transactions')
        .select('description, date, amount')
        .eq('user_id', userId);

      const existingKeys = new Set(
        existingTransactions?.map(t => `${t.description}|${t.date}|${Math.abs(Number(t.amount))}`) || []
      );

      const pending: PendingTransaction[] = [];
      let skipped = 0;

      for (const row of cardPayments) {
        const description = row.Description;
        const amount = Math.abs(Number(row.Amount));
        const dateValue = row['Completed Date'];
        
        // Handle date from Revolut CSV
        let date: string;
        if (!dateValue) {
          date = new Date().toISOString().split('T')[0];
        } else {
          date = dateValue.split(' ')[0];
        }
        
        // Check for duplicate
        const key = `${description}|${date}|${amount}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        const existingCategory = mappingsMap[description.toLowerCase()];
        pending.push({
          description,
          amount,
          date,
          categoryId: existingCategory,
        });
      }

      setSkippedCount(skipped);
      setPendingTransactions(pending);
      setCategoryMappings(mappingsMap);

      toast({
        title: 'File Revolut letto',
        description: `${cardPayments.length} Card Payment • ${pending.length} nuove • ${skipped} duplicate`,
      });

      if (pending.length === 0) {
        toast({
          title: 'Nessuna nuova transazione',
          description: `${skipped} transazioni già presenti sono state saltate`,
        });
        setIsProcessing(false);
        return;
      }

      // Find first transaction without a category
      const firstUncategorized = pending.findIndex(t => !t.categoryId);
      if (firstUncategorized === -1) {
        // All have categories, proceed to import
        await importAllTransactions(pending);
      } else {
        setCurrentIndex(firstUncategorized);
        setStep('categorize');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante la lettura del file',
        variant: 'destructive',
      });
    }

    setIsProcessing(false);
  };

  const handleCategorySelect = async (categoryId: string) => {
    const current = pendingTransactions[currentIndex];
    
    // Update the pending transaction
    const updated = [...pendingTransactions];
    updated[currentIndex].categoryId = categoryId;
    setPendingTransactions(updated);

    // Save the mapping
    const descLower = current.description.toLowerCase();
    const nextMappings = { ...categoryMappings, [descLower]: categoryId };

    if (!categoryMappings[descLower]) {
      await supabase.from('category_mappings').upsert({
        user_id: userId,
        description: current.description,
        category_id: categoryId,
        source: 'revolut',
      }, { onConflict: 'user_id,description,source' });
    }

    setCategoryMappings(nextMappings);

    // Find next uncategorized transaction
    let nextIndex = -1;
    for (let i = currentIndex + 1; i < updated.length; i++) {
      if (!updated[i].categoryId) {
        // Check if we have a mapping for this description
        const mapping = nextMappings[updated[i].description.toLowerCase()];
        if (mapping) {
          updated[i].categoryId = mapping;
        } else {
          nextIndex = i;
          break;
        }
      }
    }

    if (nextIndex === -1) {
      // All categorized, import
      await importAllTransactions(updated);
    } else {
      setPendingTransactions(updated);
      setCurrentIndex(nextIndex);
    }
  };

  const importAllTransactions = async (transactions: PendingTransaction[]) => {
    setIsProcessing(true);
    let imported = 0;
    let failed = 0;

    for (const t of transactions) {
      if (!t.categoryId) {
        failed++;
        continue;
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        type: 'expense',
        amount: t.amount,
        currency: 'EUR',
        description: t.description,
        date: t.date,
        category_id: t.categoryId,
      });

      if (error) {
        failed++;
      } else {
        imported++;
      }
    }

    setImportedCount(imported);
    setFailedCount(failed);
    setStep('complete');
    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ['transactions'] });

    toast({
      title: 'Import completato',
      description: `${imported} importate${failed > 0 ? `, ${failed} fallite` : ''}${skippedCount > 0 ? `, ${skippedCount} duplicate saltate` : ''}`,
      variant: imported === 0 ? 'destructive' : 'default',
    });
  };

  const currentTransaction = pendingTransactions[currentIndex];
  const uncategorizedCount = pendingTransactions.filter(t => !t.categoryId).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importa da Revolut</DialogTitle>
          <DialogDescription>
            Importa solo transazioni di tipo "Card Payment" dal file CSV Revolut.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Carica il file CSV esportato da Revolut. Verranno importati solo i pagamenti con carta (Card Payment).
            </p>
            <div>
              <Label>File Revolut</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </div>
            {isProcessing && (
              <div className="text-center text-muted-foreground">
                Elaborazione in corso...
              </div>
            )}
          </div>
        )}

        {step === 'categorize' && currentTransaction && (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="font-medium">{currentTransaction.description}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(currentTransaction.date).toLocaleDateString('it-IT')} • €{currentTransaction.amount.toFixed(2)}
              </p>
            </div>
            
            <div className="text-sm text-muted-foreground text-center">
              {currentIndex + 1} di {pendingTransactions.length} • {uncategorizedCount} da categorizzare
            </div>

            <div>
              <Label>Seleziona categoria</Label>
              <Select onValueChange={handleCategorySelect} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli una categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isProcessing && (
              <div className="text-center text-muted-foreground">
                Importazione in corso...
              </div>
            )}
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-6 space-y-4">
            <CheckCircle className="w-16 h-16 mx-auto text-success" />
            <div>
              <h3 className="text-lg font-medium">Import Completato!</h3>
              <p className="text-muted-foreground">
                {importedCount} transazioni importate
                {skippedCount > 0 && `, ${skippedCount} duplicate saltate`}
                {failedCount > 0 && `, ${failedCount} fallite`}
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
