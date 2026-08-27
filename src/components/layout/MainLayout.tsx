import { ReactNode, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const SIDEBAR_COLLAPSED_KEY = 'savely-sidebar-collapsed';

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { profile } = useProfile();
  // Stato del drawer mobile condiviso tra Sidebar e BottomNav ("Altro")
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Sidebar ridotta a icone (solo desktop): preferenza persistente sul dispositivo
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // localStorage non disponibile: la preferenza resta solo per la sessione
      }
      return next;
    });
  };

  // Applica la lingua salvata sul profilo utente: la preferenza segue l'account
  // su qualunque dispositivo, non solo il browser corrente.
  useEffect(() => {
    if (profile?.language && profile.language !== i18n.language) {
      i18n.changeLanguage(profile.language);
    }
  }, [profile?.language]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />
      <main className={cn('transition-[padding] duration-200', sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-72')}>
        {/* pb-28: spazio per la BottomNav su mobile (64px + respiro) */}
        <div className="p-6 lg:p-8 pt-16 lg:pt-8 pb-28 lg:pb-8">
          {children}
        </div>
      </main>
      <BottomNav onOpenDrawer={() => setMobileNavOpen(true)} />
    </div>
  );
}
