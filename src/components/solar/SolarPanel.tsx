import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import {
  analyzeSolarPotential,
  analyzeSolarPotentialFromApi,
  DEFAULT_SOLAR_CONFIG,
  type SolarPanelConfig,
  type SolarFacetAnalysis,
  type SolarSystemSummary,
} from '../../utils/solarCalculations';

type SolarTab = 'overview' | 'facets' | 'financial' | 'environmental';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const RATING_COLORS: Record<SolarFacetAnalysis['rating'], string> = {
  excellent: '#10b981',
  good: '#3b82f6',
  fair: '#f59e0b',
  poor: '#ef4444',
};

const RATING_BG: Record<SolarFacetAnalysis['rating'], string> = {
  excellent: 'bg-emerald-900/30 text-emerald-400 border-emerald-700/50',
  good: 'bg-blue-900/30 text-blue-400 border-blue-700/50',
  fair: 'bg-amber-900/30 text-amber-400 border-amber-700/50',
  poor: 'bg-red-900/30 text-red-400 border-red-700/50',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

export default function SolarPanel() {
  const { activeMeasurement, activePropertyId, properties, solarInsights } = useStore();

  const [activeTab, setActiveTab] = useState<SolarTab>('overview');
  const [panelWattage, setPanelWattage] = useState(DEFAULT_SOLAR_CONFIG.panelWattage);
  const [costPerWatt, setCostPerWatt] = useState(DEFAULT_SOLAR_CONFIG.costPerWatt);
  const [electricityRate, setElectricityRate] = useState(DEFAULT_SOLAR_CONFIG.electricityRate);

  // Get latitude from active property
  const property = properties.find((p) => p.id === activePropertyId);
  const latitude = property?.lat ?? 39.0; // default US center latitude

  // Build config from user inputs
  const config: SolarPanelConfig = useMemo(() => ({
    ...DEFAULT_SOLAR_CONFIG,
    panelWattage,
    costPerWatt,
    electricityRate,
  }), [panelWattage, costPerWatt, electricityRate]);

  // Calculate solar analysis — prefer Google API data when available
  const analysis: SolarSystemSummary | null = useMemo(() => {
    if (!activeMeasurement || activeMeasurement.facets.length === 0) return null;
    if (solarInsights?.solarPotential?.solarPanelConfigs?.length) {
      return analyzeSolarPotentialFromApi(solarInsights, activeMeasurement, config);
    }
    return analyzeSolarPotential(activeMeasurement, config, latitude);
  }, [activeMeasurement, config, latitude, solarInsights]);

  // Don't render if no measurement or no facets
  if (!activeMeasurement || activeMeasurement.facets.length === 0) {
    return null;
  }

  if (!analysis) return null;

  const tabs: { id: SolarTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'facets', label: 'Facets' },
    { id: 'financial', label: 'Financial' },
    { id: 'environmental', label: 'Environmental' },
  ];

  // Determine overall system rating
  const avgAccess =
    analysis.facetAnalyses.length > 0
      ? analysis.facetAnalyses.reduce((s, f) => s + f.solarAccessFactor, 0) /
        analysis.facetAnalyses.length
      : 0;
  let systemRating: SolarFacetAnalysis['rating'];
  if (avgAccess >= 0.85) systemRating = 'excellent';
  else if (avgAccess >= 0.70) systemRating = 'good';
  else if (avgAccess >= 0.55) systemRating = 'fair';
  else systemRating = 'poor';

  const maxMonthly = Math.max(...analysis.monthlyProductionKwh, 1);

  const isApiSourced = !!(solarInsights?.solarPotential?.solarPanelConfigs?.length);

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Solar Analysis
          </h3>
          {isApiSourced && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-blue-900/30 text-blue-400 border border-blue-700/50">
              Google Solar API
            </span>
          )}
        </div>
        <span
          className={`px-2 py-0.5 text-[10px] font-medium rounded border ${RATING_BG[systemRating]}`}
        >
          {systemRating.charAt(0).toUpperCase() + systemRating.slice(1)}
        </span>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[10px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-amber-400 border-b-2 border-amber-500 bg-gray-800/50'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Configuration inputs */}
      <div className="p-2 bg-gray-800/50 border border-gray-700/50 rounded-lg">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Configuration</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Panel (W)</label>
            <input
              type="number"
              value={panelWattage}
              onChange={(e) => setPanelWattage(Math.max(100, Number(e.target.value) || 100))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-[11px] text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">$/Watt</label>
            <input
              type="number"
              step="0.01"
              value={costPerWatt}
              onChange={(e) => setCostPerWatt(Math.max(0.5, Number(e.target.value) || 0.5))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-[11px] text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">$/kWh</label>
            <input
              type="number"
              step="0.01"
              value={electricityRate}
              onChange={(e) => setElectricityRate(Math.max(0.01, Number(e.target.value) || 0.01))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-[11px] text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* ─── Overview Tab ─── */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* Key stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total Panels" value={String(analysis.totalPanels)} />
            <StatCard label="System Size" value={`${analysis.totalCapacityKw} kW`} />
            <StatCard label="Annual Production" value={`${formatNumber(analysis.annualProductionKwh)} kWh`} />
            <StatCard label="Payback Period" value={`${analysis.paybackYears} yrs`} />
          </div>

          {/* Monthly production bar chart */}
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Monthly Production (kWh)
            </p>
            <div className="flex items-end gap-1 h-24">
              {analysis.monthlyProductionKwh.map((kwh, i) => {
                const heightPct = Math.max(4, (kwh / maxMonthly) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-gray-400">{kwh}</span>
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: kwh >= maxMonthly * 0.8
                          ? '#f59e0b'
                          : kwh >= maxMonthly * 0.5
                            ? '#d97706'
                            : '#92400e',
                      }}
                    />
                    <span className="text-[8px] text-gray-500">{MONTH_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System rating breakdown */}
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              System Rating
            </p>
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: RATING_COLORS[systemRating] + '22',
                  color: RATING_COLORS[systemRating],
                  border: `2px solid ${RATING_COLORS[systemRating]}`,
                }}
              >
                {Math.round(avgAccess * 100)}
              </div>
              <div>
                <p className="text-xs text-gray-300 font-medium">
                  {systemRating.charAt(0).toUpperCase() + systemRating.slice(1)} Solar Potential
                </p>
                <p className="text-[10px] text-gray-500">
                  Average solar access factor: {Math.round(avgAccess * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Facets Tab ─── */}
      {activeTab === 'facets' && (
        <div className="space-y-2">
          {analysis.facetAnalyses.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No facets to analyze.</p>
          ) : (
            analysis.facetAnalyses.map((fa) => (
              <div
                key={fa.facetId}
                className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2"
              >
                {/* Facet header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300 font-medium">{fa.facetName}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${RATING_BG[fa.rating]}`}
                  >
                    {fa.rating.charAt(0).toUpperCase() + fa.rating.slice(1)}
                  </span>
                </div>

                {/* Facet stats */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Panels</span>
                    <span className="text-gray-300">{fa.panelCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Capacity</span>
                    <span className="text-gray-300">{fa.panelCapacityKw} kW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Annual kWh</span>
                    <span className="text-gray-300">{formatNumber(fa.annualProductionKwh)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Usable Area</span>
                    <span className="text-gray-300">{formatNumber(fa.usableAreaSqFt)} sqft</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tilt</span>
                    <span className="text-gray-300">{fa.tiltDeg}&deg;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Azimuth</span>
                    <span className="text-gray-300">{fa.azimuthDeg}&deg;</span>
                  </div>
                </div>

                {/* Solar access bar */}
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-gray-500">Solar Access</span>
                    <span className="text-gray-300">{Math.round(fa.solarAccessFactor * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${fa.solarAccessFactor * 100}%`,
                        backgroundColor: RATING_COLORS[fa.rating],
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Financial Tab ─── */}
      {activeTab === 'financial' && (
        <div className="space-y-3">
          {/* Cost breakdown */}
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Cost Breakdown
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">System Cost</span>
                <span className="text-gray-200 font-medium">{formatCurrency(analysis.systemCost)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Federal Tax Credit (30%)</span>
                <span className="font-medium">-{formatCurrency(analysis.federalTaxCredit)}</span>
              </div>
              <div className="border-t border-gray-700 pt-1.5 flex justify-between">
                <span className="text-gray-300 font-medium">Net Cost</span>
                <span className="text-white font-bold">{formatCurrency(analysis.netCost)}</span>
              </div>
            </div>
          </div>

          {/* Savings */}
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Savings
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Annual Savings</span>
                <span className="text-emerald-400 font-medium">{formatCurrency(analysis.annualSavings)}/yr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Payback Period</span>
                <span className="text-amber-400 font-medium">{analysis.paybackYears} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">25-Year Net Savings</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(analysis.twentyFiveYearSavings)}</span>
              </div>
            </div>
          </div>

          {/* Payback visualization */}
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Payback Timeline
            </p>
            <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-amber-600 to-emerald-500 transition-all"
                style={{
                  width: `${Math.min(100, (analysis.paybackYears / 25) * 100)}%`,
                }}
              />
              <div
                className="absolute top-0 h-full w-px bg-white/50"
                style={{ left: `${Math.min(100, (analysis.paybackYears / 25) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-500 mt-1">
              <span>Year 0</span>
              <span>Payback: {analysis.paybackYears} yrs</span>
              <span>Year 25</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Environmental Tab ─── */}
      {activeTab === 'environmental' && (
        <div className="space-y-3">
          {/* CO2 offset */}
          <div className="p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg text-center space-y-2">
            <div className="text-3xl font-bold text-emerald-400">
              {formatNumber(analysis.carbonOffsetLbs)}
            </div>
            <p className="text-[11px] text-gray-400">
              lbs of CO<sub>2</sub> offset per year
            </p>
            <p className="text-[10px] text-gray-500">
              ({formatNumber(Math.round(analysis.carbonOffsetLbs / 2.205))} kg)
            </p>
          </div>

          {/* Trees equivalent */}
          <div className="p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg text-center space-y-2">
            <div className="text-3xl font-bold text-emerald-400">
              {formatNumber(analysis.treesEquivalent)}
            </div>
            <p className="text-[11px] text-gray-400">
              trees planted equivalent per year
            </p>
            <p className="text-[10px] text-gray-500">
              Based on 48 lbs CO<sub>2</sub> absorbed per tree per year
            </p>
          </div>

          {/* 25-year impact */}
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              25-Year Environmental Impact
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Total CO2 Offset</span>
                <span className="text-emerald-400 font-medium">
                  {formatNumber(analysis.carbonOffsetLbs * 25)} lbs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Energy Produced</span>
                <span className="text-emerald-400 font-medium">
                  {formatNumber(analysis.annualProductionKwh * 25)} kWh
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cars Off Road Equivalent</span>
                <span className="text-emerald-400 font-medium">
                  {Math.max(1, Math.round((analysis.carbonOffsetLbs / 2.205) / 4600))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-center">
      <p className="text-sm text-white font-bold">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
