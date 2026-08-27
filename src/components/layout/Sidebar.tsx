import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  LineChart,
  BarChart3,
  LogOut,
  Menu,
  X,
  CalendarClock,
  Shield,
  Dices,
  Cigarette,
  Flame,
  Library,
  BookOpen,
  HeartHandshake,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Layout constants
const SIDEBAR_WIDTH = 'w-72';
const SIDEBAR_COLLAPSED_WIDTH = 'w-[72px]';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transazioni', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Uscite Ricorrenti', href: '/recurring', icon: CalendarClock },
  { name: 'Budget', href: '/budget', icon: PiggyBank },
  { name: 'Portfolio', href: '/portfolio', icon: LineChart },
  { name: 'Insights', href: '/insights', icon: Lightbulb },
  { name: 'Grafici', href: '/charts', icon: BarChart3 },
];

interface SidebarProps {
  /** Stato del drawer mobile, controllato da MainLayout (condiviso con BottomNav). */
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  /** Solo desktop: sidebar ridotta a sole icone. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  mobileOpen,
  onMobileOpenChange,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { permissions } = usePermissions();

  /** Modalità compatatta valida solo sul desktop esteso. */
  const iconOnly = collapsed;

  const linkCls = (active: boolean) =>
    cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
      active
        ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      // In modalità ridotta le voci diventano solo icone centrate.
      iconOnly && 'justify-center px-0 py-2.5'
    );

  /** Etichetta della voce: visibile di norma, nascosta (ma annunciata) se ridotta. */
  const navLabel = (name: string) => (
    <span className={cn(iconOnly && 'sr-only')}>{t(name)}</span>
  );

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn('p-6 shrink-0 flex items-center gap-3', iconOnly && 'px-3 py-6 flex-col')}>
        {iconOnly ? (
          <div
            className="h-9 w-9 rounded-xl bg-primary/20 text-primary grid place-items-center font-display font-bold"
            title="Savely"
          >
            S
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-display font-bold">{t('Savely')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('La tua finanza personale semplificata')}</p>
          </div>
        )}
        {!iconOnly && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('Riduci la barra laterale')}
            title={t('Riduci la barra laterale')}
            className="ml-auto text-muted-foreground hover:text-foreground max-lg:hidden"
            onClick={() => onToggleCollapse?.()}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
      </div>
      {iconOnly && (
        <div className="px-3 pb-2 shrink-0 max-lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('Espandi la barra laterale')}
            title={t('Espandi la barra laterale')}
            className="mx-auto text-muted-foreground hover:text-foreground"
            onClick={() => onToggleCollapse?.()}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <div key={item.name}>
              <Link
                to={item.href}
                title={t(item.name)}
                onClick={() => onMobileOpenChange(false)}
                className={linkCls(isActive)}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {navLabel(item.name)}
              </Link>
              {item.name === 'Budget' && permissions?.couple_expenses && (
                <Link
                  to="/couple-budget"
                  title={t('Budget Familiare')}
                  onClick={() => onMobileOpenChange(false)}
                  className={linkCls(location.pathname === '/couple-budget')}
                >
                  <HeartHandshake className="w-5 h-5 shrink-0" />
                  {navLabel('Budget Familiare')}
                </Link>
              )}
            </div>
          );
        })}

        {/* Sezione Poker - visibile solo agli utenti con permesso poker */}
        {permissions?.poker && (
          <Link
            to="/poker"
            title={t('Poker')}
            onClick={() => onMobileOpenChange(false)}
            className={linkCls(location.pathname === '/poker')}
          >
            <Dices className="w-5 h-5 shrink-0" />
            {navLabel('Poker')}
          </Link>
        )}

        {/* Sezione TCG - visibile solo agli utenti con permesso tcg */}
        {permissions?.tcg && (
          <Link
            to="/tcg"
            title={t('TCG')}
            onClick={() => onMobileOpenChange(false)}
            className={linkCls(location.pathname.startsWith('/tcg'))}
          >
            <Library className="w-5 h-5 shrink-0" />
            {navLabel('TCG')}
          </Link>
        )}

        {/* Sezione Libreria - visibile solo agli utenti con permesso libreria */}
        {permissions?.libreria && (
          <Link
            to="/libreria"
            title={t('Libreria')}
            onClick={() => onMobileOpenChange(false)}
            className={linkCls(location.pathname.startsWith('/libreria'))}
          >
            <BookOpen className="w-5 h-5 shrink-0" />
            {navLabel('Libreria')}
          </Link>
        )}

        {/* Sezione FIRE - visibile solo agli utenti con permesso fire */}
        {permissions?.fire && (
          <Link
            to="/fire"
            title={t('FIRE')}
            onClick={() => onMobileOpenChange(false)}
            className={linkCls(location.pathname.startsWith('/fire'))}
          >
            <Flame className="w-5 h-5 shrink-0" />
            {navLabel('FIRE')}
          </Link>
        )}

        {/* Sezione Fumo - visibile solo agli utenti con permesso fumo */}
        {permissions?.fumo && (
          <Link
            to="/fumo"
            title={t('Fumo')}
            onClick={() => onMobileOpenChange(false)}
            className={linkCls(location.pathname === '/fumo')}
          >
            <Cigarette className="w-5 h-5 shrink-0" />
            {navLabel('Fumo')}
          </Link>
        )}

      </nav>

      <div className={cn('p-4 border-t border-border shrink-0', iconOnly && 'px-3')}>
        {/* Sezione Admin - visibile solo agli admin */}
        {permissions?.admin && (
          <Link
            to="/admin"
            title={t('Amministrazione')}
            onClick={() => onMobileOpenChange(false)}
            className={linkCls(location.pathname === '/admin') + (iconOnly ? ' mb-2' : '')}
          >
            <Shield className="w-5 h-5 shrink-0" />
            {navLabel('Amministrazione')}
          </Link>
        )}
        <button
          onClick={() => {
            onMobileOpenChange(false);
            navigate('/settings');
          }}
          title={user?.email ?? undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer mb-2 w-full',
            iconOnly ? 'justify-center py-2' : 'px-4 py-2'
          )}
        >
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium shrink-0">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          {!iconOnly && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-left">{user?.email}</p>
            </div>
          )}
        </button>
        <Button
          variant="ghost"
          title={t('Esci')}
          className={cn(
            'justify-start text-muted-foreground hover:text-destructive',
            iconOnly ? 'w-full justify-center px-0' : 'w-full'
          )}
          onClick={signOut}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {navLabel('Esci')}
        </Button>
        {!iconOnly && (
          <div className="flex gap-3 px-4 pt-3 mt-2 border-t border-sidebar-border text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground hover:underline">{t('Privacy')}</Link>
            <Link to="/cookies" className="hover:text-foreground hover:underline">{t('Cookie')}</Link>
            <Link to="/terms" className="hover:text-foreground hover:underline">{t('Termini')}</Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMobileOpenChange(!mobileOpen)}
          className="glass"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-xs z-40"
          onClick={() => onMobileOpenChange(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          `lg:hidden fixed inset-y-0 left-0 z-40 ${SIDEBAR_WIDTH} bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 flex flex-col pb-[env(safe-area-inset-bottom)]`,
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border transition-[width] duration-200',
          collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
