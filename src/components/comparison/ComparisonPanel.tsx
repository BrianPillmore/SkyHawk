import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { captureMapScreenshot } from '../../utils/mapCapture';
import type { ImageSnapshot } from '../../types';

export default function ComparisonPanel() {
  const { properties, activePropertyId, addSnapshot, deleteSnapshot } = useStore();
  const [capturing, setCapturing] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(50);

  const property = properties.find((p) => p.id === activePropertyId);
  const snapshots: ImageSnapshot[] = property?.snapshots || [];

  const beforeSnap = snapshots.find((s) => s.id === beforeId);
  const afterSnap = snapshots.find((s) => s.id === afterId);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const dataUrl = await captureMapScreenshot();
      if (dataUrl) {
        const label = labelInput.trim() || `Snapshot ${snapshots.length + 1}`;
        addSnapshot(label, dataUrl);
        setLabelInput('');
      }
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="p-3 space-y-4">
      {/* Capture */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Capture Snapshot
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Label (e.g., Before Storm)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
          />
          <button
            onClick={handleCapture}
            disabled={capturing}
            className="px-3 py-1.5 bg-gotruf-600 hover:bg-gotruf-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors whitespace-nowrap"
          >
            {capturing ? 'Capturing...' : 'Capture'}
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          Captures the current map view as a snapshot for comparison.
        </p>
      </section>

      {/* Snapshot list */}
      {snapshots.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Snapshots ({snapshots.length})
          </h3>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between px-2 py-1.5 rounded text-xs bg-gray-800/50 border border-gray-700/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300 truncate">{snap.label}</div>
                  <div className="text-[10px] text-gray-600">
                    {new Date(snap.capturedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => deleteSnapshot(snap.id)}
                  className="text-red-400/60 hover:text-red-400 ml-2 shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comparison selector */}
      {snapshots.length >= 2 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Compare
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Before</label>
              <select
                value={beforeId || ''}
                onChange={(e) => setBeforeId(e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
              >
                <option value="">Select...</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">After</label>
              <select
                value={afterId || ''}
                onChange={(e) => setAfterId(e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
              >
                <option value="">Select...</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Slider comparison viewer */}
          {beforeSnap && afterSnap && (
            <div className="space-y-2">
              <div
                className="relative w-full overflow-hidden rounded-lg border border-gray-700/50"
                style={{ aspectRatio: '16/10' }}
              >
                {/* After image (full) */}
                <img
                  src={afterSnap.dataUrl}
                  alt={afterSnap.label}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Before image (clipped by slider) */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${sliderPos}%` }}
                >
                  <img
                    src={beforeSnap.dataUrl}
                    alt={beforeSnap.label}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ width: `${10000 / sliderPos}%`, maxWidth: 'none' }}
                  />
                </div>
                {/* Slider line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center">
                    <span className="text-gray-800 text-[10px] font-bold">&harr;</span>
                  </div>
                </div>
                {/* Labels */}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-white z-20">
                  {beforeSnap.label}
                </div>
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-white z-20">
                  {afterSnap.label}
                </div>
              </div>
              {/* Slider control */}
              <input
                type="range"
                min="5"
                max="95"
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                className="w-full h-1 accent-gotruf-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Before</span>
                <span>After</span>
              </div>
            </div>
          )}
        </section>
      )}

      {snapshots.length < 2 && (
        <div className="text-xs text-gray-500 text-center py-4">
          Capture at least 2 snapshots to enable before/after comparison.
        </div>
      )}
    </div>
  );
}
