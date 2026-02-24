import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function LoginRedirect() {
  const setShowLoginModal = useStore((s) => s.setShowLoginModal);

  useEffect(() => {
    setShowLoginModal(true);
  }, [setShowLoginModal]);

  return <Navigate to="/" replace />;
}
