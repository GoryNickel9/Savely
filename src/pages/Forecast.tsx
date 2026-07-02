import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useForecast } from '@/hooks/useForecast';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingDown, AlertTriangle, CalendarClock } from 'lucide-react';

const HORIZONS = [3, 6, 12] as const;
type Horizon = (typeof HORIZONS)[number];

const eur = (n: number) =>
  `${CURRENCY_SYMBOLS.EUR}${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Forecast() {
  const [months, setMonths] = useState<Horizon>(6);
  const { data, currentBalance, isLoading } = useForecast(months);

  const chartData = useMemo(() => {
    if (!data) return [];
    // Down-sample to weekly points to keep the chart readable on long horizons.
    const step = data.points.length > 200 ? 7 : 1;
    return data.points
      .filter((_, i) => i % step === 0)
      .map((p) => ({
        date: p.date,
        dateLabel: format(parseISO(p.date), 'dd MMM', { locale: it }),
        balance: p.balance,
      }));
  }, [data]);

  const endBalance = data?.endBalance ?? 0;
  const negativeOn = data?.negativeOn ?? null;
  const minBalance = data?.minBalance ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Previsioni</h1>
            <p className="text-muted-foreground">Proiezione del tuo saldo cassa sui prossimi mesi</p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>

        {/* Horizon selector */}
        <div className="flex gap-2">
          {HORIZONS.map((h) => (
            <Button
              key={h}
              variant={months === h ? 'default' : 'outline'}
              onClick={() => setMonths(h)}
              size="sm"
            >
              {h} mesi
            </Button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4 space-y-1">
            <p className="text-sm text-muted-foreground">Saldo attuale</p>
            <p className="text-xl font-semibold">{eur(currentBalance)}</p>
          </div>
          <div className="glass rounded-xl p-4 space-y-1">
            <p className="text-sm text-muted-foreground">Saldo proiettato a {months} mesi</p>
            <p className={`text-xl font-semibold ${endBalance < 0 ? 'text-destructive' : ''}`}>{eur(endBalance)}</p>
          </div>
          <div className={`glass rounded-xl p-4 space-y-1 ${negativeOn ? 'border border-destructive/50' : ''}`}>
            <div className="flex items-center gap-2">
              {negativeOn ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">Rischio scoperto</p>
            </div>
            <p className={`text-xl font-semibold ${negativeOn ? 'text-destructive' : ''}`}>
              {negativeOn
                ? format(parseISO(negativeOn), 'dd MMM yyyy', { locale: it })
                : 'Nessuno nel periodo'}
            </p>
            {negativeOn && (
              <p className="text-xs text-muted-foreground">Saldo minimo: {eur(minBalance)}</p>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Proiezione saldo
          </h2>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-12">Calcolo in corso…</p>
          ) : chartData.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              Aggiungi qualche transazione per vedere la proiezione.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dateLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} minTickGap={30} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [eur(v), 'Saldo']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeWidth={1.5} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#forecastGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            La proiezione usa la spesa mensile mediana (ultimi 730 giorni) come burn rate giornaliero
            e sottrae le spese ricorrenti note alle relative scadenze. È una stima indicativa, non una garanzia.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
