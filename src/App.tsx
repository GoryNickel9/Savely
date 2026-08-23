import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
// Code splitting per rotta (TD-007): ogni pagina è un chunk separato, così il
// bundle iniziale non include moduli pesanti (recharts, CRUD poker/fumo/tcg…)
// usati solo da chi accede a quelle sezioni.
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const RecurringExpenses = lazy(() => import("./pages/RecurringExpenses"));
const Budget = lazy(() => import("./pages/Budget"));
const Categories = lazy(() => import("./pages/Categories"));
const ChartsIndex = lazy(() => import("./pages/ChartsIndex"));
const ChartsIncomeExpense = lazy(() => import("./pages/ChartsIncomeExpense"));
const ChartsExpense = lazy(() => import("./pages/ChartsExpense"));
const ChartsIncome = lazy(() => import("./pages/ChartsIncome"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const NetWorth = lazy(() => import("./pages/NetWorth"));
const Insights = lazy(() => import("./pages/Insights"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const Poker = lazy(() => import("./pages/Poker"));
const PokerNextCut = lazy(() => import("./pages/PokerNextCut"));
const PokerHourlyEarnings = lazy(() => import("./pages/PokerHourlyEarnings"));
const PokerRakeback = lazy(() => import("./pages/PokerRakeback"));
const Fumo = lazy(() => import("./pages/Fumo"));
const FumoLiquidoSigaretta = lazy(() => import("./pages/FumoLiquidoSigaretta"));
const FumoCBD = lazy(() => import("./pages/FumoCBD"));
const FumoTHC = lazy(() => import("./pages/FumoTHC"));
const FIREIndex = lazy(() => import("./pages/fire/Index"));
const StandardFIRE = lazy(() => import("./pages/fire/StandardFIRE"));
const BaristaFIRE = lazy(() => import("./pages/fire/BaristaFIRE"));
const TcgIndex = lazy(() => import("./pages/tcg/Index"));
const TcgMagic = lazy(() => import("./pages/tcg/Magic"));
const TcgPokemon = lazy(() => import("./pages/tcg/Pokemon"));
const TcgYugioh = lazy(() => import("./pages/tcg/Yugioh"));
const LibreriaIndex = lazy(() => import("./pages/libreria/Index"));
const LibreriaLibri = lazy(() => import("./pages/libreria/Libri"));
const LibreriaFumetti = lazy(() => import("./pages/libreria/Fumetti"));
const LibreriaManga = lazy(() => import("./pages/libreria/Manga"));
const CoupleBudget = lazy(() => import("./pages/CoupleBudget"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Termini = lazy(() => import("./pages/Termini"));
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
 * LibreriaRoute / FumoRoute / CoupleRoute) which
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
    <Suspense fallback={<LoadingScreen />}>
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
      <Route path="/insights" element={<PermissionRoute><Insights /></PermissionRoute>} />
      <Route path="/fumo" element={<PermissionRoute perm="fumo"><Fumo /></PermissionRoute>} />
      <Route path="/fumo/liquido-sigaretta" element={<PermissionRoute perm="fumo"><FumoLiquidoSigaretta /></PermissionRoute>} />
      <Route path="/fumo/cbd" element={<PermissionRoute perm="fumo"><FumoCBD /></PermissionRoute>} />
      <Route path="/fumo/thc" element={<PermissionRoute perm="fumo"><FumoTHC /></PermissionRoute>} />
      <Route path="/poker" element={<PermissionRoute perm="poker"><Poker /></PermissionRoute>} />
      <Route path="/poker/next-cut" element={<PermissionRoute perm="poker"><PokerNextCut /></PermissionRoute>} />
      <Route path="/poker/hourly-earnings" element={<PermissionRoute perm="poker"><PokerHourlyEarnings /></PermissionRoute>} />
      <Route path="/poker/rakeback" element={<PermissionRoute perm="poker"><PokerRakeback /></PermissionRoute>} />
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
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <AppRoutes />
          <CookieBanner />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
