import { useStore } from '../../store/useStore';

export default function MeasurementSelector() {
  const {
    properties, activePropertyId, activeMeasurement,
    startNewMeasurement, saveMeasurement, loadMeasurement, deleteSavedMeasurement,
  } = useStore();

  const property = properties.find((p) => p.id === activePropertyId);
  if (!property) return null;

  const savedMeasurements = property.measurements;
  const hasUnsaved = activeMeasurement && !savedMeasurements.some((m) => m.id === activeMeasurement.id);
  const isModified = activeMeasurement && savedMeasurements.some(
    (m) => m.id === activeMeasurement.id && m.updatedAt !== activeMeasurement.updatedAt
  );

  return (
    <div className="px-3 py-2 border-b border-gray-800 bg-gray-900/50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          Measurements ({savedMeasurements.length})
        </h3>
        <div className="flex gap-1.5">
          {activeMeasurement && (
            <button
              onClick={saveMeasurement}
              className="px-2 py-1 text-[10px] font-medium bg-green-900/40 hover:bg-green-900/60 text-green-400 rounded transition-colors border border-green-900/50"
              title="Save current measurement"
            >
              {hasUnsaved ? 'Save' : isModified ? 'Update' : 'Saved'}
            </button>
          )}
          <button
            onClick={startNewMeasurement}
            className="px-2 py-1 text-[10px] font-medium bg-skyhawk-900/40 hover:bg-skyhawk-900/60 text-skyhawk-400 rounded transition-colors border border-skyhawk-900/50"
            title="Start new measurement"
          >
            + New
          </button>
        </div>
      </div>

      {savedMeasurements.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {savedMeasurements.map((m, idx) => {
            const isActive = activeMeasurement?.id === m.id;
            const date = new Date(m.updatedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            return (
              <div
                key={m.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-all ${
                  isActive
                    ? 'bg-skyhawk-900/30 ring-1 ring-skyhawk-700 text-skyhawk-300'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                }`}
                onClick={() => { if (!isActive) loadMeasurement(m.id); }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">
                      Measurement {idx + 1}
                    </span>
                    {m.facets.length > 0 && (
                      <span className="text-[10px] text-gray-600">
                        {m.facets.length}f / {m.totalSquares.toFixed(1)}sq
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-600">{date}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSavedMeasurement(m.id); }}
                  className="text-red-400/50 hover:text-red-400 ml-2 shrink-0"
                  title="Delete saved measurement"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
