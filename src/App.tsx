import { useRef, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import Workspace from './pages/Workspace';
import Dashboard from './components/dashboard/Dashboard';
import AddressSearch from './components/map/AddressSearch';
import ProtectedRoute from './components/ProtectedRoute';
import MarketingLayout from './pages/marketing/MarketingLayout';
import LandingPage from './pages/marketing/LandingPage';
import ContractorsPage from './pages/marketing/ContractorsPage';
import AdjustersPage from './pages/marketing/AdjustersPage';
import AgentsPage from './pages/marketing/AgentsPage';
import HomeownersPage from './pages/marketing/HomeownersPage';
import PricingPage from './pages/marketing/PricingPage';
import SignupPage from './pages/marketing/SignupPage';
import CheckoutSuccess from './pages/marketing/CheckoutSuccess';
import CheckoutCancel from './pages/marketing/CheckoutCancel';
import LoginRedirect from './pages/Login';
import AccountPage from './components/account/AccountPage';
import BatchProcessor from './components/batch/BatchProcessor';
import QuickEstimate from './components/estimate/QuickEstimate';
import SharedReportViewer from './pages/SharedReportViewer';
import AppNav from './components/layout/AppNav';

function DashboardPage() {
  const { activePropertyId } = useStore();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  if (activePropertyId) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-7 h-7 text-gotruf-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2zm0 2.84L19 12h-1.5v7.5h-3V13.5h-5v5.5h-3V12H5L12 4.84z" />
          </svg>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Got<span className="text-gotruf-500">Ruf</span>
          </h1>
        </div>
        <div className="flex-1 max-w-xl">
          <AddressSearch searchInputRef={searchInputRef} />
        </div>
        <AppNav />
      </header>
      <div className="flex-1">
        <Dashboard onAddProperty={focusSearch} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Marketing pages (public) — root-level */}
      <Route element={<MarketingLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="contractors" element={<ContractorsPage />} />
        <Route path="adjusters" element={<AdjustersPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="homeowners" element={<HomeownersPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="signup" element={<SignupPage />} />
      </Route>

      {/* Checkout result pages (inside MarketingLayout) */}
      <Route element={<MarketingLayout />}>
        <Route path="gotruf/checkout/success" element={<CheckoutSuccess />} />
        <Route path="gotruf/checkout/cancel" element={<CheckoutCancel />} />
      </Route>

      {/* Legacy /gotruf/* redirects (below checkout routes so they don't shadow) */}
      <Route path="/gotruf" element={<Navigate to="/" replace />} />
      <Route path="/gotruf/*" element={<Navigate to="/" replace />} />

      {/* Login redirect — opens modal on landing page */}
      <Route path="/login" element={<LoginRedirect />} />

      {/* Shared report viewer (public, no auth) */}
      <Route path="/shared/:token" element={<SharedReportViewer />} />

      {/* App routes (authenticated) */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/workspace" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      <Route path="/batch" element={<ProtectedRoute><BatchProcessor /></ProtectedRoute>} />
      <Route path="/estimate" element={<ProtectedRoute><QuickEstimate /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
