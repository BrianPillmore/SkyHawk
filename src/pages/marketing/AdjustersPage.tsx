import { Link } from 'react-router-dom';

function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-gotruf-500/10 border border-gotruf-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-gotruf-400 text-sm font-medium">For Insurance Adjusters</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Same accuracy.<br />
            <span className="text-gotruf-500">Friendlier receipt.</span>
          </h1>

          <p className="mt-6 text-xl text-gray-300 leading-relaxed max-w-2xl">
            Your carrier is watching costs. The claimant wants it done yesterday. You need measurements
            that are accurate, defensible, and don't require a budget approval form. GotRuf
            delivers all three for <strong className="text-white">$9.99 per report</strong>.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              to="/gotruf/signup"
              className="bg-gotruf-500 hover:bg-gotruf-600 text-white font-bold text-lg py-3.5 px-8 rounded-xl transition-colors shadow-lg shadow-gotruf-500/25"
            >
              Try It Free
            </Link>
            <Link
              to="/gotruf/pricing"
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

function AccuracySection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center">
          Accurate enough for court. Cheap enough for Tuesday.
        </h2>

        <div className="mt-12 grid sm:grid-cols-3 gap-8 text-center">
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="text-4xl font-black text-gotruf-500">5%</div>
            <div className="text-sm text-gray-500 mt-2">Accuracy guarantee vs EagleView</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="text-4xl font-black text-gotruf-500">LIDAR</div>
            <div className="text-sm text-gray-500 mt-2">Verified pitch measurements</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="text-4xl font-black text-gotruf-500">Instant</div>
            <div className="text-sm text-gray-500 mt-2">Delivery &mdash; no waiting</div>
          </div>
        </div>

        <div className="mt-12 space-y-6 text-lg text-gray-600 leading-relaxed">
          <p>
            We know what you're thinking: <em>"If it's that cheap, it can't be accurate."</em> Fair question.
            Here's our answer: we use the same Google satellite imagery and LIDAR elevation data that
            the expensive guys do. Same source data, different business model.
          </p>
          <p>
            Our measurements are calibrated against 18 EagleView Premium reports. We track pitch,
            area, edge lengths, waste factors, and material counts. If we're off by more than 5%
            on any property, <strong className="text-gray-900">your report is free</strong>. That guarantee
            is in writing.
          </p>
        </div>
      </div>
    </section>
  );
}

function ComplianceSection() {
  const features = [
    {
      title: 'ESX/Xactimate Compatible',
      description: 'Export directly to Xactimate format. Your estimating workflow doesn\'t change — just your cost per report.',
    },
    {
      title: 'Damage Documentation',
      description: 'Annotate damage directly on the roof diagram. AI-powered condition scoring from 1-100. Photos attached to specific locations.',
    },
    {
      title: 'Claims Workflow',
      description: 'Built-in claims tracking with timeline, multi-party comments, and status management. One tool for the whole claim.',
    },
    {
      title: 'Audit Trail',
      description: 'Every measurement, annotation, and export is logged with timestamps. Defensible documentation if a claim goes sideways.',
    },
    {
      title: 'PDF Reports',
      description: 'Clean, professional reports with all measurements, diagrams, and documentation. Hand it to the policyholder or attach it to the claim file.',
    },
    {
      title: 'Bulk Pricing',
      description: '25 reports for $99/month. Running a full book of claims? Contact us for enterprise volume pricing that won\'t make your procurement team flinch.',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-4">
          Built for the claims process.
        </h2>
        <p className="text-center text-lg text-gray-500 mb-14 max-w-2xl mx-auto">
          Not adapted from a contractor tool. Actually built for how adjusters work.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScenarioSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 text-center mb-12">
          A day in the life. Improved.
        </h2>

        <div className="space-y-8">
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="text-sm font-bold text-red-500 uppercase tracking-wider mb-2">Before GotRuf</div>
            <p className="text-gray-600 leading-relaxed">
              8:00 AM &mdash; Get assignment. Order EagleView report. 10:30 AM &mdash; Check email.
              Not here yet. 1:00 PM &mdash; Still waiting. Schedule site visit for tomorrow.
              4:30 PM &mdash; Report arrives. Now you need to re-schedule. Policyholder is annoyed.
              Carrier is asking why this claim is taking so long. You eat a sad desk lunch.
            </p>
          </div>
          <div className="bg-gotruf-50 rounded-xl p-6 border-2 border-gotruf-200">
            <div className="text-sm font-bold text-gotruf-600 uppercase tracking-wider mb-2">After GotRuf</div>
            <p className="text-gray-700 leading-relaxed">
              8:00 AM &mdash; Get assignment. Pull GotRuf report. 8:02 AM &mdash; Have report. Review measurements,
              check pitch data, pull material estimates. 8:15 AM &mdash; Schedule site visit for this
              morning. Arrive with measurements in hand. Policyholder is impressed. Carrier is happy.
              You eat a triumphant desk lunch.
            </p>
          </div>
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
          Your carrier will appreciate the savings.<br />
          Your claimants will appreciate the speed.
        </h2>
        <p className="mt-4 text-xl text-white/80 font-medium">
          First report is free. Try it on your next claim.
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
            See Adjuster Pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function AdjustersPage() {
  return (
    <>
      <HeroSection />
      <AccuracySection />
      <ComplianceSection />
      <ScenarioSection />
      <CTASection />
    </>
  );
}
