import { useState, useCallback, useMemo } from 'react';
import type { ParapetSegment } from '../../types/commercial';
import { COPING_TYPE_LABELS, CONDITION_COLORS } from '../../types/commercial';
import { calculateParapetLength } from '../../utils/commercialRoof';

interface ParapetPanelProps {
  parapets: ParapetSegment[];
  onUpdateParapets: (parapets: ParapetSegment[]) => void;
}

const COPING_TYPES: ParapetSegment['copingType'][] = ['metal', 'stone', 'concrete', 'epdm', 'none'];
const CONDITION_OPTIONS: ParapetSegment['condition'][] = ['good', 'fair', 'poor'];

export default function ParapetPanel({ parapets, onUpdateParapets }: ParapetPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New parapet form state
  const [newLength, setNewLength] = useState('');
  const [newHeight, setNewHeight] = useState('3');
  const [newCopingType, setNewCopingType] = useState<ParapetSegment['copingType']>('metal');
  const [newCopingWidth, setNewCopingWidth] = useState('12');
  const [newCondition, setNewCondition] = useState<ParapetSegment['condition']>('good');

  const { totalLf, copingLf } = useMemo(() => calculateParapetLength(parapets), [parapets]);

  const handleAdd = useCallback(() => {
    const length = parseFloat(newLength);
    if (!length || length <= 0) return;

    const newSegment: ParapetSegment = {
      id: `parapet-${Date.now()}`,
      lengthFt: length,
      heightFt: parseFloat(newHeight) || 3,
      copingType: newCopingType,
      copingWidthIn: parseFloat(newCopingWidth) || 12,
      condition: newCondition,
    };

    onUpdateParapets([...parapets, newSegment]);
    setIsAdding(false);
    setNewLength('');
    setNewHeight('3');
    setNewCopingType('metal');
    setNewCopingWidth('12');
    setNewCondition('good');
  }, [parapets, onUpdateParapets, newLength, newHeight, newCopingType, newCopingWidth, newCondition]);

  const handleRemove = useCallback((id: string) => {
    onUpdateParapets(parapets.filter((p) => p.id !== id));
  }, [parapets, onUpdateParapets]);

  const handleUpdate = useCallback((id: string, updates: Partial<ParapetSegment>) => {
    onUpdateParapets(parapets.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    setEditingId(null);
  }, [parapets, onUpdateParapets]);

  return (
    <div>
      {/* Summary Card */}
      <div className="mb-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Segments</span>
            <p className="text-white font-medium">{parapets.length}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Length</span>
            <p className="text-white font-medium">{totalLf.toLocaleString()} ft</p>
          </div>
          <div>
            <span className="text-gray-500">Coping Length</span>
            <p className="text-white font-medium">{copingLf.toLocaleString()} ft</p>
          </div>
        </div>
      </div>

      {/* Parapet Segment List */}
      <div className="space-y-2 mb-3">
        {parapets.map((seg, index) => (
          <div
            key={seg.id}
            className="p-2.5 bg-gray-800/50 border border-gray-700 rounded-lg"
          >
            {editingId === seg.id ? (
              /* Edit Mode */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Length (ft)</label>
                    <input
                      type="number"
                      min="0"
                      value={seg.lengthFt}
                      onChange={(e) =>
                        handleUpdate(seg.id, { lengthFt: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Height (ft)</label>
                    <input
                      type="number"
                      min="0"
                      value={seg.heightFt}
                      onChange={(e) =>
                        handleUpdate(seg.id, { heightFt: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Coping Type</label>
                    <select
                      value={seg.copingType}
                      onChange={(e) =>
                        handleUpdate(seg.id, { copingType: e.target.value as ParapetSegment['copingType'] })
                      }
                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {COPING_TYPES.map((t) => (
                        <option key={t} value={t}>{COPING_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Width (in)</label>
                    <input
                      type="number"
                      min="0"
                      value={seg.copingWidthIn}
                      onChange={(e) =>
                        handleUpdate(seg.id, { copingWidthIn: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Condition</label>
                    <select
                      value={seg.condition}
                      onChange={(e) =>
                        handleUpdate(seg.id, { condition: e.target.value as ParapetSegment['condition'] })
                      }
                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {CONDITION_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-[10px] text-blue-400 hover:text-blue-300"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Display Mode */
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: CONDITION_COLORS[seg.condition] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium">
                    Segment {index + 1} &middot; {seg.lengthFt} ft
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {seg.heightFt} ft tall &middot; {COPING_TYPE_LABELS[seg.copingType]} coping
                    {seg.copingType !== 'none' ? ` (${seg.copingWidthIn}")` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditingId(seg.id)}
                    className="px-2 py-1 text-[10px] text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(seg.id)}
                    className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 bg-gray-700 hover:bg-red-900/30 rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {parapets.length === 0 && (
          <div className="text-center py-6 text-xs text-gray-500">
            No parapet segments defined. Add segments to track parapet/coping measurements.
          </div>
        )}
      </div>

      {/* Add Parapet Form */}
      {isAdding ? (
        <div className="p-3 bg-gray-800/50 border border-blue-700/50 rounded-lg space-y-2">
          <h4 className="text-xs font-medium text-blue-300">New Parapet Segment</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Length (ft)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 150"
                value={newLength}
                onChange={(e) => setNewLength(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Height (ft)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={newHeight}
                onChange={(e) => setNewHeight(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Coping Type</label>
              <select
                value={newCopingType}
                onChange={(e) => setNewCopingType(e.target.value as ParapetSegment['copingType'])}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {COPING_TYPES.map((t) => (
                  <option key={t} value={t}>{COPING_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Width (in)</label>
              <input
                type="number"
                min="0"
                value={newCopingWidth}
                onChange={(e) => setNewCopingWidth(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Condition</label>
              <select
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value as ParapetSegment['condition'])}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!newLength || parseFloat(newLength) <= 0}
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
            >
              Add Segment
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors border border-gray-700 border-dashed min-h-[44px]"
        >
          + Add Parapet Segment
        </button>
      )}
    </div>
  );
}
