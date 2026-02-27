import { useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import type { EdgeType } from '../../types';

/**
 * CorrectionOverlay — Post-detection UI for correcting ML model predictions.
 *
 * Allows the user to:
 * - Add missing edges (draw new lines with class labels)
 * - Delete false edges (click to remove)
 * - Reclassify edges (change ridge → hip, etc.)
 * - Save corrections as training data for active learning
 */

const EDGE_COLORS: Record<EdgeType, string> = {
  ridge: '#FF0000',
  hip: '#FFA500',
  valley: '#0000FF',
  rake: '#00FF00',
  eave: '#00FF00',
  flashing: '#C0C0C0',
  'step-flashing': '#808080',
};

const EDGE_TYPES: EdgeType[] = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing'];

interface CorrectionOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Close the overlay */
  onClose: () => void;
  /** Data source of the last detection */
  dataSource?: string;
}

export default function CorrectionOverlay({ visible, onClose, dataSource }: CorrectionOverlayProps) {
  const token = useStore((s) => s.token);
  const vertices = useStore((s) => s.activeMeasurement?.vertices ?? []);
  const edges = useStore((s) => s.activeMeasurement?.edges ?? []);
  // Will be used when drag-to-move and click-to-add correction modes are wired up
  void useStore((s) => s.moveVertex);
  void useStore((s) => s.addEdge);
  const updateEdgeType = useStore((s) => s.updateEdgeType);
  const deleteEdge = useStore((s) => s.deleteEdge);

  const [selectedEdgeType, setSelectedEdgeType] = useState<EdgeType>('ridge');
  const [correctionCount, setCorrectionCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  // Save corrections as training data
  const handleSaveAsTrainingData = useCallback(async () => {
    if (!token) {
      setStatus('Error: not authenticated');
      return;
    }

    setSaving(true);
    setStatus('Saving corrections as training data...');

    try {
      // Render current edge state to a 640x640 mask
      // This is done server-side via the correction exporter
      const correctionData = {
        vertices: vertices.map((v) => ({ lat: v.lat, lng: v.lng })),
        edges: edges.map((e) => ({
          startVertexId: e.startVertexId,
          endVertexId: e.endVertexId,
          type: e.type,
        })),
        dataSource,
      };

      const res = await fetch('/api/ml/annotations/correction/corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          maskBase64: '', // Server generates mask from edges
          correctionData,
          source: 'correction',
        }),
      });

      if (!res.ok) throw new Error(`Save failed: ${res.status}`);

      setStatus(`Saved ${correctionCount} corrections as training data`);
      setCorrectionCount(0);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Save failed'}`);
    } finally {
      setSaving(false);
    }
  }, [token, vertices, edges, dataSource, correctionCount]);

  // Delete an edge
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      deleteEdge(edgeId);
      setCorrectionCount((c) => c + 1);
    },
    [deleteEdge]
  );

  // Reclassify an edge
  const handleReclassify = useCallback(
    (edgeId: string, newType: EdgeType) => {
      updateEdgeType(edgeId, newType);
      setCorrectionCount((c) => c + 1);
    },
    [updateEdgeType]
  );

  if (!visible) return null;

  return (
    <div className="absolute top-2 right-2 z-30 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-white">Correct Edges</h3>
          <p className="text-xs text-gray-400">
            {dataSource === 'ml-model' ? 'ML Model' : dataSource === 'ai-vision' ? 'AI Vision' : 'Detection'} results
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">&times;</button>
      </div>

      {/* Edge type selector for new edges */}
      <div className="p-2 border-b border-gray-700">
        <p className="text-xs text-gray-400 mb-1">New edge type:</p>
        <div className="flex gap-1 flex-wrap">
          {EDGE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedEdgeType(type)}
              className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${
                selectedEdgeType === type ? 'ring-1 ring-white bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: EDGE_COLORS[type] }}
              />
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Edge list with reclassify/delete controls */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-xs text-gray-400 mb-1">{edges.length} edges detected</p>
        {edges.length === 0 && (
          <p className="text-xs text-gray-500 italic">No edges to correct</p>
        )}
        {edges.map((edge) => (
          <div
            key={edge.id}
            className="flex items-center gap-1 py-1 border-b border-gray-800 text-xs"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: EDGE_COLORS[edge.type] || '#888' }}
            />
            <span className="flex-1 truncate text-gray-300">{edge.type}</span>
            <span className="text-gray-500">{edge.lengthFt.toFixed(0)}ft</span>

            {/* Reclassify dropdown */}
            <select
              value={edge.type}
              onChange={(e) => handleReclassify(edge.id, e.target.value as EdgeType)}
              className="bg-gray-800 border border-gray-700 rounded text-xs py-0 px-1"
            >
              {EDGE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Delete button */}
            <button
              onClick={() => handleDeleteEdge(edge.id)}
              className="text-red-400 hover:text-red-300 px-1"
              title="Delete edge"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Footer with save button */}
      <div className="p-2 border-t border-gray-700">
        {status && <p className="text-xs text-gray-400 mb-1">{status}</p>}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex-1">
            {correctionCount > 0 ? `${correctionCount} corrections` : 'No changes'}
          </span>
          <button
            onClick={handleSaveAsTrainingData}
            disabled={correctionCount === 0 || saving}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-30 rounded text-xs font-medium"
          >
            {saving ? 'Saving...' : 'Save as Training Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
