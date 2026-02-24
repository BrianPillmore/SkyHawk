import { Link } from 'react-router-dom';

function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-gotruf-500/10 border border-gotruf-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-gotruf-400 text-sm font-medium">For Homeowners</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Know your roof<br />
            <span className="text-gotruf-500">before the contractor does.</span>
          </h1>

          <p className="mt-6 text-xl text-gray-300 leading-relaxed max-w-2xl">
            Getting a new roof? Filing an insurance claim? Just curious what's up there?
            Get a professional roof measurement report for your home &mdash; and your first one
            is <strong className="text-white">completely free</strong>. No credit card required.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              to="/signup"
              className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold text-lg py-3.5 px-8 rounded-xl transition-colors shadow-lg shadow-gotruf-500/25"
            >
              Get Your Free Report
            </Link>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            No credit card. No sales call. No "free trial that's actually not free."
          </p>
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center">
          Why would I need a roof report?
        </h2>
        <p className="mt-4 text-lg text-gray-500 text-center max-w-2xl mx-auto">
          Great question. Here are the times it really comes in handy:
        </p>

        <div className="mt-12 space-y-8">
          <div className="flex gap-6 items-start">
            <div className="shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
              &#x1F3E0;
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Getting a new roof</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                When a contractor gives you a quote, they base it on the size of your roof. But how
                do you know if their measurements are right? With your own GotRuf report, you can
                compare. If the contractor says 30 squares and your report says 24, that's a
                conversation worth having. Knowledge is leverage.
              </p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="shrink-0 w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-2xl">
              &#x26C8;
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">After a storm</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                Hail damage, wind damage, fallen tree &mdash; the insurance adjuster is coming. Having an
                independent measurement report gives you a baseline. You'll understand exactly what
                area is affected and can have an informed conversation about the claim. No one's
                pulling a fast one when you've got the data.
              </p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="shrink-0 w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
              &#x2600;
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Considering solar panels</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                Our reports include solar analysis &mdash; which parts of your roof get the most sun,
                how many panels could fit, and estimated energy production. Before a solar company
                sends a salesperson to your door, know what your roof can actually handle.
              </p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="shrink-0 w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
              &#x1F3E1;
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Buying or selling a home</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">
                Roof condition is one of the biggest factors in a home's value. Our AI-powered
                condition scoring gives you an objective assessment of the roof's current state.
                Useful for negotiations whether you're buying or selling.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlainEnglishSection() {
  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-4">
          Reports you can actually understand.
        </h2>
        <p className="text-lg text-gray-500 text-center max-w-2xl mx-auto mb-14">
          We know not everyone speaks "roofing." Our reports are designed to be clear for homeowners,
          while still being detailed enough for contractors and adjusters.
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">Total Roof Size</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              How big your roof is in square feet. Not the footprint of your house &mdash; the actual roof
              area including the slope. This is what determines how much material you need.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">Roof Sections (Facets)</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your roof isn't one flat surface. It's made up of sections that meet at ridges, hips, and
              valleys. We measure each section individually so nothing is missed.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">Pitch (Steepness)</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              How steep your roof is, expressed as "X/12" (inches of rise per foot of run). A 4/12 is
              walkable. A 12/12 is a 45-degree angle. This affects material costs and labor.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">Material Estimate</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              How many "squares" of shingles you need (1 square = 100 sq ft of roof). Plus starter
              shingles, cap shingles, underlayment, and trim. So you can double-check the quote.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">Roof Condition Score</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Our AI examines satellite imagery of your roof and gives it a score from 1 to 100.
              It's not a replacement for a physical inspection, but it's a great starting point.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">3D Model</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              An interactive 3D model of your roof you can spin around and explore. It's honestly
              pretty cool. Your kids will want to play with it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
          "But is it accurate?"
        </h2>
        <div className="mt-8 space-y-4 text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
          <p>
            Yes. We use the same satellite imagery and LIDAR elevation data that the industry-standard
            services use. Our measurements are <strong className="text-gray-900">guaranteed within 5% of
            EagleView</strong>, the service that most roofing contractors and insurance companies rely on.
          </p>
          <p>
            The professionals who use GotRuf &mdash; roofing contractors, insurance adjusters, and
            insurance agents &mdash; trust our measurements for their work. If it's accurate enough
            to base a $15,000 roofing job on, it's accurate enough for your peace of mind.
          </p>
          <p className="text-gotruf-600 font-semibold">
            And if we're wrong? Money back. No questions asked.
          </p>
        </div>
      </div>
    </section>
  );
}

function PricingPreview() {
  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
          Transparent pricing. No surprises.
        </h2>
        <p className="mt-4 text-lg text-gray-500">
          (Ironic, right? "No surprises" — from a roofing company.)
        </p>

        <div className="mt-12 bg-white rounded-2xl border-2 border-gotruf-300 p-8 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gotruf-500 text-white text-xs font-bold px-4 py-1 rounded-full">
            FIRST ONE FREE
          </div>
          <div className="text-5xl font-black text-gray-900 mt-4">Free</div>
          <div className="text-gray-500 mt-2">Your first report, on us</div>
          <div className="mt-6 text-gray-600">
            After that, it's <strong className="text-gray-900">$9.99 per report</strong>. That's it.
            No hidden fees, no "premium tier" for the measurements you actually need, no annual
            contract, no minimum commitment.
          </div>
          <Link
            to="/signup"
            className="mt-8 inline-block bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Create Free Account
          </Link>
          <p className="mt-4 text-xs text-gray-400">
            No credit card required. Really.
          </p>
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
          Your roof, your data, your decision.
        </h2>
        <p className="mt-4 text-xl text-white/80 font-medium">
          Get your free report in about 2 minutes. Just type in your address.
        </p>

        <Link
          to="/signup"
          className="mt-8 inline-block bg-white text-gotruf-700 font-bold text-lg py-3.5 px-10 rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
        >
          Get My Free Report
        </Link>

        <p className="mt-6 text-sm text-white/50 italic">
          "Home of the first one's free."
        </p>
      </div>
    </section>
  );
}

export default function HomeownersPage() {
  return (
    <>
      <HeroSection />
      <WhySection />
      <PlainEnglishSection />
      <TrustSection />
      <PricingPreview />
      <CTASection />
    </>
  );
}
