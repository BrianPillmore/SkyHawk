import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

function Logo() {
  return (
    <Link to="/gotruf" className="flex items-center gap-2 group">
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
          <Link to="/gotruf/contractors" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">For Contractors</Link>
          <Link to="/gotruf/adjusters" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">For Adjusters</Link>
          <Link to="/gotruf/agents" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">For Agents</Link>
          <Link to="/gotruf/homeowners" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">For Homeowners</Link>
          <Link to="/gotruf/pricing" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">Pricing</Link>
          <hr className="my-2 border-gray-200" />
          <Link to="/login" onClick={onClose} className="text-gray-700 hover:text-gotruf-600 font-medium py-2">Log In</Link>
          <Link to="/gotruf/signup" onClick={onClose} className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-semibold py-2 px-4 rounded-lg text-center transition-colors">
            Get Free Report
          </Link>
        </nav>
      </div>
    </div>
  );
}

export default function MarketingLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo />

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-8">
              <NavLink to="/gotruf/contractors">Contractors</NavLink>
              <NavLink to="/gotruf/adjusters">Adjusters</NavLink>
              <NavLink to="/gotruf/agents">Agents</NavLink>
              <NavLink to="/gotruf/homeowners">Homeowners</NavLink>
              <NavLink to="/gotruf/pricing">Pricing</NavLink>
            </nav>

            <div className="hidden lg:flex items-center gap-4">
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Log In
              </Link>
              <Link
                to="/gotruf/signup"
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
                <li><Link to="/gotruf/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to="/gotruf/signup" className="hover:text-white transition-colors">Free Report</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Log In</Link></li>
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Solutions</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/gotruf/contractors" className="hover:text-white transition-colors">Roofing Contractors</Link></li>
                <li><Link to="/gotruf/adjusters" className="hover:text-white transition-colors">Insurance Adjusters</Link></li>
                <li><Link to="/gotruf/agents" className="hover:text-white transition-colors">Insurance Agents</Link></li>
                <li><Link to="/gotruf/homeowners" className="hover:text-white transition-colors">Homeowners</Link></li>
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
