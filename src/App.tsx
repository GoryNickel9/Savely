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
import LibreriaManga from "./pages/libreria/Manga";
import CoupleBudget from "./pages/CoupleBudget";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Termini from "./pages/Termini";
import CookieBanner from "@/components/CookieBanner";
import type { Permissions } from "@/lib/types";

const queryClient = new QueryClient();

// Single reusable full-screen loading state. Replaces the 9 inline copies of
// this same block that previously lived in each route guard below.
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark">
      <div className="animate-pulse text-muted-foreground">Caricamento...</div>
    </div>
  );
}

/**
 * Unified route guard. Replaces the previous 9 copy-pasted guards
 * (ProtectedRoute / AdminRoute / PokerRoute / FireRoute / TcgRoute /
 * LibreriaRoute / FumoRoute / CoupleRoute / StatisticsDeepDiveRoute) which
 * differed only by the permission key they checked.
 *
 * - `perm` omitted  → only authentication is required (the old ProtectedRoute).
 * - `perm` provided → authentication + the named permission must be true.
 */
function PermissionRoute({
  perm,
  children,
}: {
  perm?: keyof Permissions;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();

  if (loading || (perm && permissionsLoading)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (perm && !permissions?.[perm]) {
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
      <Route path="/" element={<PermissionRoute><Dashboard /></PermissionRoute>} />
      <Route path="/transactions" element={<PermissionRoute><Transactions /></PermissionRoute>} />
      <Route path="/recurring" element={<PermissionRoute><RecurringExpenses /></PermissionRoute>} />
      <Route path="/budget" element={<PermissionRoute><Budget /></PermissionRoute>} />
      <Route path="/categories" element={<PermissionRoute><Categories /></PermissionRoute>} />
      <Route path="/charts" element={<PermissionRoute><ChartsIndex /></PermissionRoute>} />
      <Route path="/charts/income-expense" element={<PermissionRoute><ChartsIncomeExpense /></PermissionRoute>} />
      <Route path="/charts/expense" element={<PermissionRoute><ChartsExpense /></PermissionRoute>} />
      <Route path="/charts/income" element={<PermissionRoute><ChartsIncome /></PermissionRoute>} />
      <Route path="/portfolio" element={<PermissionRoute><Portfolio /></PermissionRoute>} />
      <Route path="/net-worth" element={<PermissionRoute><NetWorth /></PermissionRoute>} />
      <Route path="/forecast" element={<PermissionRoute><Forecast /></PermissionRoute>} />
      <Route path="/insights" element={<PermissionRoute><Insights /></PermissionRoute>} />
      <Route path="/fumo" element={<PermissionRoute perm="fumo"><Fumo /></PermissionRoute>} />
      <Route path="/fumo/liquido-sigaretta" element={<PermissionRoute perm="fumo"><FumoLiquidoSigaretta /></PermissionRoute>} />
      <Route path="/fumo/cbd" element={<PermissionRoute perm="fumo"><FumoCBD /></PermissionRoute>} />
      <Route path="/fumo/thc" element={<PermissionRoute perm="fumo"><FumoTHC /></PermissionRoute>} />
      <Route path="/poker" element={<PermissionRoute perm="poker"><Poker /></PermissionRoute>} />
      <Route path="/poker/next-cut" element={<PermissionRoute perm="poker"><PokerNextCut /></PermissionRoute>} />
      <Route path="/poker/hourly-earnings" element={<PermissionRoute perm="poker"><PokerHourlyEarnings /></PermissionRoute>} />
      <Route path="/poker/rakeback" element={<PermissionRoute perm="poker"><PokerRakeback /></PermissionRoute>} />
      <Route path="/statistics-deep-dive" element={<PermissionRoute perm="statistics_deep_dive"><StatisticsDeepDive /></PermissionRoute>} />
      <Route path="/fire" element={<PermissionRoute perm="fire"><FIREIndex /></PermissionRoute>} />
      <Route path="/fire/standard" element={<PermissionRoute perm="fire"><StandardFIRE /></PermissionRoute>} />
      <Route path="/fire/barista" element={<PermissionRoute perm="fire"><BaristaFIRE /></PermissionRoute>} />
      <Route path="/tcg" element={<PermissionRoute perm="tcg"><TcgIndex /></PermissionRoute>} />
      <Route path="/tcg/magic" element={<PermissionRoute perm="tcg"><TcgMagic /></PermissionRoute>} />
      <Route path="/tcg/pokemon" element={<PermissionRoute perm="tcg"><TcgPokemon /></PermissionRoute>} />
      <Route path="/tcg/yugioh" element={<PermissionRoute perm="tcg"><TcgYugioh /></PermissionRoute>} />
      <Route path="/libreria" element={<PermissionRoute perm="libreria"><LibreriaIndex /></PermissionRoute>} />
      <Route path="/libreria/libri" element={<PermissionRoute perm="libreria"><LibreriaLibri /></PermissionRoute>} />
      <Route path="/libreria/fumetti" element={<PermissionRoute perm="libreria"><LibreriaFumetti /></PermissionRoute>} />
      <Route path="/libreria/manga" element={<PermissionRoute perm="libreria"><LibreriaManga /></PermissionRoute>} />
      <Route path="/settings" element={<PermissionRoute><Settings /></PermissionRoute>} />
      <Route path="/admin" element={<PermissionRoute perm="admin"><Admin /></PermissionRoute>} />
      <Route path="/couple-budget" element={<PermissionRoute perm="couple_expenses"><CoupleBudget /></PermissionRoute>} />
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
