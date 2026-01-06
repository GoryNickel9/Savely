import { Link, useLocation, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transazioni', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Uscite Ricorrenti', href: '/recurring', icon: CalendarClock },
  { name: 'Budget', href: '/budget', icon: PiggyBank },
  { name: 'Grafici', href: '/charts', icon: BarChart3 },
  { name: 'Portfolio', href: '/portfolio', icon: LineChart },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { permissions } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 flex-shrink-0">
        <h1 className="text-2xl font-display font-bold">Spendy</h1>
        <p className="text-sm text-muted-foreground mt-1">La tua finanza personale semplificata</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}

        {/* Sezione Poker - visibile solo agli utenti con permesso poker */}
        {permissions?.poker && (
          <Link
            to="/poker"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname === '/poker'
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Dices className="w-5 h-5" />
            Poker
          </Link>
        )}

        {/* Sezione Fumo - visibile solo agli utenti con permesso fumo */}
        {permissions?.fumo && (
          <Link
            to="/fumo"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname === '/fumo'
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Cigarette className="w-5 h-5" />
            Fumo
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-border flex-shrink-0">
        {/* Sezione Admin - visibile solo agli admin */}
        {permissions?.admin && (
          <Link
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-2 mb-2 w-full rounded-lg text-sm font-medium transition-all duration-200',
              location.pathname === '/admin'
                ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Shield className="w-5 h-5" />
            Amministrazione
          </Link>
        )}
        <button
          onClick={() => {
            setMobileOpen(false);
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
          Esci
        </Button>
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
          onClick={() => setMobileOpen(!mobileOpen)}
          className="glass"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-40 w-72 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 flex flex-col',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <NavContent />
      </aside>
    </>
  );
}
