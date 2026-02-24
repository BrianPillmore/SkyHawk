import { useStore } from '../../store/useStore';
import type { RoofMeasurement } from '../../types';

interface EagleViewData {
  address: string | null;
  total_area_sqft: number | null;
  facet_count: number | null;
  predominant_pitch: string | null;
  waste_percent: number | null;
}

interface ComparisonViewProps {
  eagleViewData: EagleViewData;
  onGenerateReport?: () => void;
}

function diffClass(evVal: number | null, grVal: number): string {
  if (evVal == null || evVal === 0) return '';
  const pct = Math.abs((grVal - evVal) / evVal) * 100;
  if (pct < 5) return 'text-green-400';
  if (pct < 10) return 'text-yellow-400';
  return 'text-red-400';
}

function diffLabel(evVal: number | null, grVal: number): string {
  if (evVal == null || evVal === 0) return '';
  const pct = ((grVal - evVal) / evVal) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function parsePitch(pitchStr: string | null): number | null {
  if (!pitchStr) return null;
  const match = pitchStr.match(/(\d+)\/12/);
  return match ? parseInt(match[1], 10) : null;
}

export default function ComparisonView({ eagleViewData, onGenerateReport }: ComparisonViewProps) {
  const { activeMeasurement, reportCredits } = useStore();

  if (!activeMeasurement) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-500">No active GotRuf measurement to compare. Measure a property first.</p>
      </div>
    );
  }

  const m: RoofMeasurement = activeMeasurement;
  const evPitch = parsePitch(eagleViewData.predominant_pitch);

  const rows: Array<{
    label: string;
    evValue: string;
    grValue: string;
    evNum: number | null;
    grNum: number;
  }> = [
    {
      label: 'Total Area (sq ft)',
      evValue: eagleViewData.total_area_sqft?.toLocaleString() ?? '-',
      grValue: Math.round(m.totalTrueAreaSqFt).toLocaleString(),
      evNum: eagleViewData.total_area_sqft,
      grNum: m.totalTrueAreaSqFt,
    },
    {
      label: 'Facet Count',
      evValue: eagleViewData.facet_count?.toString() ?? '-',
      grValue: m.facets.length.toString(),
      evNum: eagleViewData.facet_count,
      grNum: m.facets.length,
    },
    {
      label: 'Predominant Pitch',
      evValue: eagleViewData.predominant_pitch ?? '-',
      grValue: `${m.predominantPitch}/12`,
      evNum: evPitch,
      grNum: m.predominantPitch,
    },
    {
      label: 'Suggested Waste %',
      evValue: eagleViewData.waste_percent != null ? `${eagleViewData.waste_percent}%` : '-',
      grValue: `${m.suggestedWastePercent}%`,
      evNum: eagleViewData.waste_percent,
      grNum: m.suggestedWastePercent,
    },
    {
      label: 'Ridge (lf)',
      evValue: '-',
      grValue: Math.round(m.totalRidgeLf).toLocaleString(),
      evNum: null,
      grNum: m.totalRidgeLf,
    },
    {
      label: 'Hip (lf)',
      evValue: '-',
      grValue: Math.round(m.totalHipLf).toLocaleString(),
      evNum: null,
      grNum: m.totalHipLf,
    },
    {
      label: 'Valley (lf)',
      evValue: '-',
      grValue: Math.round(m.totalValleyLf).toLocaleString(),
      evNum: null,
      grNum: m.totalValleyLf,
    },
    {
      label: 'Rake (lf)',
      evValue: '-',
      grValue: Math.round(m.totalRakeLf).toLocaleString(),
      evNum: null,
      grNum: m.totalRakeLf,
    },
    {
      label: 'Eave (lf)',
      evValue: '-',
      grValue: Math.round(m.totalEaveLf).toLocaleString(),
      evNum: null,
      grNum: m.totalEaveLf,
    },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-bold text-white mb-1">EagleView vs GotRuf Comparison</h3>
      {eagleViewData.address && (
        <p className="text-sm text-gray-500 mb-4">{eagleViewData.address}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 pr-4 text-gray-500 text-xs uppercase">Metric</th>
              <th className="text-right py-2 pr-4 text-gray-500 text-xs uppercase">EagleView</th>
              <th className="text-right py-2 pr-4 text-gray-500 text-xs uppercase">GotRuf</th>
              <th className="text-right py-2 text-gray-500 text-xs uppercase">Diff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-800/50">
                <td className="py-2.5 pr-4 text-gray-300">{row.label}</td>
                <td className="py-2.5 pr-4 text-right text-gray-400">{row.evValue}</td>
                <td className="py-2.5 pr-4 text-right text-white font-medium">{row.grValue}</td>
                <td className={`py-2.5 text-right font-medium ${diffClass(row.evNum, row.grNum)}`}>
                  {diffLabel(row.evNum, row.grNum)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span>&lt;5% diff</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span>5-10% diff</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span>&gt;10% diff</span>
        </div>
      </div>

      {/* Generate Report Button */}
      {onGenerateReport && (
        <div className="mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={onGenerateReport}
            disabled={reportCredits <= 0}
            className="w-full bg-gotruf-500 hover:bg-gotruf-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            {reportCredits > 0
              ? `Generate GotRuf Report (1 credit)`
              : 'No credits remaining - upload an EagleView PDF to earn more'}
          </button>
          {reportCredits > 0 && (
            <p className="text-xs text-gray-500 text-center mt-2">
              You have {reportCredits} credit{reportCredits !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>
      )}
    </div>
  );
}
