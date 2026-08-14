import { useState } from 'react';
import { Link } from 'react-router';
import MainLayout from '@/components/layout/MainLayout';
import { useTcgCards } from '@/hooks/useTcgCards';
import { TCG_GAME_LABELS, TcgGame } from '@/lib/types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Library } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const COLORS = ['#22c55e', '#f59e0b', '#8b5cf6'];
const GAMES: TcgGame[] = ['magic', 'pokemon', 'yugioh'];

export default function TcgIndex() {
  const { t } = useTranslation();
  const { cards: allCards, isLoading, totalValue, totalCost, totalGain, totalGainPercent, totalPieces } = useTcgCards();

  const gameStats = GAMES.map((game) => {
    const gc = allCards.filter((c) => c.category === game);
    const val = gc.reduce((s, c) => s + (c.current_price ?? c.purchase_price) * c.quantity, 0);
    const totalCards = gc.reduce((s, c) => s + c.quantity, 0);
    return { game, label: t(TCG_GAME_LABELS[game]), value: val, count: gc.length, totalCards };
  }).filter((g) => g.count > 0);

  const gamePieData = gameStats.map((g) => ({ name: g.label, value: g.totalCards }));
  const totalGameCards = gamePieData.reduce((total, item) => total + item.value, 0);
  const pieData = totalGameCards > 0 ? gamePieData : [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Library className="w-8 h-8" />
            {t('Collezione TCG')}
          </h1>
          <p className="text-muted-foreground">{t('La tua collezione di carte')}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Valore Attuale')}</p>
            <p className="text-2xl font-display font-bold">€{totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Investimento')}</p>
            <p className="text-2xl font-display font-bold">€{totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Profitto / Perdita')}</p>
            <p className={`text-2xl font-display font-bold ${totalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalGain >= 0 ? '+' : ''}€{totalGain.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Rendimento')}</p>
            <p className={`text-2xl font-display font-bold ${totalCost === 0 ? 'text-muted-foreground' : totalGainPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalCost > 0 ? `${totalGainPercent >= 0 ? '+' : ''}${totalGainPercent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}
            </p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('Totale Carte')}</p>
            <p className="text-2xl font-display font-bold">{totalPieces}</p>
          </div>
        </div>

        {/* Charts + navigation */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pie chart */}
          <div className="glass rounded-xl p-6 lg:col-span-1">
            <h3 className="font-semibold mb-4">{t('Distribuzione per Gioco')}</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={false}
                    labelLine={false}
                  >
                    {pieData.map((item, i) => (
                      <Cell key={item.name} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const percent = totalGameCards > 0 ? ((value / totalGameCards) * 100).toFixed(1) : '0.0';
                      return [`${percent}%`, name];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    formatter={(value, entry, index) => (
                      <span style={{ color: COLORS[index % COLORS.length], fontWeight: 600 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">{t('Aggiungi carte per vedere la distribuzione')}</p>
            )}
          </div>

          {/* Navigation cards */}
          <div className="lg:col-span-2 grid sm:grid-cols-3 gap-4 content-start">
            {GAMES.map((game, i) => {
              const stat = gameStats.find((g) => g.game === game);
              return (
                <Link
                  key={game}
                  to={`/tcg/${game}`}
                  className="glass rounded-xl p-6 hover:bg-secondary/50 transition-colors block"
                >
                  <p className="font-semibold text-sm mb-2" style={{ color: COLORS[i] }}>
                    {t(TCG_GAME_LABELS[game])}
                  </p>
                  {stat ? (
                    <>
                      <p className="text-xl font-display font-bold">€{stat.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('{{count}} carte totali', { count: stat.totalCards })}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">{t('Nessuna carta')}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
