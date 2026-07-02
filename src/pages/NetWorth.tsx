import MainLayout from '@/components/layout/MainLayout';
import { useNetWorthHistory, NetWorthSnapshot } from '@/hooks/useNetWorthHistory';
import { useTransactions } from '@/hooks/useTransactions';
import { usePortfolio } from '@/hooks/usePortfolio';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { calculateNetWorth } from '@/lib/netWorth';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Home, PiggyBank } from 'lucide-react';

const eur = (n: number) =>
  `${CURRENCY_SYMBOLS.EUR}${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NetWorth() {
  const { data: history = [], isLoading } = useNetWorthHistory();
  const { transactions } = useTransactions();
  const { openAssets } = usePortfolio();

  // Current net worth computed live (the last snapshot may be from yesterday).
  const { netWorth, cashflow, portfolioPL, realEstateDiscounted } = calculateNetWorth({
    transactions,
    assets: openAssets,
  });

  // Variation vs the first snapshot in the visible window.
  const first = history.length > 0 ? history[0].net_worth : 0;
  const last = history.length > 0 ? history[history.length - 1].net_worth : netWorth;
  const variation = last - first;
  const variationPct = first !== 0 ? (variation / Math.abs(first)) * 100 : 0;

  const chartData = history.map((s) => ({
    date: s.date,
    dateLabel: format(parseISO(s.date), 'dd MMM yy', { locale: it }),
    netWorth: Number(s.net_worth),
  }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Patrimonio</h1>
            <p className="text-muted-foreground">Storico del tuo patrimonio netto nel tempo</p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Patrimonio attuale"
            value={eur(netWorth)}
            icon={<Wallet className="w-5 h-5" />}
          />
          <SummaryCard
            title="Variazione periodo"
            value={`${variation >= 0 ? '+' : ''}${eur(variation)}`}
            sub={`${variationPct >= 0 ? '+' : ''}${variationPct.toFixed(1)}%`}
            positive={variation >= 0}
            icon={variation >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          />
          <SummaryCard
            title="Cashflow"
            value={eur(cashflow)}
            icon={<PiggyBank className="w-5 h-5" />}
            sub="Entrate − uscite (storico)"
          />
          <SummaryCard
            title="P&L Investimenti"
            value={eur(portfolioPL)}
            icon={<TrendingUp className="w-5 h-5" />}
            positive={portfolioPL >= 0}
          />
        </div>

        {/* Chart */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-display font-semibold mb-4">Andamento patrimonio</h2>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-12">Caricamento…</p>
          ) : chartData.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              Nessuno storico ancora. Il primo snapshot viene creato questa notte.
              Nel mentre, il patrimonio attuale è <strong>{eur(netWorth)}</strong>.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dateLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} minTickGap={30} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [eur(v), 'Patrimonio']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#nwGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Breakdown */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-display font-semibold mb-4">Composizione patrimonio</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComponentCard label="Cashflow (storico)" value={cashflow} icon={<PiggyBank className="w-4 h-4" />} />
            <ComponentCard label="P&L Investimenti" value={portfolioPL} icon={<TrendingUp className="w-4 h-4" />} />
            <ComponentCard label="Immobili (scontati 25%)" value={realEstateDiscounted} icon={<Home className="w-4 h-4" />} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function SummaryCard({
  title, value, sub, icon, positive,
}: { title: string; value: string; sub?: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <div className="glass rounded-xl p-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <span className={positive === undefined ? 'text-muted-foreground' : positive ? 'text-success' : 'text-destructive'}>
          {icon}
        </span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className={`text-xs ${positive === undefined ? 'text-muted-foreground' : positive ? 'text-success' : 'text-destructive'}`}>{sub}</p>}
    </div>
  );
}

function ComponentCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className={`text-lg font-semibold ${value >= 0 ? '' : 'text-destructive'}`}>{eur(value)}</p>
    </div>
  );
}
