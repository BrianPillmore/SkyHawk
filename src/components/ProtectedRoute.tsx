import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const setShowLoginModal = useStore((s) => s.setShowLoginModal);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
    }
  }, [isAuthenticated, setShowLoginModal]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
