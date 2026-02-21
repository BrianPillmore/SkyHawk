import { useRef, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import Workspace from './pages/Workspace';
import Dashboard from './components/dashboard/Dashboard';
import AddressSearch from './components/map/AddressSearch';

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
          <svg className="w-7 h-7 text-skyhawk-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2zm0 2.84L19 12h-1.5v7.5h-3V13.5h-5v5.5h-3V12H5L12 4.84z" />
          </svg>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Sky<span className="text-skyhawk-500">Hawk</span>
          </h1>
        </div>
        <div className="flex-1 max-w-xl">
          <AddressSearch searchInputRef={searchInputRef} />
        </div>
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
      <Route path="/" element={<DashboardPage />} />
      <Route path="/workspace" element={<Workspace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
