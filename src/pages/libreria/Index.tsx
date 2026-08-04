import { Link } from 'react-router';
import MainLayout from '@/components/layout/MainLayout';
import { useLibraryItems } from '@/hooks/useLibraryItems';
import { LIBRARY_CATEGORY_LABELS, LibraryCategory } from '@/lib/types';
import { BookOpen, BookMarked, BookCopy } from 'lucide-react';

const CATEGORIES: { key: LibraryCategory; icon: React.ElementType; href: string }[] = [
  { key: 'libri', icon: BookOpen, href: '/libreria/libri' },
  { key: 'fumetti', icon: BookCopy, href: '/libreria/fumetti' },
  { key: 'manga', icon: BookMarked, href: '/libreria/manga' },
];

export default function LibreriaIndex() {
  const { items: allItems, isLoading, totalCost, totalReselling, totalGain, totalPieces } = useLibraryItems();

  const categoryStats = CATEGORIES.map(({ key, icon, href }) => {
    const catItems = allItems.filter((i) => i.category === key);
    const cost = catItems.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0);
    const reselling = catItems.reduce((s, i) => s + (i.reselling_value ?? 0) * i.quantity, 0);
    return { key, icon, href, label: LIBRARY_CATEGORY_LABELS[key], count: catItems.length, cost, reselling, pieces: catItems.reduce((s, i) => s + i.quantity, 0) };
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <BookOpen className="w-8 h-8" />
            Libreria
          </h1>
          <p className="text-muted-foreground">La tua collezione di libri, fumetti e manga</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Totale Pezzi</p>
            <p className="text-2xl font-display font-bold">{isLoading ? '…' : totalPieces}</p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Investimento</p>
            <p className="text-2xl font-display font-bold">
              €{isLoading ? '…' : totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Valore Reselling</p>
            <p className="text-2xl font-display font-bold">
              €{isLoading ? '…' : totalReselling.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Profitto / Perdita</p>
            <p className={`text-2xl font-display font-bold ${totalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
              {isLoading ? '…' : `${totalGain >= 0 ? '+' : ''}€${totalGain.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>

        {/* Category cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {categoryStats.map(({ key, icon: Icon, href, label, count, cost, reselling, pieces }) => (
            <Link key={key} to={href} className="glass rounded-xl p-6 hover:bg-secondary/50 transition-colors group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{label}</h3>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{count} titoli &bull; {pieces} {pieces === 1 ? 'pezzo' : 'pezzi'}</p>
                <p>Investito: €{cost.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p>Reselling: €{reselling.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
