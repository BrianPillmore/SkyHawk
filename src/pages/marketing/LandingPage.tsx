import { Link } from 'react-router-dom';

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Subtle roof pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px)`,
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-gotruf-500/10 border border-gotruf-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="text-gotruf-400 text-sm font-medium">Your first report is free</span>
            <svg className="w-4 h-4 text-gotruf-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.1]">
            Got <span className="text-gotruf-500">Ruf</span>?
          </h1>

          <p className="mt-6 text-xl sm:text-2xl text-gray-300 font-medium max-w-2xl mx-auto leading-relaxed">
            Professional roof measurements.<br />
            Without the professional markup.
          </p>

          <p className="mt-4 text-lg text-gotruf-400 font-semibold italic">
            "It sure ain't EagleView."
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/gotruf/signup"
              className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold text-lg py-3.5 px-8 rounded-xl transition-all shadow-lg shadow-gotruf-500/25 hover:shadow-gotruf-500/40"
            >
              Get Your Free Report
            </Link>
            <Link
              to="/gotruf/pricing"
              className="bg-white/10 hover:bg-white/15 text-white font-semibold text-lg py-3.5 px-8 rounded-xl transition-colors border border-white/20"
            >
              See Pricing
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>5% accuracy guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Instant delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>$9.99 per report</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TheDealSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center">
          Here's the deal.
        </h2>
        <div className="mt-10 space-y-6 text-lg text-gray-600 leading-relaxed">
          <p>
            EagleView charges you <strong className="text-gray-900">$35&ndash;45 per roof report</strong>. For that
            kind of money, you could buy a decent cordless drill. Or take your crew to lunch. Or &mdash; hear us
            out &mdash; get <strong className="text-gray-900">the same measurements from us for $9.99</strong>.
          </p>
          <p>
            Same satellite imagery. Same measurement types. Same accuracy
            (we <Link to="/gotruf/pricing" className="text-gotruf-600 hover:text-gotruf-700 underline underline-offset-2">guarantee within 5%</Link> or
            your money back). Just... <strong className="text-gray-900">75% cheaper</strong>.
          </p>
          <p>
            We're not going to pretend we're something we're not. EagleView is the Cadillac of roof
            measurement. Heated seats, leather interior, a little logo on the steering wheel. Great if
            you need all that.
          </p>
          <p>
            GotRuf is the <strong className="text-gray-900">Honda Accord</strong>. Gets you there. Every time.
            Doesn't apologize for it.
          </p>
        </div>

        {/* Comparison */}
        <div className="mt-14 grid sm:grid-cols-2 gap-6">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">The Other Guys</div>
            <div className="text-4xl font-black text-gray-900">$35&ndash;45</div>
            <div className="text-gray-500 mt-1">per report</div>
            <ul className="mt-4 space-y-2 text-sm text-gray-500">
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">&#x2022;</span>
                <span>Same satellite data you can see on Google Maps</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">&#x2022;</span>
                <span>Delivered sometime between now and eventually</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">&#x2022;</span>
                <span>That satisfying feeling of overpaying</span>
              </li>
            </ul>
          </div>
          <div className="bg-gotruf-50 border-2 border-gotruf-300 rounded-xl p-6 relative">
            <div className="absolute -top-3 right-4 bg-gotruf-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              SAVE 75%
            </div>
            <div className="text-sm font-semibold text-gotruf-600 uppercase tracking-wider mb-2">GotRuf</div>
            <div className="text-4xl font-black text-gray-900">$9.99</div>
            <div className="text-gray-500 mt-1">per report</div>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>LIDAR-verified satellite measurements</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Instant delivery &mdash; measured while you wait</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>5% accuracy guarantee or money back</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function AudienceSection() {
  const audiences = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
      ),
      title: 'Roofing Contractors',
      description: 'Stop subsidizing EagleView\'s corporate retreat. Get the same measurements at a fraction of the cost.',
      link: '/gotruf/contractors',
      cta: 'Save on every job',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      ),
      title: 'Insurance Adjusters',
      description: 'Same accuracy. Friendlier receipt. Compliance-ready reports your carrier will actually accept.',
      link: '/gotruf/adjusters',
      cta: 'See adjuster features',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      ),
      title: 'Insurance Agents',
      description: 'Enterprise features without enterprise pricing. Your policyholders won\'t know the difference. Your budget will.',
      link: '/gotruf/agents',
      cta: 'Explore enterprise',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
        </svg>
      ),
      title: 'Homeowners',
      description: 'Your first report is free. Know your roof before the contractor shows up. No surprises.',
      link: '/gotruf/homeowners',
      cta: 'Get your free report',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Built for people who actually work on roofs.
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            And the people who insure them, sell policies for them, and live under them.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {audiences.map((a) => (
            <Link
              key={a.title}
              to={a.link}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gotruf-300 hover:shadow-lg transition-all group"
            >
              <div className="text-gotruf-500 mb-4 group-hover:text-gotruf-600 transition-colors">
                {a.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{a.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{a.description}</p>
              <span className="text-sm font-semibold text-gotruf-600 group-hover:text-gotruf-700 inline-flex items-center gap-1">
                {a.cta}
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhatYouGetSection() {
  const features = [
    {
      title: 'Total Roof Area',
      description: 'Pitch-adjusted square footage for every facet. Not just the footprint — the actual roof.',
    },
    {
      title: 'Pitch by Facet',
      description: 'LIDAR-verified pitch for each roof section, not one averaged number for the whole house.',
    },
    {
      title: 'Edge Measurements',
      description: 'Ridge, hip, valley, rake, eave, and flashing — all measured and labeled in linear feet.',
    },
    {
      title: 'Waste Calculation',
      description: 'Material waste factor calibrated against EagleView\'s own methodology. Within 5% or your money back.',
    },
    {
      title: 'Material Estimates',
      description: 'Squares, bundles, starter, cap, ice & water, drip edge, vents — ready for your supply order.',
    },
    {
      title: 'PDF Reports',
      description: 'Clean, professional reports your clients and carriers will accept. Branded with your info if you want.',
    },
    {
      title: '3D Visualization',
      description: 'Interactive 3D roof model. Rotate, zoom, click facets. Better than a photo album.',
    },
    {
      title: 'Damage Assessment',
      description: 'AI-powered roof condition scoring. Annotate damage areas for insurance documentation.',
    },
    {
      title: 'Solar Analysis',
      description: 'Panel placement, production estimates, shading analysis. The whole solar pitch, built in.',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Everything you need. Nothing you don't.
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Every report includes all of this. No upsells, no premium tiers for basic features,
            no "contact sales for the measurements you actually need."
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="shrink-0 mt-1">
                <div className="w-8 h-8 bg-gotruf-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gotruf-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccuracySection() {
  return (
    <section className="py-20 lg:py-28 bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gotruf-500/10 rounded-2xl mb-8">
          <svg className="w-8 h-8 text-gotruf-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black">
          We put our money where our shingles are.
        </h2>

        <div className="mt-8 max-w-2xl mx-auto space-y-4 text-lg text-gray-300 leading-relaxed">
          <p>
            <strong className="text-white">Within 5% of EagleView measurements, or we refund you.</strong>
          </p>
          <p>
            No questions asked. No fine print. No arguing about it. Order an EagleView report for the
            same property, and if our numbers are off by more than 5%, we'll give you your $9.99 back.
          </p>
          <p className="text-gotruf-400 font-medium">
            Honestly, we'll probably also buy you a coffee. Because that's never happened.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg mx-auto">
          <div>
            <div className="text-3xl font-black text-gotruf-400">5%</div>
            <div className="text-xs text-gray-500 mt-1">Accuracy guarantee</div>
          </div>
          <div>
            <div className="text-3xl font-black text-gotruf-400">100%</div>
            <div className="text-xs text-gray-500 mt-1">Money-back</div>
          </div>
          <div>
            <div className="text-3xl font-black text-gotruf-400">0</div>
            <div className="text-xs text-gray-500 mt-1">Fine print</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      num: '1',
      title: 'Enter the address',
      description: 'Type it in. We\'ll find the roof. Our satellite imagery covers every residential property in the US.',
    },
    {
      num: '2',
      title: 'We measure it',
      description: 'LIDAR + AI + satellite data. Facets, pitches, edges, areas — all calculated in seconds. Not hours. Seconds.',
    },
    {
      num: '3',
      title: 'Download your report',
      description: 'Professional PDF with everything you need. Material estimates, waste factors, 3D model. Done.',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Three steps. That's it.
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            No scheduling. No waiting. No phone calls. No "let me transfer you."
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gotruf-500 text-white font-black text-lg rounded-full mb-4">
                {s.num}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-gray-500 leading-relaxed">{s.description}</p>
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
          Your first report is on us.
        </h2>
        <p className="mt-4 text-xl text-white/80 font-medium">
          No credit card. No catch. No kidding.
        </p>
        <p className="mt-2 text-white/60">
          Create an account, measure your first property, and see what all the fuss is about. Or isn't about.
          We're pretty low-key.
        </p>

        <Link
          to="/gotruf/signup"
          className="mt-8 inline-block bg-white text-gotruf-700 font-bold text-lg py-3.5 px-10 rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
        >
          Create Free Account
        </Link>

        <p className="mt-6 text-sm text-white/50 italic">
          "Home of the first one's free."
        </p>
      </div>
    </section>
  );
}

function CheckYourReceiptBanner() {
  return (
    <section className="py-6 bg-gray-100 border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">Fun fact:</span> If you're running 50 reports a month
          with EagleView, you're spending <strong className="text-gray-900">$1,750&ndash;$2,250/month</strong>.
          With GotRuf, that same workload costs <strong className="text-gotruf-600">$99/month</strong>.
          That's an extra $1,651 for tools, payroll, or that boat you've been eyeing.{' '}
          <span className="italic">Check your receipt.</span>
        </p>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <CheckYourReceiptBanner />
      <TheDealSection />
      <AudienceSection />
      <WhatYouGetSection />
      <HowItWorksSection />
      <AccuracySection />
      <CTASection />
    </>
  );
}
