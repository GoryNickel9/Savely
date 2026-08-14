import MainLayout from '@/components/layout/MainLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useState, useMemo } from 'react';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, isWithinInterval, eachDayOfInterval, startOfYear, endOfYear, startOfMonth, endOfMonth, min, max } from 'date-fns';
import { it } from 'date-fns/locale';
import { useFilteredTransactions } from '@/hooks/useFilteredTransactions';
import { useMonthlyAggregation } from '@/hooks/useMonthlyAggregation';
import { useTranslation } from 'react-i18next';

interface CumulativeDataPoint {
  date: string;
  dateLabel: string;
  cumulative: number;
}

type FilterMode = 'all' | 'year' | 'month' | 'since' | 'between';

export default function ChartsIncomeExpense() {
  const { t } = useTranslation();
  const { transactions } = useTransactions();
  const [filterMode, setFilterMode] = useState<FilterMode>('year');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [sinceDate, setSinceDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Usa i nuovi hook per filtrare e aggregare
  const filteredTransactions = useFilteredTransactions({
    transactions,
    filterMode,
    selectedYear,
    selectedMonth,
    sinceDate,
    fromDate,
    toDate
  });
  
  const monthlyData = useMonthlyAggregation(filteredTransactions);

  const years = useMemo(() => {
    const yearsSet = new Set(transactions.map(t => new Date(t.date).getFullYear()));
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  // Cumulative balance over time - day by day based on filter
  const cumulativeData = useMemo((): CumulativeDataPoint[] => {
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

    // Generate all days in range (limit to max 365 days to prevent performance issues)
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const maxDays = 365;
    
    if (daysDiff > maxDays) {
      // If range is too large, aggregate by month instead of day
      const monthlyBalances: Record<string, number> = {};
      filteredTransactions.forEach(t => {
        const monthKey = format(parseISO(t.date), 'yyyy-MM');
        if (!monthlyBalances[monthKey]) {
          monthlyBalances[monthKey] = 0;
        }
        monthlyBalances[monthKey] += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
      });
      
      // Generate all months in range
      const allMonths: Date[] = [];
      let currentMonth = startOfMonth(startDate);
      while (currentMonth <= endDate) {
        allMonths.push(currentMonth);
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      }
      
      let cumulative = 0;
      return allMonths.map(month => {
        const monthKey = format(month, 'yyyy-MM');
        cumulative += monthlyBalances[monthKey] || 0;
        return {
          date: monthKey + '-01',
          dateLabel: format(month, 'MMM yyyy', { locale: it }),
          cumulative,
        };
      });
    }
    
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
        <div className="flex items-center gap-4">
          <Link to="/charts">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold">{t('Analisi Entrate e Uscite')}</h1>
            <p className="text-muted-foreground">{t('Andamento cumulativo del bilancio')}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('Filtro')}</label>
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('Tutto')}</SelectItem>
                  <SelectItem value="year">{t('Anno')}</SelectItem>
                  <SelectItem value="month">{t('Mese')}</SelectItem>
                  <SelectItem value="since">{t('Da data')}</SelectItem>
                  <SelectItem value="between">{t('Tra date')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(filterMode === 'year' || filterMode === 'month') && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('Anno')}</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {filterMode === 'month' && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('Mese')}</label>
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
                <label className="text-sm text-muted-foreground block mb-1">{t('Da')}</label>
                <Input type="date" value={sinceDate} onChange={e => setSinceDate(e.target.value)} className="w-[160px]" />
              </div>
            )}

            {filterMode === 'between' && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{t('Da')}</label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-[160px]" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{t('A')}</label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-[160px]" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Entrate')}</p>
            <p className="text-2xl font-display font-bold text-success">{CURRENCY_SYMBOLS.EUR}{totalIncome.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Uscite')}</p>
            <p className="text-2xl font-display font-bold text-destructive">{CURRENCY_SYMBOLS.EUR}{totalExpense.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Cash Flow')}</p>
            <p className={`text-2xl font-display font-bold ${totalIncome - totalExpense >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalIncome - totalExpense >= 0 ? '+' : ''}{CURRENCY_SYMBOLS.EUR}{(totalIncome - totalExpense).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Saving rate')}</p>
            <p className="text-2xl font-display font-bold text-success">
              {totalIncome > 0 ? `${Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1)}%` : '0%'}
            </p>
          </div>
        </div>

        {/* Cumulative Chart */}
        <div className="glass rounded-xl p-6">
          <h3 className="font-semibold mb-4">{t('Andamento Cumulativo del Bilancio')}</h3>
          {cumulativeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  labelStyle={{ color: 'white' }}
                  itemStyle={{ color: 'white' }}
                  formatter={(value: number) => `${CURRENCY_SYMBOLS.EUR}${value.toFixed(2)}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulative" 
                  name={t('Bilancio Cumulativo')}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.3)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-12">{t('Nessuna transazione nel periodo selezionato')}</p>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
