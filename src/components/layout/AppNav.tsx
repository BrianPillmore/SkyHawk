import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import NotificationCenter from '../notifications/NotificationCenter';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { path: '/batch', label: 'Batch', icon: BatchIcon },
  { path: '/account', label: 'Account', icon: AccountIcon },
] as const;

export default function AppNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, logout } = useStore();

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
      <div className="h-4 w-px bg-gray-700 mx-1" />
      <NotificationCenter />
      <div className="h-4 w-px bg-gray-700 mx-1" />
      {username && (
        <span className="text-xs text-gray-500 mr-1">{username}</span>
      )}
      <button
        onClick={() => { logout(); navigate('/'); }}
        className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1"
      >
        Log out
      </button>
    </nav>
  );
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function BatchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  );
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
