import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function LoginModal() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useStore((s) => s.login);
  const showLoginModal = useStore((s) => s.showLoginModal);
  const setShowLoginModal = useStore((s) => s.setShowLoginModal);
  const navigate = useNavigate();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLoginModal(false);
    };
    if (showLoginModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showLoginModal, setShowLoginModal]);

  if (!showLoginModal) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      setShowLoginModal(false);
      setUsername('');
      setPassword('');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowLoginModal(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl p-8">
        {/* Close button */}
        <button
          onClick={() => setShowLoginModal(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-8 h-8 text-gotruf-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2z" />
            </svg>
            <span className="text-xl font-black text-gray-900">
              Got<span className="text-gotruf-500">Ruf</span>
            </span>
          </div>
          <p className="text-gray-500 text-sm">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-modal-username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="login-modal-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gotruf-500 focus:ring-2 focus:ring-gotruf-500/20"
              placeholder="Enter username"
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="login-modal-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="login-modal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gotruf-500 focus:ring-2 focus:ring-gotruf-500/20"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gotruf-500 hover:bg-gotruf-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          Don't have an account?{' '}
          <a
            href="/signup"
            onClick={(e) => { e.preventDefault(); setShowLoginModal(false); navigate('/signup'); }}
            className="text-gotruf-600 hover:text-gotruf-700 font-medium"
          >
            Sign up free
          </a>
        </p>
      </div>
    </div>
  );
}
