import { useState, useMemo } from 'react';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line,
} from 'recharts';
import { format, parseISO, startOfYear, endOfYear, startOfMonth, endOfMonth, min, max, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { useFilteredTransactions } from '@/hooks/useFilteredTransactions';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import type { TransactionType } from '@/lib/types';

type FilterMode = 'all' | 'year' | 'month' | 'since' | 'between';

interface CategoryDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface CategoryAnalysisChartProps {
  /** Tipo di transazione analizzato. */
  type: Extract<TransactionType, 'expense' | 'income'>;
  /** Titolo della pagina (es. "Analisi Uscite"). */
  title: string;
  /** Sottotitolo della pagina. */
  subtitle: string;
  /** Etichetta del totale (es. "Totale Uscite"). */
  totalLabel: string;
  /** Classe Tailwind del colore del totale (es. "text-destructive" / "text-success"). */
  totalColorClass: string;
}

/**
 * Pagina di analisi per categoria (spese o entrate).
 *
 * Unifica il codice precedentemente duplicato tra `ChartsExpense` e `ChartsIncome`,
 * che differivano solo per il `type` (`expense`/`income`), le label e il colore
 * del totale. Vedi REF-03 in plans/REVISIONE_CODICE_ROUND2_2026-07-03.md.
 */
export default function CategoryAnalysisChart({
  type,
  title,
  subtitle,
  totalLabel,
  totalColorClass,
}: CategoryAnalysisChartProps) {
  const { transactions } = useTransactions();
  const { expenseCategories, incomeCategories } = useCategories();
  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  const [filterMode, setFilterMode] = useState<FilterMode>('year');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [sinceDate, setSinceDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [chartType, setChartType] = useState<'pie' | 'bar' | 'line'>('bar');

  const filteredTransactions = useFilteredTransactions({
    transactions,
    filterMode,
    selectedYear,
    selectedMonth,
    sinceDate,
    fromDate,
    toDate
  });

  const years = useMemo(() => {
    const yearsSet = new Set(transactions.map(t => new Date(t.date).getFullYear()));
    yearsSet.add(new Date().getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  const categoryData = useMemo((): CategoryDataPoint[] => {
    const typedTransactions = filteredTransactions.filter(t => t.type === type);

    const categoryMap: Record<string, number> = {};
    const categoryColorMap: Record<string, string> = {};

    categories.forEach(cat => {
      categoryMap[cat.id] = 0;
      categoryColorMap[cat.id] = cat.color;
    });

    typedTransactions.forEach(t => {
      if (t.category_id && categories.some(c => c.id === t.category_id)) {
        categoryMap[t.category_id] = (categoryMap[t.category_id] || 0) + Number(t.amount);
      }
    });

    return Object.entries(categoryMap)
      .filter(([, value]) => value > 0)
      .map(([categoryId, value]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          name: category?.name || 'Senza categoria',
          value,
          color: category?.color || '#888888'
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categories, type]);

  const total = categoryData.reduce((sum, item) => sum + item.value, 0);

  const lineChartData = useMemo(() => {
    const typedTransactions = filteredTransactions.filter(t => t.type === type);
    if (typedTransactions.length === 0) return [];

    let startDate: Date;
    let endDate: Date;

    const transactionDates = typedTransactions.map(t => parseISO(t.date));
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
      default:
        startDate = minTransactionDate;
        endDate = maxTransactionDate;
        break;
    }

    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const useMonths = daysDiff > 365;

    const timePoints = useMonths
      ? eachMonthOfInterval({ start: startDate, end: endDate })
      : eachDayOfInterval({ start: startDate, end: endDate });

    const dateCategoryMap: Record<string, Record<string, number>> = {};
    const cumulativeCategoryMap: Record<string, number> = {};

    timePoints.forEach(point => {
      const dateKey = format(point, useMonths ? 'yyyy-MM' : 'yyyy-MM-dd');
      dateCategoryMap[dateKey] = {};
    });

    typedTransactions.forEach(t => {
      const dateKey = format(parseISO(t.date), useMonths ? 'yyyy-MM' : 'yyyy-MM-dd');
      if (!dateCategoryMap[dateKey]) {
        dateCategoryMap[dateKey] = {};
      }
      if (t.category_id && categories.some(c => c.id === t.category_id)) {
        dateCategoryMap[dateKey][t.category_id] = (dateCategoryMap[dateKey][t.category_id] || 0) + Number(t.amount);
      }
    });

    return timePoints.map((point) => {
      const dateKey = format(point, useMonths ? 'yyyy-MM' : 'yyyy-MM-dd');
      const entry: Record<string, string | number> = {
        date: format(point, useMonths ? 'MMM yyyy' : 'dd MMM yyyy', { locale: it }),
      };

      categories.forEach(cat => {
        const value = dateCategoryMap[dateKey]?.[cat.id] || 0;
        cumulativeCategoryMap[cat.id] = (cumulativeCategoryMap[cat.id] || 0) + value;
        entry[cat.name] = cumulativeCategoryMap[cat.id];
      });

      return entry;
    });
  }, [filteredTransactions, categories, type, filterMode, selectedYear, selectedMonth, sinceDate, fromDate, toDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/charts">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
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

          <div>
            <label className="text-sm text-muted-foreground block mb-1">Tipo grafico</label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as 'pie' | 'bar' | 'line')}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barre</SelectItem>
                <SelectItem value="pie">Torta</SelectItem>
                <SelectItem value="line">Linea</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-sm text-muted-foreground">{totalLabel}</p>
        <p className={`text-2xl font-display font-bold ${totalColorClass}`}>{CURRENCY_SYMBOLS.EUR}{total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
      </div>

      {/* Chart */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold mb-4">Distribuzione per Categoria</h3>
        {(chartType === 'line' ? lineChartData.length > 0 : categoryData.length > 0) ? (
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'bar' ? (
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />

                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'white' }}
                  itemStyle={{ color: 'white' }}
                  formatter={(value: number) => `${CURRENCY_SYMBOLS.EUR}${value.toFixed(2)}`}
                />
                <Bar dataKey="value" name="Importo">
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />

                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'white' }}
                  itemStyle={{ color: 'white' }}
                  formatter={(value: number) => `${CURRENCY_SYMBOLS.EUR}${value.toFixed(2)}`}
                />
                <Legend />
                {categories.map(cat => (
                  <Line
                    key={cat.id}
                    type="monotone"
                    dataKey={cat.name}
                    name={cat.name}
                    stroke={cat.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            ) : (
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'white' }}
                  itemStyle={{ color: 'white' }}
                  formatter={(value: number) => `${CURRENCY_SYMBOLS.EUR}${value.toFixed(2)}`}
                />
              </PieChart>
            )}
          </ResponsiveContainer>
        ) : (
          <p className="text-muted-foreground text-center py-12">Nessuna transazione nel periodo selezionato</p>
        )}
      </div>

      {/* Category breakdown table */}
      {categoryData.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h3 className="font-semibold mb-4">Dettaglio per Categoria</h3>
          <div className="space-y-3">
            {categoryData.map((item) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</span>
                    <span className="font-semibold">{CURRENCY_SYMBOLS.EUR}{item.value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
