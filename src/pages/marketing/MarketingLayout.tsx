import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import LoginModal from '../../components/LoginModal';
import { updateDocumentMeta, setStructuredData, getOrganizationSchema } from '../../utils/seo';
import { initAnalytics, trackPageView } from '../../utils/analytics';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <svg className="w-8 h-8 text-gotruf-500 group-hover:text-gotruf-400 transition-colors" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2z" />
      </svg>
      <span className="text-xl font-black tracking-tight text-gray-900">
        Got<span className="text-gotruf-500">Ruf</span>
      </span>
    </Link>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        isActive ? 'text-gotruf-600' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setShowLoginModal = useStore((s) => s.setShowLoginModal);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black/25" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-72 bg-white shadow-xl p-6">
        <div className="flex justify-end mb-8">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-4">
          <Link to="/contractors" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">For Contractors</Link>
          <Link to="/adjusters" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">For Adjusters</Link>
          <Link to="/agents" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">For Agents</Link>
          <Link to="/homeowners" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">For Homeowners</Link>
          <Link to="/pricing" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">Pricing</Link>
          <hr className="my-2 border-gray-200" />
          <button onClick={() => { onClose(); setShowLoginModal(true); }} className="text-left text-gray-700 hover:text-gotruf-600 font-medium py-2">Log In</button>
          <Link to="/signup" onClick={onClose} className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-semibold py-2 px-4 rounded-lg text-center transition-colors">
            Get Free Report
          </Link>
        </nav>
      </div>
    </div>
  );
}

/** Page-specific SEO defaults based on the current route. */
function usePageSEO() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;

    // Each marketing page sets its own detailed SEO in its component,
    // but we provide sensible defaults here as a fallback.
    const defaults: Record<string, { title: string; description: string }> = {
      '/': {
        title: 'GotRuf \u2014 Professional Roof Measurements, Affordable Prices',
        description:
          'Instant roof measurements powered by satellite imagery and AI. Starting at $9.99. First report free. The affordable EagleView alternative.',
      },
      '/contractors': {
        title: 'For Roofing Contractors',
        description:
          'Professional roof measurement reports for contractors. Fast, accurate, and affordable. Replace EagleView at a fraction of the cost.',
      },
      '/adjusters': {
        title: 'For Insurance Adjusters',
        description:
          'Roof measurement and damage assessment reports for insurance adjusters. Xactimate-ready ESX exports included.',
      },
      '/agents': {
        title: 'For Insurance Agents',
        description:
          'Pre-inspection roof condition reports for insurance agents. AI condition scoring and risk assessment included.',
      },
      '/homeowners': {
        title: 'For Homeowners',
        description:
          'Know your roof before calling a contractor. Get an instant roof measurement report for just $9.99. First one free.',
      },
      '/pricing': {
        title: 'Pricing',
        description:
          'GotRuf roof measurement reports starting at $9.99. First report free. Pro plan $99/mo for 25 reports.',
      },
      '/signup': {
        title: 'Sign Up \u2014 Get Your Free Report',
        description:
          'Create a free GotRuf account and get your first roof measurement report at no cost. No credit card required.',
      },
    };

    const page = defaults[path];
    if (page) {
      updateDocumentMeta({
        title: page.title,
        description: page.description,
        canonical: `https://gotruf.com${path === '/' ? '' : path}`,
        ogImage: 'https://gotruf.com/og-default.png',
        keywords: [
          'roof measurements',
          'roof report',
          'eagleview alternative',
          'satellite roof measurement',
          'AI roof analysis',
        ],
      });
    }
  }, [location.pathname]);
}

/** Track page views on route change. */
function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
}

export default function MarketingLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const setShowLoginModal = useStore((s) => s.setShowLoginModal);

  // Initialize analytics once on layout mount
  useEffect(() => {
    initAnalytics();

    // Set organization structured data
    setStructuredData('organization', getOrganizationSchema());
  }, []);

  // SEO and analytics hooks
  usePageSEO();
  usePageTracking();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo />

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-8">
              <NavLink to="/contractors">Contractors</NavLink>
              <NavLink to="/adjusters">Adjusters</NavLink>
              <NavLink to="/agents">Agents</NavLink>
              <NavLink to="/homeowners">Homeowners</NavLink>
              <NavLink to="/pricing">Pricing</NavLink>
            </nav>

            <div className="hidden lg:flex items-center gap-4">
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Log In
              </button>
              <Link
                to="/signup"
                className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-semibold text-sm py-2 px-5 rounded-lg transition-colors shadow-sm"
              >
                Get Free Report
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Login Modal */}
      <LoginModal />

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-7 h-7 text-gotruf-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2z" />
                </svg>
                <span className="text-lg font-black text-white">
                  Got<span className="text-gotruf-500">Ruf</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                Professional roof measurements without the professional markup. Powered by satellite imagery and AI.
              </p>
              <p className="text-xs mt-4 text-gray-500 italic">"It sure ain't EagleView."</p>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Free Report</Link></li>
                <li><button onClick={() => setShowLoginModal(true)} className="hover:text-white transition-colors">Log In</button></li>
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Solutions</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/contractors" className="hover:text-white transition-colors">Roofing Contractors</Link></li>
                <li><Link to="/adjusters" className="hover:text-white transition-colors">Insurance Adjusters</Link></li>
                <li><Link to="/agents" className="hover:text-white transition-colors">Insurance Agents</Link></li>
                <li><Link to="/homeowners" className="hover:text-white transition-colors">Homeowners</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><span className="text-gray-500">Terms of Service</span></li>
                <li><span className="text-gray-500">Privacy Policy</span></li>
                <li><span className="text-gray-500">Accuracy Guarantee</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} GotRuf.com. All rights reserved.</p>
            <p className="text-xs text-gray-600">
              Powered by Google Solar API + AI Vision. Not affiliated with EagleView Technologies.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
