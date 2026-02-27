import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';

/**
 * AccuracyDashboard — Displays ML model performance metrics.
 *
 * Shows:
 * - Model version + training data count
 * - Per-class IoU (when evaluation data is available)
 * - ML vs Claude Vision comparison stats
 * - Training data growth over time
 */

interface ModelStatus {
  available: boolean;
  modelVersion: string | null;
  reason?: string;
}

interface AnnotationSummary {
  id: string;
  name: string;
  createdAt: string;
  source?: string;
}

export default function AccuracyDashboard() {
  const token = useStore((s) => s.token);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/ml/vision/status', { headers }).then((r) => r.json()),
      fetch('/api/ml/annotations', { headers }).then((r) => r.json()),
    ])
      .then(([status, anns]) => {
        setModelStatus(status);
        if (Array.isArray(anns)) setAnnotations(anns);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="p-4 text-gray-400 text-sm">Loading ML dashboard...</div>
    );
  }

  const totalAnnotations = annotations.length;
  const corrections = annotations.filter((a) => a.source === 'correction').length;
  const original = totalAnnotations - corrections;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
        ML Edge Detection
      </h2>

      {/* Model status */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Model Status</h3>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${modelStatus?.available ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-sm text-white">
            {modelStatus?.available ? 'Available' : 'Not Available'}
          </span>
        </div>
        {modelStatus?.modelVersion && (
          <p className="text-xs text-gray-400 mt-1">Version: {modelStatus.modelVersion}</p>
        )}
        {modelStatus?.reason && (
          <p className="text-xs text-yellow-400 mt-1">{modelStatus.reason}</p>
        )}
      </div>

      {/* Training data stats */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Training Data</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-white">{totalAnnotations}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-400">{original}</p>
            <p className="text-xs text-gray-400">Annotated</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-400">{corrections}</p>
            <p className="text-xs text-gray-400">Corrections</p>
          </div>
        </div>

        {/* Progress toward targets */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress to usable model (200 images)</span>
            <span>{Math.min(100, Math.round((totalAnnotations / 200) * 100))}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, (totalAnnotations / 200) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quality targets */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Quality Targets</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-300">Initial (50-100 imgs)</span>
            <span className="text-gray-400">Edge IoU &gt; 0.30</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Usable (200+ imgs)</span>
            <span className="text-gray-400">Edge IoU &gt; 0.50</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Production (500+ imgs)</span>
            <span className="text-gray-400">Edge IoU &gt; 0.65</span>
          </div>
        </div>
      </div>

      {/* Detection pipeline info */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Detection Pipeline</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 text-center text-gray-500">1</span>
            <span className="text-green-400">LIDAR Mask</span>
            <span className="text-gray-500">— highest accuracy</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 text-center text-gray-500">2</span>
            <span className={modelStatus?.available ? 'text-blue-400' : 'text-gray-500'}>
              ML Model
            </span>
            <span className="text-gray-500">
              — {modelStatus?.available ? 'active' : 'not loaded'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 text-center text-gray-500">3</span>
            <span className="text-yellow-400">Claude Vision API</span>
            <span className="text-gray-500">— fallback</span>
          </div>
        </div>
      </div>

      {/* Recent annotations */}
      {annotations.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Recent Annotations ({annotations.length})
          </h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {annotations.slice(-10).reverse().map((ann) => (
              <div key={ann.id} className="flex items-center gap-2 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    ann.source === 'correction' ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                />
                <span className="text-gray-300 flex-1 truncate">{ann.name}</span>
                <span className="text-gray-500">
                  {new Date(ann.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
