import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Trash2, Save, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ISINMappingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface ISINMapping {
  id: string;
  isin: string;
  symbol: string;
  name: string;
  asset_type: string;
}

const ASSET_TYPES = [
  { value: 'stock', label: 'Azione' },
  { value: 'etf', label: 'ETF' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'bond', label: 'Obbligazione' },
  { value: 'other', label: 'Altro' },
];

export default function ISINMappingsDialog({ open, onOpenChange, userId }: ISINMappingsDialogProps) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<ISINMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ symbol: '', name: '', asset_type: '' });

  useEffect(() => {
    if (open) {
      fetchMappings();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const fetchMappings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('isin_mappings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ISIN mappings:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i mapping ISIN.',
        variant: 'destructive',
      });
    } else {
      setMappings(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (mapping: ISINMapping) => {
    setEditingId(mapping.id);
    setEditForm({
      symbol: mapping.symbol,
      name: mapping.name,
      asset_type: mapping.asset_type,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ symbol: '', name: '', asset_type: '' });
  };

  const handleSaveEdit = async (id: string) => {
    const { error } = await supabase
      .from('isin_mappings')
      .update({
        symbol: editForm.symbol,
        name: editForm.name,
        asset_type: editForm.asset_type,
      })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare il mapping.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Mapping aggiornato',
        description: 'Il mapping ISIN è stato aggiornato.',
      });
      setEditingId(null);
      fetchMappings();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('isin_mappings')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare il mapping.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Mapping eliminato',
        description: 'Il mapping ISIN è stato eliminato.',
      });
      fetchMappings();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Gestione Mapping ISIN</DialogTitle>
          <DialogDescription>
            Visualizza, modifica o elimina i mapping ISIN salvati per gli investimenti.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nessun mapping ISIN salvato. I mapping vengono creati automaticamente durante l'import da Trade Republic.
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {mappings.map((mapping) => (
                <div 
                  key={mapping.id} 
                  className="bg-muted/50 rounded-lg p-4"
                >
                  {editingId === mapping.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-mono">{mapping.isin}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Simbolo</Label>
                          <Input
                            value={editForm.symbol}
                            onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value.toUpperCase() })}
                            placeholder="VWCE"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Nome</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Vanguard FTSE All-World"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo</Label>
                          <Select 
                            value={editForm.asset_type} 
                            onValueChange={(v) => setEditForm({ ...editForm, asset_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSET_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                          <X className="w-4 h-4 mr-1" />
                          Annulla
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(mapping.id)}>
                          <Save className="w-4 h-4 mr-1" />
                          Salva
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{mapping.symbol}</span>
                          <span className="text-sm text-muted-foreground">-</span>
                          <span className="text-sm">{mapping.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{mapping.isin}</span>
                          <span>•</span>
                          <span>{ASSET_TYPES.find(t => t.value === mapping.asset_type)?.label || mapping.asset_type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(mapping)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare questo mapping?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Stai per eliminare il mapping per {mapping.symbol} ({mapping.isin}). 
                                Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(mapping.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
