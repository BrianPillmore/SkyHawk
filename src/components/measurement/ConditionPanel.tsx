import { useStore } from '../../store/useStore';
import type { RoofConditionAssessment } from '../../types';
import { ROOF_MATERIAL_LABELS } from '../../types';

const CATEGORY_COLORS: Record<RoofConditionAssessment['category'], string> = {
  excellent: 'text-green-400',
  good: 'text-blue-400',
  fair: 'text-yellow-400',
  poor: 'text-orange-400',
  critical: 'text-red-400',
};

const SCORE_BG: Record<RoofConditionAssessment['category'], string> = {
  excellent: 'bg-green-900/30 border-green-700/50',
  good: 'bg-blue-900/30 border-blue-700/50',
  fair: 'bg-yellow-900/30 border-yellow-700/50',
  poor: 'bg-orange-900/30 border-orange-700/50',
  critical: 'bg-red-900/30 border-red-700/50',
};

export default function ConditionPanel() {
  const { roofCondition } = useStore();

  if (!roofCondition) {
    return (
      <div className="p-3">
        <p className="text-xs text-gray-500 text-center">
          Run AI analysis to get a roof condition assessment.
        </p>
      </div>
    );
  }

  const c = roofCondition;

  return (
    <div className="p-3 space-y-4">
      {/* Score Header */}
      <div className={`p-4 rounded-lg border ${SCORE_BG[c.category]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Condition Score</p>
            <p className={`text-3xl font-bold ${CATEGORY_COLORS[c.category]}`}>{c.overallScore}/100</p>
            <p className={`text-sm font-medium ${CATEGORY_COLORS[c.category]} capitalize`}>{c.category}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Est. Age</p>
            <p className="text-lg font-bold text-white">{c.estimatedAgeYears} yrs</p>
            <p className="text-xs text-gray-400">Remaining</p>
            <p className="text-lg font-bold text-white">{c.estimatedRemainingLifeYears} yrs</p>
          </div>
        </div>
      </div>

      {/* Material */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Material</h4>
        <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
          <span className="text-sm text-white">{ROOF_MATERIAL_LABELS[c.materialType]}</span>
          <span className="text-xs text-gray-400">{Math.round(c.materialConfidence * 100)}% confidence</span>
        </div>
      </section>

      {/* Damage Detected */}
      {c.damageDetected.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Damage Detected ({c.damageDetected.length})
          </h4>
          <div className="space-y-1.5">
            {c.damageDetected.map((d, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white capitalize">{d.type.replace('-', ' ')}</span>
                  <span className={`text-xs font-medium capitalize ${
                    d.severity === 'severe' ? 'text-red-400' :
                    d.severity === 'moderate' ? 'text-orange-400' : 'text-yellow-400'
                  }`}>{d.severity}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Findings */}
      {c.findings.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Findings</h4>
          <ul className="space-y-1">
            {c.findings.map((f, i) => (
              <li key={i} className="text-xs text-gray-300 flex gap-2">
                <span className="text-blue-400 shrink-0">•</span> {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recommendations */}
      {c.recommendations.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {c.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-gray-300 flex gap-2">
                <span className="text-green-400 shrink-0">→</span> {r}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-gray-600 text-center">
        Assessed {new Date(c.assessedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
