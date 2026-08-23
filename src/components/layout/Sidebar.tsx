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
} from 'lucide-react';

// Layout constants
const SIDEBAR_WIDTH = 'w-72'; // 18rem = 288px

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
}

export default function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { permissions } = usePermissions();

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 shrink-0">
        <h1 className="text-2xl font-display font-bold">{t('Savely')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('La tua finanza personale semplificata')}</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <div key={item.name}>
              <Link
                to={item.href}
                onClick={() => onMobileOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                {t(item.name)}
              </Link>
              {item.name === 'Budget' && permissions?.couple_expenses && (
                <Link
                  to="/couple-budget"
                  onClick={() => onMobileOpenChange(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                    location.pathname === '/couple-budget'
                      ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <HeartHandshake className="w-5 h-5" />
                  {t('Budget Familiare')}
                </Link>
              )}
            </div>
          );
        })}

        {/* Sezione Poker - visibile solo agli utenti con permesso poker */}
        {permissions?.poker && (
          <Link
            to="/poker"
            onClick={() => onMobileOpenChange(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname === '/poker'
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Dices className="w-5 h-5" />
            {t('Poker')}
          </Link>
        )}

        {/* Sezione TCG - visibile solo agli utenti con permesso tcg */}
        {permissions?.tcg && (
          <Link
            to="/tcg"
            onClick={() => onMobileOpenChange(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname.startsWith('/tcg')
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Library className="w-5 h-5" />
            {t('TCG')}
          </Link>
        )}

        {/* Sezione Libreria - visibile solo agli utenti con permesso libreria */}
        {permissions?.libreria && (
          <Link
            to="/libreria"
            onClick={() => onMobileOpenChange(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname.startsWith('/libreria')
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <BookOpen className="w-5 h-5" />
            {t('Libreria')}
          </Link>
        )}

        {/* Sezione FIRE - visibile solo agli utenti con permesso fire */}
        {permissions?.fire && (
          <Link
            to="/fire"
            onClick={() => onMobileOpenChange(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname.startsWith('/fire')
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Flame className="w-5 h-5" />
            {t('FIRE')}
          </Link>
        )}

        {/* Sezione Fumo - visibile solo agli utenti con permesso fumo */}
        {permissions?.fumo && (
          <Link
            to="/fumo"
            onClick={() => onMobileOpenChange(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname === '/fumo'
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Cigarette className="w-5 h-5" />
            {t('Fumo')}
          </Link>
        )}

      </nav>

      <div className="p-4 border-t border-border shrink-0">
        {/* Sezione Admin - visibile solo agli admin */}
        {permissions?.admin && (
          <Link
            to="/admin"
            onClick={() => onMobileOpenChange(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-2 mb-2 w-full rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname === '/admin'
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Shield className="w-5 h-5" />
            {t('Amministrazione')}
          </Link>
        )}
        <button
          onClick={() => {
            onMobileOpenChange(false);
            navigate('/settings');
          }}
          className="flex items-center gap-3 px-4 py-2 mb-2 w-full rounded-lg hover:bg-secondary transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-left">{user?.email}</p>
          </div>
        </button>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="w-5 h-5 mr-3" />
          {t('Esci')}
        </Button>
        <div className="flex gap-3 px-4 pt-3 mt-2 border-t border-sidebar-border text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground hover:underline">{t('Privacy')}</Link>
          <Link to="/cookies" className="hover:text-foreground hover:underline">{t('Cookie')}</Link>
          <Link to="/terms" className="hover:text-foreground hover:underline">{t('Termini')}</Link>
        </div>
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
      <aside className={`hidden lg:flex lg:${SIDEBAR_WIDTH} lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border`}>
        <NavContent />
      </aside>
    </>
  );
}
