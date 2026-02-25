import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import {
  analyzeSolarPotential,
  analyzeSolarPotentialFromApi,
  DEFAULT_SOLAR_CONFIG,
  solarMoneyToNumber,
  type SolarPanelConfig,
  type SolarFacetAnalysis,
  type SolarSystemSummary,
} from '../../utils/solarCalculations';
import { calculateEnvironmentalImpact } from '../../utils/environmentalImpact';
import type { SolarFinancialAnalysis } from '../../types/solar';

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
  const { activeMeasurement, activePropertyId, properties, solarInsights, showSolarPanels, toggleSolarPanels } = useStore();

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

      {/* Show panels on map toggle */}
      {solarInsights?.solarPotential?.solarPanels?.length ? (
        <button
          onClick={toggleSolarPanels}
          className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            showSolarPanels
              ? 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
              : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:text-white'
          }`}
        >
          {showSolarPanels ? 'Hide' : 'Show'} Panel Layout on Map ({solarInsights.solarPotential.solarPanels.length} panels)
        </button>
      ) : null}

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
        <FacetsTab facetAnalyses={analysis.facetAnalyses} />
      )}

      {/* ─── Financial Tab ─── */}
      {activeTab === 'financial' && (
        <FinancialTab analysis={analysis} solarInsights={solarInsights} />
      )}

      {/* ─── Environmental Tab ─── */}
      {activeTab === 'environmental' && (
        <EnvironmentalTab analysis={analysis} solarInsights={solarInsights} />
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

// ─── Facets Tab (Enhanced with sorting) ───────────────────────────

type FacetSortKey = 'production' | 'access' | 'panels' | 'name';

function FacetsTab({ facetAnalyses }: { facetAnalyses: SolarFacetAnalysis[] }) {
  const [sortBy, setSortBy] = useState<FacetSortKey>('production');

  if (facetAnalyses.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">No facets to analyze.</p>;
  }

  const sorted = [...facetAnalyses].sort((a, b) => {
    switch (sortBy) {
      case 'production': return b.annualProductionKwh - a.annualProductionKwh;
      case 'access': return b.solarAccessFactor - a.solarAccessFactor;
      case 'panels': return b.panelCount - a.panelCount;
      case 'name': return a.facetName.localeCompare(b.facetName);
      default: return 0;
    }
  });

  const totalProduction = facetAnalyses.reduce((s, f) => s + f.annualProductionKwh, 0);

  return (
    <div className="space-y-2">
      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">Sort by:</span>
        <div className="flex gap-1">
          {([
            ['production', 'kWh'],
            ['access', 'Access'],
            ['panels', 'Panels'],
          ] as [FacetSortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                sortBy === key
                  ? 'bg-amber-600/20 text-amber-400 font-medium'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ranked facet cards */}
      {sorted.map((fa, rank) => {
        const productionShare = totalProduction > 0
          ? Math.round((fa.annualProductionKwh / totalProduction) * 100)
          : 0;

        return (
          <div
            key={fa.facetId}
            className={`p-3 border rounded-lg space-y-2 ${
              rank === 0
                ? 'bg-amber-900/10 border-amber-700/40'
                : 'bg-gray-800/50 border-gray-700/50'
            }`}
          >
            {/* Facet header with rank */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                  rank === 0 ? 'bg-amber-600/30 text-amber-400' : 'bg-gray-700 text-gray-400'
                }`}>
                  {rank + 1}
                </span>
                <span className="text-xs text-gray-300 font-medium">{fa.facetName}</span>
              </div>
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
                <span className="text-gray-300 font-medium">{formatNumber(fa.annualProductionKwh)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">% of Total</span>
                <span className="text-gray-300">{productionShare}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tilt / Azimuth</span>
                <span className="text-gray-300">{fa.tiltDeg}&deg; / {fa.azimuthDeg}&deg;</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Usable Area</span>
                <span className="text-gray-300">{formatNumber(fa.usableAreaSqFt)} sqft</span>
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
        );
      })}

      {/* Installation recommendation */}
      {sorted.length > 1 && sorted[0].rating !== 'poor' && (
        <div className="p-2.5 bg-amber-900/15 border border-amber-700/30 rounded-lg">
          <p className="text-[10px] text-amber-400 font-medium">Recommended Installation Order</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {sorted.filter(f => f.rating !== 'poor').map((f, i) => `${i + 1}. ${f.facetName}`).join(' → ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Financial Tab (Enhanced) ─────────────────────────────────────

function FinancialTab({ analysis, solarInsights }: {
  analysis: SolarSystemSummary;
  solarInsights: ReturnType<typeof useStore>['solarInsights'];
}) {
  const [financeMode, setFinanceMode] = useState<'cash' | 'loan' | 'lease'>('cash');

  // Extract Google API financial data if available
  const financials = solarInsights?.solarPotential?.financialAnalyses;
  const bestFinancial: SolarFinancialAnalysis | undefined = financials?.length
    ? financials[financials.length - 1]
    : undefined;

  const hasLoan = !!bestFinancial?.financedPurchaseSavings;
  const hasLease = !!bestFinancial?.leasingSavings?.leasesAllowed;

  // Incentive details from API
  const details = bestFinancial?.financialDetails;
  const stateIncentive = details ? solarMoneyToNumber(details.stateIncentive) : 0;
  const utilityIncentive = details ? solarMoneyToNumber(details.utilityIncentive) : 0;
  const srecTotal = details ? solarMoneyToNumber(details.lifetimeSrecTotal) : 0;
  const hasIncentives = stateIncentive > 0 || utilityIncentive > 0 || srecTotal > 0;

  return (
    <div className="space-y-3">
      {/* Financing mode toggle */}
      {(hasLoan || hasLease) && (
        <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <FinanceModeBtn mode="cash" active={financeMode} onClick={setFinanceMode} label="Cash" />
          {hasLoan && <FinanceModeBtn mode="loan" active={financeMode} onClick={setFinanceMode} label="Loan" />}
          {hasLease && <FinanceModeBtn mode="lease" active={financeMode} onClick={setFinanceMode} label="Lease" />}
        </div>
      )}

      {/* Cash Purchase */}
      {financeMode === 'cash' && (
        <>
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Cash Purchase</p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">System Cost</span>
                <span className="text-gray-200 font-medium">{formatCurrency(analysis.systemCost)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Federal Tax Credit (30%)</span>
                <span className="font-medium">-{formatCurrency(analysis.federalTaxCredit)}</span>
              </div>
              {stateIncentive > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>State Incentive</span>
                  <span className="font-medium">-{formatCurrency(stateIncentive)}</span>
                </div>
              )}
              {utilityIncentive > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Utility Rebate</span>
                  <span className="font-medium">-{formatCurrency(utilityIncentive)}</span>
                </div>
              )}
              <div className="border-t border-gray-700 pt-1.5 flex justify-between">
                <span className="text-gray-300 font-medium">Net Cost</span>
                <span className="text-white font-bold">{formatCurrency(analysis.netCost)}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Savings</p>
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
        </>
      )}

      {/* Loan Purchase */}
      {financeMode === 'loan' && bestFinancial?.financedPurchaseSavings && (
        <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Financed Purchase</p>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-400">Annual Loan Payment</span>
              <span className="text-gray-200 font-medium">
                {formatCurrency(solarMoneyToNumber(bestFinancial.financedPurchaseSavings.annualLoanPayment))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Interest Rate</span>
              <span className="text-gray-200">{(bestFinancial.financedPurchaseSavings.loanInterestRate * 100).toFixed(1)}%</span>
            </div>
            {solarMoneyToNumber(bestFinancial.financedPurchaseSavings.rebateValue) > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Rebate Value</span>
                <span className="font-medium">{formatCurrency(solarMoneyToNumber(bestFinancial.financedPurchaseSavings.rebateValue))}</span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-1.5 flex justify-between">
              <span className="text-gray-400">Year 1 Savings</span>
              <span className="text-emerald-400 font-medium">
                {formatCurrency(solarMoneyToNumber(bestFinancial.financedPurchaseSavings.savings.savingsYear1))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">20-Year Savings</span>
              <span className="text-emerald-400 font-bold">
                {formatCurrency(solarMoneyToNumber(bestFinancial.financedPurchaseSavings.savings.savingsYear20))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Lease */}
      {financeMode === 'lease' && bestFinancial?.leasingSavings && (
        <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Solar Lease</p>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-400">Annual Lease Cost</span>
              <span className="text-gray-200 font-medium">
                {formatCurrency(solarMoneyToNumber(bestFinancial.leasingSavings.annualLeasingCost))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Year 1 Savings</span>
              <span className="text-emerald-400 font-medium">
                {formatCurrency(solarMoneyToNumber(bestFinancial.leasingSavings.savings.savingsYear1))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">20-Year Savings</span>
              <span className="text-emerald-400 font-bold">
                {formatCurrency(solarMoneyToNumber(bestFinancial.leasingSavings.savings.savingsYear20))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Incentives Breakdown */}
      {hasIncentives && (
        <div className="p-3 bg-emerald-900/20 border border-emerald-800/30 rounded-lg space-y-2">
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1">Incentives & Credits</p>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-emerald-300/70">Federal ITC (30%)</span>
              <span className="text-emerald-400 font-medium">{formatCurrency(analysis.federalTaxCredit)}</span>
            </div>
            {stateIncentive > 0 && (
              <div className="flex justify-between">
                <span className="text-emerald-300/70">State Incentive</span>
                <span className="text-emerald-400 font-medium">{formatCurrency(stateIncentive)}</span>
              </div>
            )}
            {utilityIncentive > 0 && (
              <div className="flex justify-between">
                <span className="text-emerald-300/70">Utility Rebate</span>
                <span className="text-emerald-400 font-medium">{formatCurrency(utilityIncentive)}</span>
              </div>
            )}
            {srecTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-emerald-300/70">SREC Revenue (Lifetime)</span>
                <span className="text-emerald-400 font-medium">{formatCurrency(srecTotal)}</span>
              </div>
            )}
            <div className="border-t border-emerald-800/30 pt-1.5 flex justify-between">
              <span className="text-emerald-300 font-medium">Total Incentives</span>
              <span className="text-emerald-400 font-bold">
                {formatCurrency(analysis.federalTaxCredit + stateIncentive + utilityIncentive)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Energy coverage details */}
      {details && (
        <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-1.5 text-[11px]">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Energy Coverage</p>
          {details.solarPercentage > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Solar Coverage</span>
              <span className="text-amber-400 font-medium">{Math.round(details.solarPercentage)}% of usage</span>
            </div>
          )}
          {details.percentageExportedToGrid > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Exported to Grid</span>
              <span className="text-gray-300">{Math.round(details.percentageExportedToGrid)}%</span>
            </div>
          )}
          {details.netMeteringAllowed && (
            <div className="flex justify-between">
              <span className="text-gray-400">Net Metering</span>
              <span className="text-emerald-400 font-medium">Available</span>
            </div>
          )}
          {solarMoneyToNumber(details.costOfElectricityWithoutSolar) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Cost Without Solar (Lifetime)</span>
              <span className="text-red-400 font-medium">
                {formatCurrency(solarMoneyToNumber(details.costOfElectricityWithoutSolar))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Payback visualization */}
      <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Payback Timeline</p>
        <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-amber-600 to-emerald-500 transition-all"
            style={{ width: `${Math.min(100, (analysis.paybackYears / 25) * 100)}%` }}
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
  );
}

function FinanceModeBtn({ mode, active, onClick, label }: {
  mode: 'cash' | 'loan' | 'lease';
  active: string;
  onClick: (m: 'cash' | 'loan' | 'lease') => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onClick(mode)}
      className={`flex-1 py-1.5 text-[10px] font-medium rounded transition-colors ${
        active === mode
          ? 'bg-amber-600/20 text-amber-400 border border-amber-600/40'
          : 'text-gray-500 hover:text-gray-300 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Environmental Tab (Enhanced) ─────────────────────────────────

function EnvironmentalTab({ analysis, solarInsights }: {
  analysis: SolarSystemSummary;
  solarInsights: ReturnType<typeof useStore>['solarInsights'];
}) {
  // Use API-based environmental impact when available
  const envImpact = useMemo(
    () => solarInsights ? calculateEnvironmentalImpact(solarInsights, analysis.totalCapacityKw) : null,
    [solarInsights, analysis.totalCapacityKw],
  );

  return (
    <div className="space-y-3">
      {/* CO2 offset - enhanced with API data */}
      <div className="p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg text-center space-y-2">
        <div className="text-3xl font-bold text-emerald-400">
          {envImpact
            ? envImpact.annualCO2OffsetTons.toLocaleString()
            : formatNumber(analysis.carbonOffsetLbs)}
        </div>
        <p className="text-[11px] text-gray-400">
          {envImpact ? (
            <>metric tons CO<sub>2</sub> offset per year</>
          ) : (
            <>lbs of CO<sub>2</sub> offset per year</>
          )}
        </p>
        {envImpact && (
          <p className="text-[10px] text-gray-500">
            Grid carbon intensity: {envImpact.carbonFactorKgPerMwh} kg CO<sub>2</sub>/MWh
          </p>
        )}
      </div>

      {/* Impact equivalents grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-center">
          <div className="text-xl font-bold text-emerald-400">
            {envImpact ? envImpact.treeEquivalent.toLocaleString() : formatNumber(analysis.treesEquivalent)}
          </div>
          <p className="text-[10px] text-gray-500">Trees planted</p>
        </div>
        <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-center">
          <div className="text-xl font-bold text-emerald-400">
            {envImpact ? envImpact.milesNotDriven.toLocaleString() : formatNumber(Math.round(analysis.carbonOffsetLbs / 0.89))}
          </div>
          <p className="text-[10px] text-gray-500">Miles not driven</p>
        </div>
        <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-center">
          <div className="text-xl font-bold text-emerald-400">
            {envImpact ? envImpact.homesPowered : (analysis.annualProductionKwh / 10500).toFixed(2)}
          </div>
          <p className="text-[10px] text-gray-500">Homes powered</p>
        </div>
        <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-center">
          <div className="text-xl font-bold text-emerald-400">
            {envImpact ? envImpact.annualEnergyKwh.toLocaleString() : formatNumber(analysis.annualProductionKwh)}
          </div>
          <p className="text-[10px] text-gray-500">kWh/year</p>
        </div>
      </div>

      {/* Lifetime impact */}
      <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
          25-Year Environmental Impact
        </p>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-400">Lifetime CO2 Offset</span>
            <span className="text-emerald-400 font-medium">
              {envImpact
                ? `${envImpact.lifetimeCO2OffsetTons.toLocaleString()} metric tons`
                : `${formatNumber(analysis.carbonOffsetLbs * 25)} lbs`}
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
              {envImpact
                ? Math.max(1, Math.round(envImpact.annualCO2OffsetTons / 4.6))
                : Math.max(1, Math.round((analysis.carbonOffsetLbs / 2.205) / 4600))}
            </span>
          </div>
        </div>
      </div>
      {envImpact && (
        <p className="text-[9px] text-gray-600 text-center">
          Calculations use regional grid carbon intensity from Google Solar API ({envImpact.carbonFactorKgPerMwh} kg/MWh)
          with 0.5% annual panel degradation
        </p>
      )}
    </div>
  );
}
