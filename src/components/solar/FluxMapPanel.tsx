/**
 * FluxMapPanel — Displays per-facet flux analysis, overall roof shading,
 * monthly flux chart, and seasonal variation. Follows the pattern of ShadingPanel.
 */

import { useMemo } from 'react';
import type { FluxMapAnalysis, FacetFluxAnalysis } from '../../types/solar';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SHADE_RATING_COLORS: Record<string, string> = {
  minimal: 'text-emerald-400',
  low: 'text-blue-400',
  moderate: 'text-amber-400',
  high: 'text-red-400',
};

const SHADE_RATING_BG: Record<string, string> = {
  minimal: 'bg-emerald-900/30 border-emerald-700/50',
  low: 'bg-blue-900/30 border-blue-700/50',
  moderate: 'bg-amber-900/30 border-amber-700/50',
  high: 'bg-red-900/30 border-red-700/50',
};

function getShadingRating(shadedPercent: number): string {
  if (shadedPercent <= 5) return 'minimal';
  if (shadedPercent <= 15) return 'low';
  if (shadedPercent <= 30) return 'moderate';
  return 'high';
}

function getUniformityLabel(uniformity: number): string {
  if (uniformity >= 0.85) return 'Very Uniform';
  if (uniformity >= 0.65) return 'Uniform';
  if (uniformity >= 0.4) return 'Variable';
  return 'Highly Variable';
}

interface FluxMapPanelProps {
  fluxAnalysis: FluxMapAnalysis | null;
}

export default function FluxMapPanel({ fluxAnalysis }: FluxMapPanelProps) {
  if (!fluxAnalysis) {
    return (
      <div className="p-3 text-xs text-gray-500 text-center">
        No flux data available. Run auto-measure with Solar API data layers to generate flux analysis.
      </div>
    );
  }

  const overallRating = getShadingRating(fluxAnalysis.overallShadingPercent);

  return (
    <div className="p-3 space-y-4">
      {/* Overall roof flux summary */}
      <div className="bg-gray-800/50 rounded-lg p-3 border border-blue-700/30">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">Flux Map Analysis</h4>
          <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-blue-900/30 text-blue-400 border border-blue-700/50">
            GeoTIFF Data
          </span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Mean Roof Flux</span>
            <span className="text-white">{fluxAnalysis.meanRoofFlux.toLocaleString()} kWh/kW/yr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Roof Pixels</span>
            <span className="text-white">{fluxAnalysis.totalRoofPixels.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Overall Shading</span>
            <span className={SHADE_RATING_COLORS[overallRating]}>
              {fluxAnalysis.overallShadingPercent}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Shade Threshold</span>
            <span className="text-gray-300">{fluxAnalysis.shadeThresholdKwh} kWh/kW/yr</span>
          </div>
        </div>
      </div>

      {/* Per-facet flux table */}
      {fluxAnalysis.facetAnalyses.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Per-Facet Flux Analysis</h4>
          <div className="space-y-1.5">
            {fluxAnalysis.facetAnalyses.map((facet) => (
              <FacetFluxCard key={facet.facetIndex} facet={facet} />
            ))}
          </div>
        </div>
      )}

      {/* Monthly flux chart (using first facet with data, or aggregate) */}
      <MonthlyFluxChart facetAnalyses={fluxAnalysis.facetAnalyses} />

      {/* Seasonal variation summary */}
      <SeasonalVariationSummary facetAnalyses={fluxAnalysis.facetAnalyses} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function FacetFluxCard({ facet }: { facet: FacetFluxAnalysis }) {
  const shadingRating = getShadingRating(facet.shadedPixelPercent);
  const uniformityLabel = getUniformityLabel(facet.fluxUniformity);

  return (
    <div className={`p-2 rounded-lg border ${SHADE_RATING_BG[shadingRating]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-300 font-medium">Facet {facet.facetIndex + 1}</span>
        <span className={`text-[10px] font-medium ${SHADE_RATING_COLORS[shadingRating]}`}>
          {shadingRating.charAt(0).toUpperCase() + shadingRating.slice(1)} Shading
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span className="text-gray-500">Mean Flux</span>
          <span className="text-gray-300">{facet.meanAnnualFlux} kWh</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Min/Max</span>
          <span className="text-gray-300">{facet.minAnnualFlux}/{facet.maxAnnualFlux}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Uniformity</span>
          <span className="text-gray-300">{Math.round(facet.fluxUniformity * 100)}% ({uniformityLabel})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Shaded</span>
          <span className="text-gray-300">{facet.shadedPixelPercent}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Best Month</span>
          <span className="text-green-400">{MONTH_NAMES[facet.bestMonth]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Worst Month</span>
          <span className="text-red-400">{MONTH_NAMES[facet.worstMonth]}</span>
        </div>
        <div className="flex justify-between col-span-2">
          <span className="text-gray-500">Seasonal Ratio (Best/Worst)</span>
          <span className="text-gray-300">{facet.seasonalVariation === Infinity ? 'N/A' : `${facet.seasonalVariation}x`}</span>
        </div>
      </div>
    </div>
  );
}

function MonthlyFluxChart({ facetAnalyses }: { facetAnalyses: FacetFluxAnalysis[] }) {
  // Aggregate monthly flux across all facets
  const aggregateMonthly = useMemo(() => {
    const totals = new Array(12).fill(0);
    let count = 0;
    for (const fa of facetAnalyses) {
      const hasData = fa.monthlyMeanFlux.some(v => v > 0);
      if (!hasData) continue;
      for (let m = 0; m < 12; m++) {
        totals[m] += fa.monthlyMeanFlux[m];
      }
      count++;
    }
    if (count === 0) return null;
    return totals.map(t => Math.round((t / count) * 10) / 10);
  }, [facetAnalyses]);

  if (!aggregateMonthly) {
    return null;
  }

  const maxVal = Math.max(...aggregateMonthly, 1);

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Monthly Flux (Avg Across Facets)</h4>
      <div className="space-y-1">
        {aggregateMonthly.map((val, m) => {
          const barWidth = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={m} className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 w-8">{MONTH_NAMES[m]}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-gray-300 w-14 text-right">{val} kWh</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeasonalVariationSummary({ facetAnalyses }: { facetAnalyses: FacetFluxAnalysis[] }) {
  const seasonalData = useMemo(() => {
    const validFacets = facetAnalyses.filter(fa => fa.monthlyMeanFlux.some(v => v > 0));
    if (validFacets.length === 0) return null;

    // Aggregate monthly data
    const totals = new Array(12).fill(0);
    for (const fa of validFacets) {
      for (let m = 0; m < 12; m++) {
        totals[m] += fa.monthlyMeanFlux[m];
      }
    }
    const means = totals.map(t => t / validFacets.length);

    const summerAvg = (means[5] + means[6] + means[7]) / 3;
    const winterAvg = (means[11] + means[0] + means[1]) / 3;
    const springAvg = (means[2] + means[3] + means[4]) / 3;
    const fallAvg = (means[8] + means[9] + means[10]) / 3;

    return { summer: summerAvg, winter: winterAvg, spring: springAvg, fall: fallAvg };
  }, [facetAnalyses]);

  if (!seasonalData) return null;

  const maxSeason = Math.max(seasonalData.summer, seasonalData.winter, seasonalData.spring, seasonalData.fall);

  const seasons = [
    { label: 'Spring', value: seasonalData.spring, color: 'text-green-400' },
    { label: 'Summer', value: seasonalData.summer, color: 'text-yellow-400' },
    { label: 'Fall', value: seasonalData.fall, color: 'text-orange-400' },
    { label: 'Winter', value: seasonalData.winter, color: 'text-blue-400' },
  ];

  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Seasonal Variation</h4>
      <div className="space-y-1.5 text-xs">
        {seasons.map((s) => {
          const pctOfMax = maxSeason > 0 ? Math.round((s.value / maxSeason) * 100) : 0;
          return (
            <div key={s.label} className="flex justify-between items-center">
              <span className={s.color}>{s.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-gray-400 h-1.5 rounded-full"
                    style={{ width: `${pctOfMax}%` }}
                  />
                </div>
                <span className="text-gray-300 w-16 text-right">
                  {Math.round(s.value)} kWh
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
