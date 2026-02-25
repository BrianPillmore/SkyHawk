import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  calculateQuickEstimate,
  formatCurrency,
  pitchMultiplier,
  COMPLEXITY_LABELS,
  SHINGLE_LABELS,
  UNDERLAYMENT_LABELS,
  type RoofComplexity,
  type ShingleGrade,
  type UnderlaymentType,
  type QuickEstimateResult,
} from '../../utils/quickEstimate';

export default function QuickEstimate() {
  const navigate = useNavigate();

  // Form state
  const [areaSqFt, setAreaSqFt] = useState(2000);
  const [pitch, setPitch] = useState(6);
  const [isPitchAdjusted, setIsPitchAdjusted] = useState(false);
  const [complexity, setComplexity] = useState<RoofComplexity>('moderate');
  const [stories, setStories] = useState(1);
  const [shingleGrade, setShingleGrade] = useState<ShingleGrade>('architectural');
  const [underlayment, setUnderlayment] = useState<UnderlaymentType>('synthetic');
  const [tearoff, setTearoff] = useState(true);
  const [tearoffLayers, setTearoffLayers] = useState(1);

  const result = useMemo<QuickEstimateResult>(
    () =>
      calculateQuickEstimate({
        areaSqFt,
        pitch,
        isPitchAdjusted,
        complexity,
        stories,
        shingleGrade,
        underlayment,
        tearoff,
        tearoffLayers,
      }),
    [areaSqFt, pitch, isPitchAdjusted, complexity, stories, shingleGrade, underlayment, tearoff, tearoffLayers],
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold">Quick Estimate Calculator</h1>
          </div>
          <span className="text-xs text-gray-500">Instant material &amp; cost estimates</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="space-y-6">
            <Section title="Roof Dimensions">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Roof Area (sq ft)">
                  <input
                    type="number"
                    value={areaSqFt}
                    onChange={(e) => setAreaSqFt(Math.max(100, parseInt(e.target.value) || 0))}
                    className="input-field"
                    min={100}
                    max={100000}
                  />
                  <label className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                    <input
                      type="checkbox"
                      checked={isPitchAdjusted}
                      onChange={(e) => setIsPitchAdjusted(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-800 text-gotruf-500"
                    />
                    Area is already pitch-adjusted
                  </label>
                </Field>
                <Field label={`Pitch (${pitch}/12 = ${Math.round(Math.atan(pitch / 12) * 180 / Math.PI)}°)`}>
                  <input
                    type="range"
                    value={pitch}
                    onChange={(e) => setPitch(parseInt(e.target.value))}
                    className="w-full accent-gotruf-500"
                    min={0}
                    max={18}
                    step={1}
                  />
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>Flat</span>
                    <span>{pitch}/12</span>
                    <span>Steep</span>
                  </div>
                  {!isPitchAdjusted && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Multiplier: {pitchMultiplier(pitch).toFixed(3)}x
                    </p>
                  )}
                </Field>
              </div>
            </Section>

            <Section title="Roof Characteristics">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Complexity">
                  <select
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value as RoofComplexity)}
                    className="input-field"
                  >
                    {Object.entries(COMPLEXITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Stories">
                  <select
                    value={stories}
                    onChange={(e) => setStories(parseInt(e.target.value))}
                    className="input-field"
                  >
                    <option value={1}>1 Story</option>
                    <option value={2}>2 Stories</option>
                    <option value={3}>3+ Stories</option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="Materials">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Shingle Grade">
                  <select
                    value={shingleGrade}
                    onChange={(e) => setShingleGrade(e.target.value as ShingleGrade)}
                    className="input-field"
                  >
                    {Object.entries(SHINGLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Underlayment">
                  <select
                    value={underlayment}
                    onChange={(e) => setUnderlayment(e.target.value as UnderlaymentType)}
                    className="input-field"
                  >
                    {Object.entries(UNDERLAYMENT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="Tearoff">
              <label className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={tearoff}
                  onChange={(e) => setTearoff(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-gotruf-500 w-4 h-4"
                />
                <span className="text-sm text-gray-300">Tearoff existing roof</span>
              </label>
              {tearoff && (
                <Field label="Layers to Remove">
                  <select
                    value={tearoffLayers}
                    onChange={(e) => setTearoffLayers(parseInt(e.target.value))}
                    className="input-field"
                  >
                    <option value={1}>1 Layer</option>
                    <option value={2}>2 Layers</option>
                  </select>
                </Field>
              )}
            </Section>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {/* Grand total card */}
            <div className="bg-gradient-to-br from-gotruf-900/50 to-gray-900 border border-gotruf-700/30 rounded-xl p-6">
              <p className="text-xs text-gotruf-400 mb-1">Estimated Total</p>
              <p className="text-4xl font-bold text-white mb-2">
                {formatCurrency(result.costs.grandTotal)}
              </p>
              <p className="text-sm text-gray-400">
                {formatCurrency(result.costPerSquare)} per square | {result.squaresWithWaste} squares (incl. {result.wastePercent}% waste)
              </p>
            </div>

            {/* Measurement summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Measurements</h3>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-800/50 rounded px-3 py-2">
                  <span className="text-gray-500 block">True Area</span>
                  <span className="text-white font-medium">{result.trueAreaSqFt.toLocaleString()} sf</span>
                </div>
                <div className="bg-gray-800/50 rounded px-3 py-2">
                  <span className="text-gray-500 block">Squares</span>
                  <span className="text-white font-medium">{result.squares}</span>
                </div>
                <div className="bg-gray-800/50 rounded px-3 py-2">
                  <span className="text-gray-500 block">w/ Waste</span>
                  <span className="text-white font-medium">{result.squaresWithWaste}</span>
                </div>
              </div>
            </div>

            {/* Material quantities */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Material Quantities</h3>
              <div className="space-y-2 text-xs">
                <MaterialRow label="Shingle Bundles" value={result.materials.shingleBundles} />
                <MaterialRow label="Underlayment Rolls" value={result.materials.underlaymentRolls} />
                <MaterialRow label="Ice & Water Shield" value={`${result.materials.iceWaterRolls} rolls`} />
                <MaterialRow label="Starter Strip" value={`${result.materials.starterStripLf} LF`} />
                <MaterialRow label="Ridge Cap" value={`${result.materials.ridgeCapLf} LF`} />
                <MaterialRow label="Drip Edge" value={`${result.materials.dripEdgeLf} LF`} />
                <MaterialRow label="Nails" value={`${result.materials.nailsLbs} lbs`} />
                <MaterialRow label="Ridge Vent" value={`${result.materials.ventLf} LF`} />
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Cost Breakdown</h3>
              <div className="space-y-2 text-xs">
                <CostRow label="Shingles" amount={result.costs.shingles} />
                <CostRow label="Underlayment" amount={result.costs.underlayment} />
                <CostRow label="Ice & Water Shield" amount={result.costs.iceWater} />
                <CostRow label="Accessories" amount={result.costs.accessories} />
                <div className="border-t border-gray-800 pt-2 mt-2">
                  <CostRow label="Materials Subtotal" amount={result.costs.totalMaterials} bold />
                </div>
                <CostRow label="Labor" amount={result.costs.labor} />
                {tearoff && <CostRow label="Tearoff" amount={result.costs.tearoff} />}
                {tearoff && <CostRow label="Disposal" amount={result.costs.disposal} />}
                <div className="border-t border-gray-800 pt-2 mt-2">
                  <CostRow label="Labor Subtotal" amount={result.costs.totalLabor} bold />
                </div>
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <CostRow label="Grand Total" amount={result.costs.grandTotal} bold highlight />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-gray-600 text-center">
              Estimates are approximate. Actual costs vary by region, supplier, and contractor.
              For precise measurements, use Auto-Measure on a specific property.
            </p>
          </div>
        </div>
      </div>

      {/* Tailwind utility classes for form inputs */}
      <style>{`
        .input-field {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: rgb(17 24 39);
          border: 1px solid rgb(55 65 81);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: white;
        }
        .input-field:focus {
          border-color: rgb(234 88 12);
          outline: none;
          box-shadow: 0 0 0 1px rgb(234 88 12 / 0.5);
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function MaterialRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function CostRow({
  label,
  amount,
  bold,
  highlight,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? 'font-medium' : ''}`}>
      <span className={highlight ? 'text-gotruf-400' : 'text-gray-400'}>{label}</span>
      <span className={highlight ? 'text-gotruf-400 text-base' : 'text-white'}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}
