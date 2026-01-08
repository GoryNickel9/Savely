import MainLayout from '@/components/layout/MainLayout';
import { usePortfolio } from '@/hooks/usePortfolio';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { useLastPriceUpdate } from '@/hooks/useLastPriceUpdate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ASSET_TYPE_LABELS, CURRENCY_SYMBOLS } from '@/lib/constants';
import { AssetType, PortfolioAsset } from '@/lib/types';
import { Plus, Trash2, Clock, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';
import { format, parseISO, startOfMonth, addMonths, addDays, isBefore, isAfter, eachDayOfInterval, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { ClosePositionDialog } from '@/components/portfolio/ClosePositionDialog';

const COLORS = ['#22c55e', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#6b7280'];

export default function Portfolio() {
  const { openAssets, closedAssets, totalValue, totalGain, totalGainPercent, realizedGain, createAsset, updateAsset, deleteAsset } = usePortfolio();
  const { historyByAsset, priceHistory } = usePriceHistory();
  const { lastUpdate } = useLastPriceUpdate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<AssetType>('stock');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedExisting, setSelectedExisting] = useState('');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingGroup, setClosingGroup] = useState<{ assets: PortfolioAsset[], name: string, symbol?: string, currentPrice?: number } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);
  const [editValue, setEditValue] = useState('');

  // Combine all assets for instrument selection
  const allAssets = [...openAssets, ...closedAssets];

  // Unique existing instruments for quick selection
  const existingInstruments = useMemo(() => {
    const map = new Map<string, { name: string; symbol: string; type: AssetType }>();
    allAssets.forEach(a => {
      if (a.symbol) {
        const key = a.symbol.toUpperCase();
        if (!map.has(key)) {
          map.set(key, { name: a.name, symbol: a.symbol, type: a.type });
        }
      }
    });
    return Array.from(map.values());
  }, [allAssets]);

  const handleSelectExisting = (symbolKey: string) => {
    setSelectedExisting(symbolKey);
    if (symbolKey === '_new') {
      setName('');
      setSymbol('');
      setType('stock');
    } else {
      const instrument = existingInstruments.find(i => i.symbol.toUpperCase() === symbolKey);
      if (instrument) {
        setName(instrument.name);
        setSymbol(instrument.symbol);
        setType(instrument.type);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assetData: any = {
        name,
        type,
      };

      if (type === 'cash' || type === 'real_estate') {
        // Per cash e real_estate, non usiamo simbolo, quantità=1, prezzo=valore totale
        assetData.symbol = null;
        assetData.quantity = 1;
        assetData.purchase_price = parseFloat(price);
        assetData.current_price = parseFloat(price);
        // Per cash non impostiamo purchase_date
        if (type !== 'cash') {
          assetData.purchase_date = purchaseDate;
        }
      } else {
        // Per gli altri tipi, usiamo tutti i campi
        assetData.symbol = symbol;
        assetData.quantity = parseFloat(quantity);
        assetData.purchase_price = parseFloat(price);
        assetData.current_price = parseFloat(price);
        assetData.purchase_date = purchaseDate;
      }

      await createAsset.mutateAsync(assetData);
      toast({ title: 'Acquisto aggiunto!' });
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setName('');
    setSymbol('');
    setQuantity('');
    setPrice('');
    setPurchaseDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedExisting('');
  };

  const handleEditCash = (asset: PortfolioAsset) => {
    setEditingAsset(asset);
    setEditValue((asset.current_price ?? asset.purchase_price).toString());
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) return;
    try {
      await updateAsset.mutateAsync({
        id: editingAsset.id,
        purchase_price: parseFloat(editValue),
        current_price: parseFloat(editValue),
      });
      toast({ title: 'Liquidità aggiornata!' });
      setEditDialogOpen(false);
      setEditingAsset(null);
      setEditValue('');
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const chartData = Object.entries(
    openAssets.reduce((acc, a) => {
      const value = (a.current_price ?? a.purchase_price) * a.quantity;
      acc[a.type] = (acc[a.type] || 0) + value;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, value]) => ({ name: ASSET_TYPE_LABELS[type as AssetType], value }));

  // Calcola il totale per le percentuali (incluso cash)
  const totalForPercentage = chartData.reduce((sum, item) => sum + item.value, 0);

  const chartDataPercentage = chartData.map(item => ({
    name: item.name,
    value: totalForPercentage > 0 ? (item.value / totalForPercentage) * 100 : 0,
  }));

  // Performance chart using real price history when available (open positions only, excluding cash)
  const performanceData = useMemo(() => {
    const assetsForPerformance = openAssets.filter(a => a.type !== 'cash');
    if (assetsForPerformance.length === 0) return [];

    // Find earliest purchase date
    const purchaseDates = assetsForPerformance.map(a => parseISO(a.purchase_date));
    const earliestDate = purchaseDates.reduce((min, d) => isBefore(d, min) ? d : min, purchaseDates[0]);
    const today = new Date();

    // Generate all days from earliest to today (we'll aggregate to show reasonable points)
    const allDays = eachDayOfInterval({ start: startOfDay(earliestDate), end: startOfDay(today) });
    
    // Sample to avoid too many data points (max ~60 points)
    const step = Math.max(1, Math.floor(allDays.length / 60));
    const sampledDays = allDays.filter((_, i) => i % step === 0 || i === allDays.length - 1);

    // Build a map of prices by date for quick lookup
    const pricesByDateAndAsset: Record<string, Record<string, number>> = {};
    priceHistory.forEach(p => {
      if (!pricesByDateAndAsset[p.recorded_at]) {
        pricesByDateAndAsset[p.recorded_at] = {};
      }
      pricesByDateAndAsset[p.recorded_at][p.asset_id] = p.price;
    });

    return sampledDays.map((dayDate, idx) => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const isLastDay = idx === sampledDays.length - 1;

      // Assets owned by this day (purchased before or on this day, excluding cash)
      const ownedAssets = assetsForPerformance.filter(a => {
        const pDate = parseISO(a.purchase_date);
        return !isAfter(startOfDay(pDate), dayDate);
      });

      const invested = ownedAssets.reduce((sum, a) => sum + a.purchase_price * a.quantity, 0);

      // Calculate current value using interpolation when no history
      let currentVal = 0;
      ownedAssets.forEach(a => {
        const currentPrice = a.current_price ?? a.purchase_price;
        
        if (isLastDay) {
          // For today, use current_price from the asset (most accurate)
          currentVal += currentPrice * a.quantity;
        } else {
          // Check if we have a historical price for this date
          const historicalPrice = pricesByDateAndAsset[dateStr]?.[a.id];
          
          if (historicalPrice !== undefined) {
            currentVal += historicalPrice * a.quantity;
          } else {
            // Interpolate between purchase_price and current_price
            const purchaseDate = parseISO(a.purchase_date);
            const totalDays = Math.max(1, (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
            const daysSincePurchase = Math.max(0, (dayDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
            const progress = daysSincePurchase / totalDays;
            const interpolatedPrice = a.purchase_price + (currentPrice - a.purchase_price) * progress;
            currentVal += interpolatedPrice * a.quantity;
          }
        }
      });

      return {
        date: dateStr,
        dateLabel: format(dayDate, 'd MMM yy', { locale: it }),
        invested,
        current: currentVal,
        profit: currentVal - invested,
      };
    });
  }, [openAssets, priceHistory]);

  const totalInvested = openAssets.filter(a => a.type !== 'cash').reduce((s, a) => s + a.purchase_price * a.quantity, 0);

  // Calcola rendimento escludendo liquidità e immobili
  const assetsForReturn = openAssets.filter(a => a.type !== 'cash' && a.type !== 'real_estate');
  const totalValueForReturn = assetsForReturn.reduce((sum, a) => {
    const price = a.current_price ?? a.purchase_price;
    return sum + (price * a.quantity);
  }, 0);
  const totalCostForReturn = assetsForReturn.reduce((sum, a) => sum + a.purchase_price * a.quantity, 0);
  const totalGainForReturn = totalValueForReturn - totalCostForReturn;
  const totalGainPercentExcludingCashAndRealEstate = totalCostForReturn > 0 ? (totalGainForReturn / totalCostForReturn) * 100 : 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Portfolio</h1>
            <p className="text-muted-foreground">I tuoi investimenti</p>
            {lastUpdate && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                I prezzi sono stati aggiornati il {format(parseISO(lastUpdate.updated_at), "dd.MM.yy 'alle ore' HH:mm", { locale: it })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Aggiungi</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuovo Asset</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Quick select existing instrument */}
                  {existingInstruments.length > 0 && (
                    <div>
                      <Label>Strumento esistente (opzionale)</Label>
                      <Select value={selectedExisting} onValueChange={handleSelectExisting}>
                        <SelectTrigger><SelectValue placeholder="Seleziona o aggiungi nuovo..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_new">➕ Nuovo strumento</SelectItem>
                          {existingInstruments.map(i => (
                            <SelectItem key={i.symbol} value={i.symbol.toUpperCase()}>
                              {i.symbol} - {i.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                  {type !== 'cash' && type !== 'real_estate' && (
                    <div>
                      <Label>Simbolo (per aggiornamento prezzi)</Label>
                      <Input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="es. AAPL, BTC, VWCE.DE" />
                      <p className="text-xs text-muted-foreground mt-1">Usa simboli Yahoo Finance per azioni/ETF, simboli standard per crypto</p>
                    </div>
                  )}
                  <div><Label>Tipo</Label>
                    <Select value={type} onValueChange={v => setType(v as AssetType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k as AssetType}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {type !== 'cash' && (
                    <div><Label>Data Acquisto</Label><Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required /></div>
                  )}
                  {type !== 'cash' && type !== 'real_estate' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Quantità</Label><Input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} required /></div>
                      <div><Label>Prezzo Acquisto (€)</Label><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required /></div>
                    </div>
                  ) : (
                    <div>
                      <Label>Valore (€)</Label>
                      <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required />
                      <p className="text-xs text-muted-foreground mt-1">Inserisci il valore totale dell'asset</p>
                    </div>
                  )}
                  <Button type="submit" className="w-full">Salva</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Investito</p>
            <p className="text-2xl font-display font-bold">{CURRENCY_SYMBOLS.EUR}{totalInvested.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Valore Attuale</p>
            <p className="text-2xl font-display font-bold">{CURRENCY_SYMBOLS.EUR}{totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Profitto/Perdita</p>
            <p className={`text-2xl font-display font-bold ${totalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalGain >= 0 ? '+' : ''}{CURRENCY_SYMBOLS.EUR}{totalGain.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Rendimento</p>
            <p className={`text-2xl font-display font-bold ${totalGainPercentExcludingCashAndRealEstate >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalGainPercentExcludingCashAndRealEstate >= 0 ? '+' : ''}{totalGainPercentExcludingCashAndRealEstate.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
            </p>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Pie chart */}
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Asset Allocation</h3>
            {chartDataPercentage.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart><Pie data={chartDataPercentage} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {chartDataPercentage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-8">Aggiungi asset per vedere l'allocazione</p>}
          </div>

          {/* Performance chart */}
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-2">Andamento Investimenti</h3>
            {priceHistory.length === 0 && openAssets.length > 0 && (
              <p className="text-xs text-muted-foreground mb-2">
              </p>
            )}
            {performanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dateLabel" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string) => [
                      `${CURRENCY_SYMBOLS.EUR}${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      name === 'invested' ? 'Investito' : name === 'current' ? 'Valore' : 'Profitto',
                    ]}
                  />
                  <Legend formatter={(value) => value === 'invested' ? 'Investito' : value === 'current' ? 'Valore Attuale' : 'Profitto'} />
                  <Area type="monotone" dataKey="invested" name="invested" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted) / 0.5)" />
                  <Area type="monotone" dataKey="current" name="current" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-8">Aggiungi asset per vedere l'andamento</p>}
          </div>
        </div>

        {/* Open positions - grouped by symbol */}
        <div className="glass rounded-xl divide-y divide-border">
          <h3 className="font-semibold p-4 border-b border-border">Posizioni Aperte</h3>
          {openAssets.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Nessuna posizione aperta</p>
          ) : (() => {
            // Group assets by symbol (or by id if no symbol)
            const grouped = openAssets.reduce((acc, a) => {
              const key = a.symbol?.toUpperCase() || a.id;
              if (!acc[key]) {
                acc[key] = [];
              }
              acc[key].push(a);
              return acc;
            }, {} as Record<string, typeof openAssets>);

            return Object.entries(grouped).map(([key, group]) => {
              const totalQuantity = group.reduce((sum, a) => sum + a.quantity, 0);
              const totalCostBasis = group.reduce((sum, a) => sum + a.purchase_price * a.quantity, 0);
              const avgPurchasePrice = totalCostBasis / totalQuantity;
              
              // Use the most recent current_price from the group
              const latestPrice = group.find(a => a.current_price !== null)?.current_price ?? avgPurchasePrice;
              const totalValueGroup = latestPrice * totalQuantity;
              const totalGainVal = totalValueGroup - totalCostBasis;
              const gainPercent = totalCostBasis > 0 ? (totalGainVal / totalCostBasis) * 100 : 0;
              
              // Use first asset's metadata for display
              const first = group[0];
              
              return (
                <div key={key} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{first.name} {first.symbol && <span className="text-muted-foreground">({first.symbol})</span>}</p>
                    <p className="text-sm text-muted-foreground">
                      {first.type === 'cash' ? (
                        <span>
                          {ASSET_TYPE_LABELS[first.type]}
                          <span className="ml-2 text-xs text-muted-foreground">
                            - Aggiornato al {format(parseISO(lastUpdate?.updated_at || first.updated_at), 'dd.MM.yy', { locale: it })}
                          </span>
                        </span>
                      ) : (
                        `${ASSET_TYPE_LABELS[first.type]} · ${totalQuantity.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unità @ ${CURRENCY_SYMBOLS.EUR}${avgPurchasePrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-semibold">{CURRENCY_SYMBOLS.EUR}{totalValueGroup.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      {first.type !== 'cash' && (
                        <p className={`text-sm ${totalGainVal >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {totalGainVal >= 0 ? '+' : ''}{CURRENCY_SYMBOLS.EUR}{totalGainVal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
                        </p>
                      )}
                    </div>
                    {first.type === 'cash' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCash(first)}
                      >
                        Modifica
                      </Button>
                    )}
                    {first.type !== 'cash' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setClosingGroup({
                            assets: group,
                            name: first.name,
                            symbol: first.symbol ?? undefined,
                            currentPrice: latestPrice,
                          });
                          setCloseDialogOpen(true);
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Chiudi
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        group.forEach(a => deleteAsset.mutate(a.id));
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Closed positions */}
        {closedAssets.length > 0 && (
          <div className="glass rounded-xl divide-y divide-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Posizioni Chiuse</h3>
              <span className={`text-sm font-medium ${realizedGain >= 0 ? 'text-success' : 'text-destructive'}`}>
                P/L Realizzato: {realizedGain >= 0 ? '+' : ''}{CURRENCY_SYMBOLS.EUR}{realizedGain.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {(() => {
              const grouped = closedAssets.reduce((acc, a) => {
                const key = a.symbol?.toUpperCase() || a.id;
                if (!acc[key]) {
                  acc[key] = [];
                }
                acc[key].push(a);
                return acc;
              }, {} as Record<string, typeof closedAssets>);

              return Object.entries(grouped).map(([key, group]) => {
                const totalQuantity = group.reduce((sum, a) => sum + a.quantity, 0);
                const totalCostBasis = group.reduce((sum, a) => sum + a.purchase_price * a.quantity, 0);
                const totalSoldValue = group.reduce((sum, a) => sum + (a.sold_price ?? a.purchase_price) * a.quantity, 0);
                const realizedPL = totalSoldValue - totalCostBasis;
                const realizedPercent = totalCostBasis > 0 ? (realizedPL / totalCostBasis) * 100 : 0;
                
                const first = group[0];
                const soldDate = first.sold_at ? format(parseISO(first.sold_at), 'd MMM yyyy', { locale: it }) : '';
                
                return (
                  <div key={key} className="flex items-center justify-between p-4 opacity-70">
                    <div>
                      <p className="font-medium">{first.name} {first.symbol && <span className="text-muted-foreground">({first.symbol})</span>}</p>
                      <p className="text-sm text-muted-foreground">
                        {first.type === 'cash' ? (
                          `${ASSET_TYPE_LABELS[first.type]} · Venduto ${soldDate}`
                        ) : (
                          `${ASSET_TYPE_LABELS[first.type]} · ${totalQuantity.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unità · Venduto ${soldDate}`
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="font-semibold">{CURRENCY_SYMBOLS.EUR}{totalSoldValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        {first.type !== 'cash' && (
                          <p className={`text-sm ${realizedPL >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {realizedPL >= 0 ? '+' : ''}{CURRENCY_SYMBOLS.EUR}{realizedPL.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({realizedPercent >= 0 ? '+' : ''}{realizedPercent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
                          </p>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          group.forEach(a => deleteAsset.mutate(a.id));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Close Position Dialog */}
        <ClosePositionDialog
          open={closeDialogOpen}
          onOpenChange={setCloseDialogOpen}
          assetName={closingGroup?.name || ''}
          assetSymbol={closingGroup?.symbol}
          currentPrice={closingGroup?.currentPrice}
          onConfirm={async (soldAt, soldPrice) => {
            if (!closingGroup) return;
            try {
              // Update all assets in the group with sold_at and sold_price
              for (const asset of closingGroup.assets) {
                await updateAsset.mutateAsync({
                  id: asset.id,
                  sold_at: soldAt,
                  sold_price: soldPrice,
                });
              }
              toast({ title: 'Posizione chiusa!' });
              setClosingGroup(null);
            } catch {
              toast({ title: 'Errore', variant: 'destructive' });
            }
          }}
        />

        {/* Edit Cash Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica Liquidità</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editingAsset?.name || ''} disabled />
              </div>
              <div>
                <Label>Valore (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  autoFocus
                />
              </div>
              <Button onClick={handleSaveEdit} className="w-full">Salva</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
