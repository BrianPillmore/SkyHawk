import { Link } from 'react-router-dom';

function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-gotruf-500/10 border border-gotruf-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-gotruf-400 text-sm font-medium">For Roofing Contractors</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Your margins called.<br />
            <span className="text-gotruf-500">They want their money back.</span>
          </h1>

          <p className="mt-6 text-xl text-gray-300 leading-relaxed max-w-2xl">
            You're paying $35&ndash;45 per EagleView report. Multiply that by every bid you run, and you're
            basically funding their holiday party. GotRuf gives you the same measurements
            for <strong className="text-white">$9.99</strong>. That's not a typo.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              to="/gotruf/signup"
              className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold text-lg py-3.5 px-8 rounded-xl transition-colors shadow-lg shadow-gotruf-500/25"
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
        </div>
      </div>
    </section>
  );
}

function PainPointsSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center">
          Let's talk about what's eating your profit.
        </h2>

        <div className="mt-12 space-y-8">
          <div className="flex gap-6 items-start">
            <div className="shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">$</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">$35&ndash;45 per report adds up fast</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                Running 20 bids a month? That's $700&ndash;900 just in measurement reports. Not all those
                bids convert. You're paying for reports on jobs you didn't get. Meanwhile, your nail gun
                needs a new battery and the guys are asking about raises.
              </p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="shrink-0 w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">&#9201;</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Waiting for reports kills momentum</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                Homeowner's ready to sign right now. You're standing in their kitchen saying "the report
                should be here by tomorrow." By tomorrow, they've gotten three other quotes. GotRuf
                delivers instantly. Like, while-you're-still-in-the-kitchen instantly.
              </p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="shrink-0 w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">&#x26A0;</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Reports with wrong pitch = wrong material order</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                Nothing says "great day at work" like realizing you're 10 squares short because
                the report had the wrong pitch. Our LIDAR-verified measurements cross-check pitch
                against actual elevation data. We double-check so you don't have to make a second
                trip to the supply house.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ROISection() {
  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-14">
          Do the math. We'll wait.
        </h2>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            <div className="p-8">
              <h3 className="font-bold text-gray-400 uppercase text-sm tracking-wider mb-6">With EagleView</h3>
              <div className="space-y-4 text-gray-600">
                <div className="flex justify-between">
                  <span>20 reports/month</span>
                  <span className="font-mono text-gray-900">$800</span>
                </div>
                <div className="flex justify-between">
                  <span>50 reports/month</span>
                  <span className="font-mono text-gray-900">$2,000</span>
                </div>
                <div className="flex justify-between">
                  <span>100 reports/month</span>
                  <span className="font-mono text-gray-900">$4,000</span>
                </div>
                <div className="border-t border-gray-200 pt-4 flex justify-between">
                  <span className="font-bold text-gray-900">Annual cost (50/mo)</span>
                  <span className="font-mono font-bold text-red-600">$24,000</span>
                </div>
              </div>
            </div>
            <div className="p-8 bg-gotruf-50/50">
              <h3 className="font-bold text-gotruf-600 uppercase text-sm tracking-wider mb-6">With GotRuf</h3>
              <div className="space-y-4 text-gray-600">
                <div className="flex justify-between">
                  <span>Pay-per-report</span>
                  <span className="font-mono text-gray-900">$9.99/ea</span>
                </div>
                <div className="flex justify-between">
                  <span>25 reports/month plan</span>
                  <span className="font-mono text-gray-900">$99/mo</span>
                </div>
                <div className="flex justify-between">
                  <span>Unused reports</span>
                  <span className="font-mono text-green-600">Roll over</span>
                </div>
                <div className="border-t border-gray-200 pt-4 flex justify-between">
                  <span className="font-bold text-gray-900">Annual cost (25/mo plan)</span>
                  <span className="font-mono font-bold text-green-600">$1,188</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gotruf-500 text-white text-center py-4 font-bold text-lg">
            You save $22,812/year. That's a used truck.
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      title: 'Instant Material Takeoff',
      description: 'Squares, bundles, starter, cap, ice & water shield, drip edge, pipe boots, ridge vent. Ready for your supply house order before you leave the driveway.',
    },
    {
      title: 'Accurate Waste Factors',
      description: 'Our waste algorithm is calibrated against EagleView\'s methodology across 18 properties. Complex hip roofs, simple gables, everything in between.',
    },
    {
      title: 'Professional PDF Reports',
      description: 'Hand the homeowner a clean, branded report. Looks like you spent the big bucks. Your secret is safe with us.',
    },
    {
      title: 'Xactimate-Compatible Export',
      description: 'ESX format export for insurance jobs. Drop it right into Xactimate. No retyping measurements at 11pm.',
    },
    {
      title: '3D Roof Model',
      description: 'Show the homeowner their roof in 3D right on your tablet. Spin it around, point to the facets, look like a wizard.',
    },
    {
      title: 'Multi-Property Dashboard',
      description: 'All your properties in one place. Search, filter, pull up old reports. Better than that stack of papers in your truck.',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-14">
          What contractors actually need.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialSection() {
  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <blockquote className="text-2xl sm:text-3xl font-bold text-gray-900 leading-relaxed">
          "I used to spend $1,200 a month on EagleView reports. Now I spend $99. I don't miss the Cadillac. The Honda gets me to the job site just fine."
        </blockquote>
        <div className="mt-6 text-gray-500">
          <span className="font-semibold text-gray-700">&mdash; Every contractor</span> who does the math
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
          Stop overpaying for roof reports.
        </h2>
        <p className="mt-4 text-xl text-white/80 font-medium">
          Your first report is free. See for yourself.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/gotruf/signup"
            className="bg-white text-gotruf-700 font-bold text-lg py-3.5 px-10 rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
          >
            Get Your Free Report
          </Link>
          <Link
            to="/gotruf/pricing"
            className="bg-white/10 hover:bg-white/20 text-white font-semibold text-lg py-3.5 px-8 rounded-xl transition-colors border border-white/30"
          >
            Compare Plans
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function ContractorsPage() {
  return (
    <>
      <HeroSection />
      <PainPointsSection />
      <ROISection />
      <FeaturesSection />
      <TestimonialSection />
      <CTASection />
    </>
  );
}
