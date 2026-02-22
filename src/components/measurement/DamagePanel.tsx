import { useStore } from '../../store/useStore';
import { DAMAGE_TYPE_LABELS, DAMAGE_SEVERITY_COLORS } from '../../types';

export default function DamagePanel() {
  const {
    properties, activePropertyId,
    selectedDamageId, selectDamage, deleteDamageAnnotation,
  } = useStore();

  const property = properties.find((p) => p.id === activePropertyId);
  const annotations = property?.damageAnnotations || [];

  if (annotations.length === 0) return null;

  return (
    <section>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Damage Annotations ({annotations.length})
      </h3>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {annotations.map((ann) => (
          <div
            key={ann.id}
            onClick={() => selectDamage(ann.id)}
            className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-all ${
              selectedDamageId === ann.id
                ? 'bg-gray-700 ring-1 ring-gray-500'
                : 'hover:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: DAMAGE_SEVERITY_COLORS[ann.severity] }}
              />
              <span className="text-gray-300">{DAMAGE_TYPE_LABELS[ann.type]}</span>
              <span className="text-gray-600 capitalize">({ann.severity})</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteDamageAnnotation(ann.id); }}
              className="text-red-400/60 hover:text-red-400 ml-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DAMAGE_SEVERITY_COLORS.minor }} /> Minor
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DAMAGE_SEVERITY_COLORS.moderate }} /> Moderate
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DAMAGE_SEVERITY_COLORS.severe }} /> Severe
        </span>
      </div>
    </section>
  );
}
