import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ArrowLeftRight, PiggyBank, Settings, Menu } from 'lucide-react';

/** Tab fisse: destinazioni frequenti sempre disponibili (nessun permesso richiesto). */
const TABS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Transazioni', href: '/transactions', icon: ArrowLeftRight },
  { label: 'Budget', href: '/budget', icon: PiggyBank },
  { label: 'Impostazioni', href: '/settings', icon: Settings },
];

interface BottomNavProps {
  /** Apre il drawer laterale (moduli a permesso e resto della navigazione). */
  onOpenDrawer: () => void;
}

/**
 * Barra di navigazione inferiore, visibile solo su mobile (<lg).
 * Le destinazioni frequenti sono a un tap; "Altro" apre il drawer con i
 * moduli a permesso (poker, fumo, FIRE, TCG, libreria…).
 */
export default function BottomNav({ onOpenDrawer }: BottomNavProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const someTabActive = TABS.some((tab) => isActive(tab.href));

  const itemClass = (active: boolean) =>
    cn(
      'flex-1 flex flex-col items-center justify-center gap-1 min-h-[64px] pt-1 pb-2 transition-colors',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label={t('Navigazione principale')}
    >
      <div className="flex">
        {TABS.map((tab) => (
          <Link key={tab.href} to={tab.href} className={itemClass(isActive(tab.href))}>
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t(tab.label)}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={onOpenDrawer}
          className={cn(itemClass(!someTabActive), 'cursor-pointer')}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t('Altro')}</span>
        </button>
      </div>
    </nav>
  );
}
