import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import RecurringExpenses from "./pages/RecurringExpenses";
import Budget from "./pages/Budget";
import Categories from "./pages/Categories";
import ChartsIndex from "./pages/ChartsIndex";
import ChartsIncomeExpense from "./pages/ChartsIncomeExpense";
import ChartsExpense from "./pages/ChartsExpense";
import ChartsIncome from "./pages/ChartsIncome";
import Portfolio from "./pages/Portfolio";
import NetWorth from "./pages/NetWorth";
import Forecast from "./pages/Forecast";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Poker from "./pages/Poker";
import PokerNextCut from "./pages/PokerNextCut";
import PokerHourlyEarnings from "./pages/PokerHourlyEarnings";
import PokerRakeback from "./pages/PokerRakeback";
import Fumo from "./pages/Fumo";
import FumoLiquidoSigaretta from "./pages/FumoLiquidoSigaretta";
import FumoCBD from "./pages/FumoCBD";
import FumoTHC from "./pages/FumoTHC";
import StatisticsDeepDive from "./pages/StatisticsDeepDive";
import FIREIndex from "./pages/fire/Index";
import StandardFIRE from "./pages/fire/StandardFIRE";
import BaristaFIRE from "./pages/fire/BaristaFIRE";
import TcgIndex from "./pages/tcg/Index";
import TcgMagic from "./pages/tcg/Magic";
import TcgPokemon from "./pages/tcg/Pokemon";
import TcgYugioh from "./pages/tcg/Yugioh";
import LibreriaIndex from "./pages/libreria/Index";
import LibreriaLibri from "./pages/libreria/Libri";
import LibreriaFumetti from "./pages/libreria/Fumetti";
import LibreriaManga from "./pages/libreria/Manga";import CoupleBudget from './pages/CoupleBudget';import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Termini from "./pages/Termini";
import CookieBanner from "@/components/CookieBanner";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Verifica se l'utente è admin
  if (!permissions?.admin) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function PokerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Verifica se l'utente ha il permesso poker
  if (!permissions?.poker) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function StatisticsDeepDiveRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Verifica se l'utente ha il permesso statistics_deep_dive
  if (!permissions?.statistics_deep_dive) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function FireRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Verifica se l'utente ha il permesso fire
  if (!permissions?.fire) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function TcgRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Verifica se l'utente ha il permesso tcg
  if (!permissions?.tcg) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function LibreriaRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Verifica se l'utente ha il permesso libreria
  if (!permissions?.libreria) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function FumoRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Verifica se l'utente ha il permesso fumo
  if (!permissions?.fumo) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function CoupleRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!permissions?.couple_expenses) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/terms" element={<Termini />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/recurring" element={<ProtectedRoute><RecurringExpenses /></ProtectedRoute>} />
      <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
      <Route path="/charts" element={<ProtectedRoute><ChartsIndex /></ProtectedRoute>} />
      <Route path="/charts/income-expense" element={<ProtectedRoute><ChartsIncomeExpense /></ProtectedRoute>} />
      <Route path="/charts/expense" element={<ProtectedRoute><ChartsExpense /></ProtectedRoute>} />
      <Route path="/charts/income" element={<ProtectedRoute><ChartsIncome /></ProtectedRoute>} />
      <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
      <Route path="/net-worth" element={<ProtectedRoute><NetWorth /></ProtectedRoute>} />
      <Route path="/forecast" element={<ProtectedRoute><Forecast /></ProtectedRoute>} />
      <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
      <Route path="/fumo" element={<FumoRoute><Fumo /></FumoRoute>} />
      <Route path="/fumo/liquido-sigaretta" element={<FumoRoute><FumoLiquidoSigaretta /></FumoRoute>} />
      <Route path="/fumo/cbd" element={<FumoRoute><FumoCBD /></FumoRoute>} />
      <Route path="/fumo/thc" element={<FumoRoute><FumoTHC /></FumoRoute>} />
      <Route path="/poker" element={<PokerRoute><Poker /></PokerRoute>} />
      <Route path="/poker/next-cut" element={<PokerRoute><PokerNextCut /></PokerRoute>} />
      <Route path="/poker/hourly-earnings" element={<PokerRoute><PokerHourlyEarnings /></PokerRoute>} />
      <Route path="/poker/rakeback" element={<PokerRoute><PokerRakeback /></PokerRoute>} />
      <Route path="/statistics-deep-dive" element={<StatisticsDeepDiveRoute><StatisticsDeepDive /></StatisticsDeepDiveRoute>} />
      <Route path="/fire" element={<FireRoute><FIREIndex /></FireRoute>} />
      <Route path="/fire/standard" element={<FireRoute><StandardFIRE /></FireRoute>} />
      <Route path="/fire/barista" element={<FireRoute><BaristaFIRE /></FireRoute>} />
      <Route path="/tcg" element={<TcgRoute><TcgIndex /></TcgRoute>} />
      <Route path="/tcg/magic" element={<TcgRoute><TcgMagic /></TcgRoute>} />
      <Route path="/tcg/pokemon" element={<TcgRoute><TcgPokemon /></TcgRoute>} />
      <Route path="/tcg/yugioh" element={<TcgRoute><TcgYugioh /></TcgRoute>} />
      <Route path="/libreria" element={<LibreriaRoute><LibreriaIndex /></LibreriaRoute>} />
      <Route path="/libreria/libri" element={<LibreriaRoute><LibreriaLibri /></LibreriaRoute>} />
      <Route path="/libreria/fumetti" element={<LibreriaRoute><LibreriaFumetti /></LibreriaRoute>} />
      <Route path="/libreria/manga" element={<LibreriaRoute><LibreriaManga /></LibreriaRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
      <Route path="/couple-budget" element={<CoupleRoute><CoupleBudget /></CoupleRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
          <CookieBanner />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
