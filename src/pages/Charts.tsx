import MainLayout from '@/components/layout/MainLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useState, useMemo } from 'react';
import { CURRENCY_SYMBOLS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, isWithinInterval, eachDayOfInterval, startOfYear, endOfYear, startOfMonth, endOfMonth, min, max } from 'date-fns';
import { it } from 'date-fns/locale';

type FilterMode = 'all' | 'year' | 'month' | 'since' | 'between';

export default function Charts() {
  const { transactions } = useTransactions();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [sinceDate, setSinceDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const years = useMemo(() => {
    const yearsSet = new Set(transactions.map(t => new Date(t.date).getFullYear()));
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = parseISO(t.date);
      switch (filterMode) {
        case 'year':
          return date.getFullYear() === parseInt(selectedYear);
        case 'month':
          return date.getFullYear() === parseInt(selectedYear) && (date.getMonth() + 1) === parseInt(selectedMonth);
        case 'since':
          if (!sinceDate) return true;
          return date >= parseISO(sinceDate);
        case 'between':
          if (!fromDate || !toDate) return true;
          return isWithinInterval(date, { start: parseISO(fromDate), end: parseISO(toDate) });
        default:
          return true;
      }
    });
  }, [transactions, filterMode, selectedYear, selectedMonth, sinceDate, fromDate, toDate]);

  // Monthly aggregation for chart
  const monthlyData = useMemo(() => {
    const grouped: Record<string, { month: string; income: number; expense: number }> = {};

    filteredTransactions.forEach(t => {
      const monthKey = format(parseISO(t.date), 'yyyy-MM');
      if (!grouped[monthKey]) {
        grouped[monthKey] = { month: monthKey, income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        grouped[monthKey].income += Number(t.amount);
      } else {
        grouped[monthKey].expense += Number(t.amount);
      }
    });

    return Object.values(grouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(d => ({
        ...d,
        monthLabel: format(parseISO(d.month + '-01'), 'MMM yyyy', { locale: it }),
        balance: d.income - d.expense,
      }));
  }, [filteredTransactions]);

  // Cumulative balance over time - day by day based on filter
  const cumulativeData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];

    // Determine date range based on filter
    let startDate: Date;
    let endDate: Date;

    const transactionDates = filteredTransactions.map(t => parseISO(t.date));
    const minTransactionDate = min(transactionDates);
    const maxTransactionDate = max(transactionDates);

    switch (filterMode) {
      case 'year':
        startDate = startOfYear(new Date(parseInt(selectedYear), 0, 1));
        endDate = endOfYear(new Date(parseInt(selectedYear), 0, 1));
        break;
      case 'month':
        startDate = startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1));
        endDate = endOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1));
        break;
      case 'since':
        startDate = sinceDate ? parseISO(sinceDate) : minTransactionDate;
        endDate = new Date();
        break;
      case 'between':
        startDate = fromDate ? parseISO(fromDate) : minTransactionDate;
        endDate = toDate ? parseISO(toDate) : maxTransactionDate;
        break;
      default: // 'all'
        startDate = minTransactionDate;
        endDate = maxTransactionDate;
        break;
    }

    // Create daily map of transactions
    const dailyBalances: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      const dateKey = t.date;
      if (!dailyBalances[dateKey]) {
        dailyBalances[dateKey] = 0;
      }
      dailyBalances[dateKey] += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
    });

    // Generate all days in range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    let cumulative = 0;
    return allDays.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      cumulative += dailyBalances[dateKey] || 0;
      return {
        date: dateKey,
        dateLabel: format(day, 'dd MMM yyyy', { locale: it }),
        cumulative,
      };
    });
  }, [filteredTransactions, filterMode, selectedYear, selectedMonth, sinceDate, fromDate, toDate]);

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Grafici</h1>
          <p className="text-muted-foreground">Analisi entrate e uscite</p>
        </div>

        {/* Filters */}
        <div className="glass rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Filtro</label>
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutto</SelectItem>
                  <SelectItem value="year">Anno</SelectItem>
                  <SelectItem value="month">Mese</SelectItem>
                  <SelectItem value="since">Da data</SelectItem>
                  <SelectItem value="between">Tra date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(filterMode === 'year' || filterMode === 'month') && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Anno</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {filterMode === 'month' && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Mese</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {format(new Date(2000, i, 1), 'MMMM', { locale: it })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterMode === 'since' && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Da</label>
                <Input type="date" value={sinceDate} onChange={e => setSinceDate(e.target.value)} className="w-[160px]" />
              </div>
            )}

            {filterMode === 'between' && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Da</label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-[160px]" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">A</label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-[160px]" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Entrate</p>
            <p className="text-2xl font-display font-bold text-success">{CURRENCY_SYMBOLS.EUR}{totalIncome.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Uscite</p>
            <p className="text-2xl font-display font-bold text-destructive">{CURRENCY_SYMBOLS.EUR}{totalExpense.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Bilancio</p>
            <p className={`text-2xl font-display font-bold ${totalIncome - totalExpense >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalIncome - totalExpense >= 0 ? '+' : ''}{CURRENCY_SYMBOLS.EUR}{(totalIncome - totalExpense).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Cumulative Chart */}
        <div className="glass rounded-xl p-6">
          <h3 className="font-semibold mb-4">Andamento Cumulativo del Bilancio</h3>
          {cumulativeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="dateLabel" 
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} 
                  interval="preserveStartEnd"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => `${CURRENCY_SYMBOLS.EUR}${value.toFixed(2)}`}
                />
                <Area type="monotone" dataKey="cumulative" name="Bilancio Cumulativo" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-12">Nessuna transazione nel periodo selezionato</p>
          )}
        </div>

      </div>
    </MainLayout>
  );
}