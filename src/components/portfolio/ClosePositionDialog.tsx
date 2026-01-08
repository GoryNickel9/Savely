import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO, isValid } from 'date-fns';

interface ClosePositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetName: string;
  assetSymbol?: string;
  currentPrice?: number;
  onConfirm: (soldAt: string, soldPrice: number) => void;
}

export function ClosePositionDialog({
  open,
  onOpenChange,
  assetName,
  assetSymbol,
  currentPrice,
  onConfirm,
}: ClosePositionDialogProps) {
  const [soldAt, setSoldAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [soldPrice, setSoldPrice] = useState(currentPrice?.toString() || '');

  const validateDate = (dateString: string): boolean => {
    if (!dateString) return false;
    const date = parseISO(dateString);
    if (!isValid(date)) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if date is in the future
    if (date > today) return false;
    
    // Check if date is too far in the past (more than 10 years)
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(today.getFullYear() - 10);
    if (date < tenYearsAgo) return false;
    
    return true;
  };

  const validatePrice = (priceString: string): number | null => {
    const price = parseFloat(priceString);
    if (isNaN(price)) return null;
    if (price <= 0) return null;
    if (price > 1000000) return null; // Max 1.000.000€
    return price;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate date
    if (!validateDate(soldAt)) {
      alert('Data non valida. La data deve essere nel passato e non più vecchia di 10 anni.');
      return;
    }
    
    // Validate price
    const price = validatePrice(soldPrice);
    if (price === null) {
      alert('Prezzo non valido. Inserisci un valore tra 0.01€ e 1.000.000€.');
      return;
    }
    
    onConfirm(soldAt, price);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chiudi Posizione</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Stai chiudendo la posizione su <strong>{assetName}</strong>
          {assetSymbol && <span className="text-muted-foreground"> ({assetSymbol})</span>}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label>Data Vendita</Label>
            <Input 
              type="date" 
              value={soldAt} 
              onChange={(e) => setSoldAt(e.target.value)} 
              required 
            />
          </div>
          <div>
            <Label>Prezzo Vendita (€)</Label>
            <Input 
              type="number" 
              step="0.01" 
              value={soldPrice} 
              onChange={(e) => setSoldPrice(e.target.value)} 
              placeholder="Inserisci il prezzo di vendita"
              required 
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit">
              Conferma Chiusura
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
