import { ReactNode, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

interface MainLayoutProps {
  children: ReactNode;
  /** Classi extra per il contenitore del contenuto (es. scope tema chiaro della dashboard). */
  contentClassName?: string;
}

export default function MainLayout({ children, contentClassName }: MainLayoutProps) {
  const { profile } = useProfile();
  // Stato del drawer mobile condiviso tra Sidebar e BottomNav ("Altro")
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Applica la lingua salvata sul profilo utente: la preferenza segue l'account
  // su qualunque dispositivo, non solo il browser corrente.
  useEffect(() => {
    if (profile?.language && profile.language !== i18n.language) {
      i18n.changeLanguage(profile.language);
    }
  }, [profile?.language]);

  return (
    <div className="min-h-screen bg-background dark">
      <Sidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <main className="lg:pl-72">
        {/* pb-28: spazio per la BottomNav su mobile (64px + respiro) */}
        <div className={cn('p-6 lg:p-8 pt-16 lg:pt-8 pb-28 lg:pb-8', contentClassName)}>
          {children}
        </div>
      </main>
      <BottomNav onOpenDrawer={() => setMobileNavOpen(true)} />
    </div>
  );
}
