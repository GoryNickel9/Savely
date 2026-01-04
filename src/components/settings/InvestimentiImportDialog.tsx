import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InvestimentiImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface CSVRow {
  id: string;
  data: string;
  ticker: string;
  investito: string;
  valore_attuale: string;
  prezzo_carico: string;
  benchmark: string;
  data_vendita: string;
  prezzo_vendita: string;
}

export function InvestimentiImportDialog({
  open,
  onOpenChange,
  userId,
}: InvestimentiImportDialogProps) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: number;
    details: string[];
  } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: 'File vuoto',
          description: 'Il file CSV non contiene dati',
          variant: 'destructive',
        });
        return;
      }

      // Parse CSV
      const headers = lines[0].split(',').map(h => h.trim());
      const rows: CSVRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });
          rows.push(row as CSVRow);
        }
      }

      setPreviewData(rows.slice(0, 10)); // Show first 10 rows as preview
      setImportResults(null);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast({
        title: 'Errore di parsing',
        description: 'Impossibile leggere il file CSV',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      toast({
        title: 'Nessun dato da importare',
        description: 'Carica prima un file CSV',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    const results = {
      success: 0,
      errors: 0,
      details: [] as string[],
    };

    try {
      // Read full file again to get all rows
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (!fileInput.files?.[0]) return;

      const text = await fileInput.files[0].text();
      const lines = text.split('\n').filter(line => line.trim());
      
      const headers = lines[0].split(',').map(h => h.trim());
      const allRows: CSVRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });
          allRows.push(row as CSVRow);
        }
      }

      // Import each row
      for (const row of allRows) {
        try {
          // Determine asset type based on ticker
          let assetType: 'stock' | 'etf' | 'crypto' | 'bond' | 'cash' | 'real_estate' | 'other' = 'stock';
          const ticker = row.ticker.toUpperCase();
          
          if (ticker.includes('-EUR') || ticker.includes('-USD') || ticker.includes('BTC') || ticker.includes('ETH')) {
            assetType = 'crypto';
          } else if (ticker.endsWith('.MI') || ticker.endsWith('.DE') || ticker.endsWith('.L')) {
            assetType = 'stock';
          } else if (ticker.includes('ETF') || ticker.includes('VWCE') || ticker.includes('SWDA')) {
            assetType = 'etf';
          }

          // Parse values
          const quantity = parseFloat(row.investito) || 0;
          const purchasePrice = parseFloat(row.prezzo_carico) || 0;
          const currentPrice = row.valore_attuale ? parseFloat(row.valore_attuale) : null;
          const soldPrice = row.prezzo_vendita ? parseFloat(row.prezzo_vendita) : null;

          // Determine asset name from ticker
          let assetName = ticker;
          if (ticker.includes('BTC')) assetName = 'Bitcoin';
          else if (ticker.includes('ETH')) assetName = 'Ethereum';
          else if (ticker.includes('DOT')) assetName = 'Polkadot';
          else if (ticker.includes('BNB')) assetName = 'Binance Coin';
          else if (ticker.includes('XEON')) assetName = 'Xeon';

          const assetData: any = {
            user_id: userId,
            name: assetName,
            symbol: ticker,
            type: assetType,
            quantity: quantity,
            purchase_price: purchasePrice,
            purchase_date: row.data,
          };

          // Add current price if available
          if (currentPrice && !isNaN(currentPrice)) {
            assetData.current_price = currentPrice;
          }

          // Add sold data if available
          if (row.data_vendita && soldPrice && !isNaN(soldPrice)) {
            assetData.sold_at = row.data_vendita;
            assetData.sold_price = soldPrice;
          }

          const { error } = await supabase.from('portfolio_assets').insert(assetData);

          if (error) {
            results.errors++;
            results.details.push(`Errore riga ${row.id}: ${error.message}`);
          } else {
            results.success++;
          }
        } catch (error) {
          results.errors++;
          results.details.push(`Errore riga ${row.id}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
        }
      }

      setImportResults(results);

      if (results.success > 0) {
        toast({
          title: 'Import completato',
          description: `Importati ${results.success} investimenti con successo`,
        });
      }

      if (results.errors > 0) {
        toast({
          title: 'Alcuni errori',
          description: `${results.errors} errori durante l'importazione`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Errore import',
        description: 'Si è verificato un errore durante l\'importazione',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setPreviewData([]);
    setImportResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importa Investimenti da CSV</DialogTitle>
          <DialogDescription>
            Carica un file CSV con i tuoi investimenti. Il file deve avere le colonne: id, data, ticker, investito, valore_attuale, prezzo_carico, benchmark, data_vendita, prezzo_vendita
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
              disabled={isImporting}
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Clicca per caricare il file CSV
              </p>
            </label>
          </div>

          {/* Preview */}
          {previewData.length > 0 && !importResults && (
            <div className="space-y-2">
              <h4 className="font-medium">Anteprima (prime 10 righe)</h4>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Ticker</th>
                        <th className="px-3 py-2 text-left font-medium">Data</th>
                        <th className="px-3 py-2 text-right font-medium">Quantità</th>
                        <th className="px-3 py-2 text-right font-medium">Prezzo Carico</th>
                        <th className="px-3 py-2 text-right font-medium">Valore Attuale</th>
                        <th className="px-3 py-2 text-left font-medium">Vendita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{row.ticker}</td>
                          <td className="px-3 py-2">{row.data}</td>
                          <td className="px-3 py-2 text-right">{row.investito}</td>
                          <td className="px-3 py-2 text-right">{row.prezzo_carico}</td>
                          <td className="px-3 py-2 text-right">{row.valore_attuale || '-'}</td>
                          <td className="px-3 py-2">{row.data_vendita || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {importResults && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                {importResults.success > 0 && (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{importResults.success} importati con successo</span>
                  </div>
                )}
                {importResults.errors > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">{importResults.errors} errori</span>
                  </div>
                )}
              </div>

              {importResults.details.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Dettagli errori</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResults.details.map((detail, idx) => (
                      <p key={idx} className="text-sm text-destructive">
                        {detail}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              <X className="w-4 h-4 mr-2" />
              Chiudi
            </Button>
            {previewData.length > 0 && !importResults && (
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? 'Importazione...' : 'Importa'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}