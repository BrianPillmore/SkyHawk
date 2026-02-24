import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';

export default function SignupPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useStore((s) => s.login);
  const setShowLoginModal = useStore((s) => s.setShowLoginModal);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // TODO: Wire up to backend signup endpoint when available
      // For now, attempt login (backend will need a /register endpoint)
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Account creation is coming soon. For now, please contact us to get started.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900">
            Create your account
          </h1>
          <p className="mt-3 text-gray-500">
            Get your first roof report for free. No credit card required.
          </p>
        </div>

        {/* Free report badge */}
        <div className="bg-gotruf-50 border border-gotruf-200 rounded-xl p-4 mb-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-gotruf-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd" />
              <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z" />
            </svg>
            <span className="font-bold text-gotruf-700">1 free report</span>
            <span className="text-gotruf-600">included with every new account</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="signup-username" className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                id="signup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gotruf-500 focus:ring-2 focus:ring-gotruf-500/20"
                placeholder="Choose a username"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gotruf-500 focus:ring-2 focus:ring-gotruf-500/20"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gotruf-500 focus:ring-2 focus:ring-gotruf-500/20"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="signup-confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <input
                id="signup-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gotruf-500 focus:ring-2 focus:ring-gotruf-500/20"
                placeholder="Type it again"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gotruf-500 hover:bg-gotruf-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-sm"
          >
            {loading ? 'Creating account...' : 'Create Account & Get Free Report'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <button onClick={() => setShowLoginModal(true)} className="text-gotruf-600 hover:text-gotruf-700 font-medium">
              Log in
            </button>
          </p>
        </div>

        {/* What's included */}
        <div className="mt-12 bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider mb-4">
            Your free report includes:
          </h3>
          <ul className="space-y-2">
            {[
              'Total roof area with pitch adjustment',
              'Per-facet pitch measurements (LIDAR-verified)',
              'All edge measurements (ridge, hip, valley, rake, eave)',
              'Material & waste estimates',
              'Downloadable PDF report',
              'Interactive 3D roof model',
              'Solar analysis',
              'AI roof condition score',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
