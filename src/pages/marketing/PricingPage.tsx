import { Link } from 'react-router-dom';

function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-20 lg:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
          Simple pricing.<br />
          <span className="text-gotruf-500">No gotchas.</span>
        </h1>
        <p className="mt-6 text-xl text-gray-300 max-w-2xl mx-auto">
          Every report includes everything. No "premium" tier to unlock the measurements you actually
          need. No per-feature pricing. No annual contracts. No "contact sales."
        </p>
        <p className="mt-4 text-gotruf-400 font-semibold italic">
          "Check your receipt."
        </p>
      </div>
    </section>
  );
}

function PricingCardsSection() {
  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Pay Per Report */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pay Per Report</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-black text-gray-900">$9</span>
              <span className="text-2xl font-black text-gray-900">.99</span>
              <span className="text-gray-500 ml-1">/report</span>
            </div>
            <p className="mt-4 text-gray-500 text-sm leading-relaxed">
              No commitment. No subscription. Just pay when you need a report.
              Perfect for homeowners and occasional users.
            </p>

            <ul className="mt-8 space-y-3 flex-1">
              {[
                'Full roof measurements',
                'Pitch by facet (LIDAR-verified)',
                'All edge measurements',
                'Material & waste estimates',
                'PDF report download',
                '3D roof model',
                'Solar analysis included',
                'AI condition scoring',
                '5% accuracy guarantee',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to="/gotruf/signup"
              className="mt-8 block text-center bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Get Started
            </Link>
            <p className="text-xs text-gray-400 text-center mt-2">First report free</p>
          </div>

          {/* Monthly Plan */}
          <div className="bg-white rounded-2xl border-2 border-gotruf-400 p-8 flex flex-col relative shadow-lg shadow-gotruf-500/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gotruf-500 text-white text-xs font-bold px-4 py-1.5 rounded-full">
              MOST POPULAR
            </div>
            <div className="text-sm font-bold text-gotruf-600 uppercase tracking-wider">Pro Plan</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-black text-gray-900">$99</span>
              <span className="text-gray-500 ml-1">/month</span>
            </div>
            <p className="mt-2 text-sm text-gotruf-600 font-medium">25 reports included ($3.96/ea)</p>
            <p className="mt-3 text-gray-500 text-sm leading-relaxed">
              For contractors and adjusters who run reports regularly.
              Unused reports roll over to the next month.
            </p>

            <ul className="mt-8 space-y-3 flex-1">
              {[
                'Everything in Pay Per Report',
                '25 reports per month',
                'Unused reports roll over',
                'Xactimate ESX export',
                'Damage annotation tools',
                'Claims workflow',
                'Multi-property dashboard',
                'Priority support',
                'Bulk export tools',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to="/gotruf/signup"
              className="mt-8 block text-center bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-sm"
            >
              Start Pro Plan
            </Link>
            <p className="text-xs text-gray-400 text-center mt-2">First report free, then $99/mo</p>
          </div>

          {/* Enterprise */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Enterprise</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-black text-gray-900">Custom</span>
            </div>
            <p className="mt-4 text-gray-500 text-sm leading-relaxed">
              For carriers, large agencies, and high-volume contractors.
              Custom pricing, custom features, custom everything.
            </p>

            <ul className="mt-8 space-y-3 flex-1">
              {[
                'Everything in Pro Plan',
                'Custom report volume',
                'Volume pricing discounts',
                'Role-based access control',
                'Full audit trail',
                'API access',
                'White-label branding',
                'Dedicated account manager',
                'SLA guarantee',
                'Custom integrations',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="mailto:enterprise@gotruf.com"
              className="mt-8 block text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Contact Sales
            </a>
            <p className="text-xs text-gray-400 text-center mt-2">We'll build you a custom plan</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function GuaranteeSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-900 rounded-2xl p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gotruf-500/10 rounded-2xl mb-6">
            <svg className="w-8 h-8 text-gotruf-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>

          <h2 className="text-3xl font-black text-white">
            The 5% Accuracy Guarantee
          </h2>

          <div className="mt-6 space-y-4 text-gray-300 leading-relaxed max-w-2xl mx-auto">
            <p>
              Order a GotRuf report and an EagleView report for the same property. If our total roof area
              measurement differs by more than 5%, <strong className="text-white">we refund your report in full</strong>.
            </p>
            <p>
              That's it. That's the whole guarantee. No asterisks. No "terms and conditions apply."
              No 47-page legal document written by a guy who bills $800/hour.
            </p>
            <p className="text-gotruf-400 font-semibold">
              We're confident enough in our measurements to bet money on them.
              And we think that says more than any marketing copy ever could.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    {
      q: 'How can you be so much cheaper than EagleView?',
      a: 'EagleView employs hundreds of people to manually review aerial imagery. We use AI and automation. Same source data (satellite imagery + LIDAR), different process. Our API cost per report is about $0.06. We charge $9.99. That\'s a healthy margin without charging $40.',
    },
    {
      q: 'Do unused reports on the Pro plan really roll over?',
      a: 'Yes. If you use 20 of your 25 reports in January, you\'ll have 30 available in February. Reports accumulate up to a maximum of 75 (3 months worth). We\'re not going to penalize you for having a slow month.',
    },
    {
      q: 'What if I need more than 25 reports in a month?',
      a: 'Additional reports beyond your plan are $7.99 each. Or if you consistently need more, contact us about Enterprise pricing — we\'ll build a plan that fits your volume.',
    },
    {
      q: 'Is there a contract or commitment?',
      a: 'No. The Pro plan is month-to-month. Cancel anytime. We\'d rather keep you because the product is good than because you\'re locked in.',
    },
    {
      q: 'What areas do you cover?',
      a: 'Anywhere Google has satellite imagery and Solar API coverage — which is most residential properties in the United States. If we can\'t generate a report for your address, you won\'t be charged.',
    },
    {
      q: 'Can I white-label the reports with my company branding?',
      a: 'On the Enterprise plan, yes. Your logo, your colors, your company name. The homeowner sees your brand, not ours. On Pay Per Report and Pro, reports are GotRuf branded.',
    },
    {
      q: 'How long does a report take?',
      a: 'Usually under 60 seconds. Enter the address, click measure, download your PDF. We\'ve timed it — it takes longer to read this FAQ than to generate a report.',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black text-gray-900 text-center mb-14">
          Questions people actually ask.
        </h2>

        <div className="space-y-6">
          {faqs.map((faq) => (
            <div key={faq.q} className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900">{faq.q}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
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
          Try it for free. No credit card needed.
        </h2>
        <p className="mt-4 text-xl text-white/80 font-medium">
          Your first report is on the house. Pun intended.
        </p>

        <Link
          to="/gotruf/signup"
          className="mt-8 inline-block bg-white text-gotruf-700 font-bold text-lg py-3.5 px-10 rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
        >
          Create Free Account
        </Link>
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <>
      <HeroSection />
      <PricingCardsSection />
      <GuaranteeSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
