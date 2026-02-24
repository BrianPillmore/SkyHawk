import { Link } from 'react-router-dom';

function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-gotruf-500/10 border border-gotruf-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-gotruf-400 text-sm font-medium">For Insurance Agents &amp; Carriers</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Enterprise features.<br />
            <span className="text-gotruf-500">Startup pricing.</span>
          </h1>

          <p className="mt-6 text-xl text-gray-300 leading-relaxed max-w-2xl">
            Your policyholders don't know the difference between a $40 roof report and a $10 one.
            Your bottom line does. GotRuf gives your team professional-grade roof measurements
            with the workflow tools to match &mdash; at a price that makes finance smile.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              to="/signup"
              className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold text-lg py-3.5 px-8 rounded-xl transition-colors shadow-lg shadow-gotruf-500/25"
            >
              Start Free Trial
            </Link>
            <Link
              to="/pricing"
              className="bg-white/10 hover:bg-white/15 text-white font-semibold text-lg py-3.5 px-8 rounded-xl transition-colors border border-white/20"
            >
              Enterprise Pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValuePropSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center">
          What your agency actually needs.
        </h2>
        <p className="mt-4 text-lg text-gray-500 text-center max-w-2xl mx-auto">
          Not a 47-feature checklist designed to justify a 47-figure contract.
          Just the tools that matter, at a price that makes sense.
        </p>

        <div className="mt-14 space-y-10">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Claims Workflow Management</h3>
              <p className="text-gray-600 leading-relaxed">
                Track every claim from first notice to resolution. Timeline tracking, status management,
                multi-party comments, and document attachment. Your adjusters work in one system instead
                of juggling email, spreadsheets, and that one guy's Post-it notes.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Role-Based Access Control</h3>
              <p className="text-gray-600 leading-relaxed">
                Admins, adjusters, reviewers, and read-only users. Everyone sees exactly what they
                need to see. Audit logs track who did what and when. Your compliance team will send
                you a thank-you note. (They won't, but they'll stop sending you angry emails.)
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Bulk Report Processing</h3>
              <p className="text-gray-600 leading-relaxed">
                After a hail event, you don't need 200 reports one at a time. Our 25-report monthly plan
                handles your regular workflow at $3.96 per report. For storm events and enterprise
                volume, custom pricing keeps costs predictable when claim counts spike.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Xactimate Integration</h3>
              <p className="text-gray-600 leading-relaxed">
                ESX format export drops directly into your Xactimate workflow. No manual re-entry,
                no transposition errors, no late nights retyping measurements. Your adjusters
                will have the estimates written before the competition even has their report.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CostComparisonSection() {
  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-14">
          The math your CFO will love.
        </h2>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-4 px-6 text-sm font-bold text-gray-700">Scenario</th>
                <th className="text-right py-4 px-6 text-sm font-bold text-gray-400">EagleView</th>
                <th className="text-right py-4 px-6 text-sm font-bold text-gotruf-600">GotRuf</th>
                <th className="text-right py-4 px-6 text-sm font-bold text-green-600">You Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-4 px-6 text-gray-700">Small agency (10 reports/mo)</td>
                <td className="py-4 px-6 text-right font-mono text-gray-900">$4,800/yr</td>
                <td className="py-4 px-6 text-right font-mono text-gotruf-600">$1,188/yr</td>
                <td className="py-4 px-6 text-right font-mono font-bold text-green-600">$3,612</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-700">Mid-size firm (50 reports/mo)</td>
                <td className="py-4 px-6 text-right font-mono text-gray-900">$24,000/yr</td>
                <td className="py-4 px-6 text-right font-mono text-gotruf-600">$2,376/yr</td>
                <td className="py-4 px-6 text-right font-mono font-bold text-green-600">$21,624</td>
              </tr>
              <tr>
                <td className="py-4 px-6 text-gray-700">Enterprise (200 reports/mo)</td>
                <td className="py-4 px-6 text-right font-mono text-gray-900">$96,000/yr</td>
                <td className="py-4 px-6 text-right font-mono text-gotruf-600">Custom</td>
                <td className="py-4 px-6 text-right font-mono font-bold text-green-600">A lot</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6 italic">
          EagleView estimates based on published pricing of $35&ndash;45 per Premium report.
          GotRuf pricing based on 25-report plan at $99/month. Unused reports roll over.
        </p>
      </div>
    </section>
  );
}

function EnterpriseSection() {
  const features = [
    'Role-based access (admin, adjuster, reviewer, read-only)',
    'Full audit trail with timestamps',
    'Claims workflow with timeline tracking',
    'Multi-party collaboration and comments',
    'ESX/Xactimate format export',
    'Damage annotation and condition scoring',
    'Bulk report processing',
    'API access for system integration',
    'Custom branding (white-label)',
    'Dedicated support channel',
    'Custom volume pricing',
    'SLA guarantees',
  ];

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-4">
          Enterprise-grade. Human-priced.
        </h2>
        <p className="text-center text-lg text-gray-500 mb-14 max-w-2xl mx-auto">
          Everything below is included. Not "available for an additional fee."
          Not "contact sales to unlock." Included.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f} className="flex items-start gap-3 py-2">
              <svg className="w-5 h-5 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 lg:py-28 bg-gotruf-500">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-black text-white">
          Ready to modernize your claims workflow?
        </h2>
        <p className="mt-4 text-xl text-white/80 font-medium">
          Start with a free report. Scale to enterprise when you're ready.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/signup"
            className="bg-white text-gotruf-700 font-bold text-lg py-3.5 px-10 rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
          >
            Start Free Trial
          </Link>
          <Link
            to="/pricing"
            className="bg-white/10 hover:bg-white/20 text-white font-semibold text-lg py-3.5 px-8 rounded-xl transition-colors border border-white/30"
          >
            See Enterprise Pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function AgentsPage() {
  return (
    <>
      <HeroSection />
      <ValuePropSection />
      <CostComparisonSection />
      <EnterpriseSection />
      <CTASection />
    </>
  );
}
