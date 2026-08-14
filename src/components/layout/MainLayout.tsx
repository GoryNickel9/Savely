import { ReactNode, useEffect } from 'react';
import Sidebar from './Sidebar';
import { useProfile } from '@/hooks/useProfile';
import i18n from '@/i18n';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { profile } = useProfile();

  // Applica la lingua salvata sul profilo utente: la preferenza segue l'account
  // su qualunque dispositivo, non solo il browser corrente.
  useEffect(() => {
    if (profile?.language && profile.language !== i18n.language) {
      i18n.changeLanguage(profile.language);
    }
  }, [profile?.language]);

  return (
    <div className="min-h-screen bg-background dark">
      <Sidebar />
      <main className="lg:pl-72">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
