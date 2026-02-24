import { useState, useCallback, useMemo } from 'react';
import type {
  CommercialRoofSection,
  DrainageZone,
  DrainDirection,
} from '../../types/commercial';
import {
  DRAIN_TYPE_LABELS,
  PONDING_RISK_COLORS,
} from '../../types/commercial';
import { analyzeDrainage, recommendDrainLayout } from '../../utils/drainageAnalysis';

interface DrainagePanelProps {
  sections: CommercialRoofSection[];
  drainageZones: DrainageZone[];
  onUpdateDrainageZones: (zones: DrainageZone[]) => void;
}

const DRAIN_TYPES: DrainageZone['drainType'][] = [
  'internal-drain', 'scupper', 'gutter', 'crickets', 'tapered-insulation',
];

const DIRECTION_OPTIONS: DrainDirection[] = [
  'north', 'south', 'east', 'west', 'internal', 'scupper',
];

export default function DrainagePanel({ sections, drainageZones, onUpdateDrainageZones }: DrainagePanelProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    sections[0]?.id ?? ''
  );
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newDrainType, setNewDrainType] = useState<DrainageZone['drainType']>('internal-drain');
  const [newDirection, setNewDirection] = useState<DrainDirection>('internal');
  const [newDrainCount, setNewDrainCount] = useState('1');

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  const analysis = useMemo(() => {
    if (!selectedSection) return null;
    return analyzeDrainage(selectedSection, drainageZones);
  }, [selectedSection, drainageZones]);

  const layout = useMemo(() => {
    if (!selectedSection) return null;
    return recommendDrainLayout(selectedSection);
  }, [selectedSection]);

  const sectionZones = useMemo(
    () => drainageZones.filter((z) => z.sectionId === selectedSectionId),
    [drainageZones, selectedSectionId]
  );

  const handleAddZone = useCallback(() => {
    if (!selectedSectionId) return;

    const count = parseInt(newDrainCount, 10) || 1;

    const newZone: DrainageZone = {
      id: `drain-${Date.now()}`,
      sectionId: selectedSectionId,
      drainType: newDrainType,
      direction: newDirection,
      drainCount: count,
      adequacy: count >= (analysis?.recommendedDrainCount ?? 1) ? 'adequate' : 'marginal',
      pondingRisk: analysis?.pondingRisk ?? 'medium',
    };

    onUpdateDrainageZones([...drainageZones, newZone]);
    setIsAddingZone(false);
    setNewDrainCount('1');
  }, [selectedSectionId, newDrainType, newDirection, newDrainCount, drainageZones, onUpdateDrainageZones, analysis]);

  const handleRemoveZone = useCallback((zoneId: string) => {
    onUpdateDrainageZones(drainageZones.filter((z) => z.id !== zoneId));
  }, [drainageZones, onUpdateDrainageZones]);

  return (
    <div>
      {/* Section Selector */}
      <div className="mb-3">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Section</label>
        <select
          value={selectedSectionId}
          onChange={(e) => setSelectedSectionId(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {sections.length === 0 && (
        <div className="text-center py-6 text-xs text-gray-500">
          Add roof sections first to configure drainage.
        </div>
      )}

      {selectedSection && analysis && (
        <>
          {/* Ponding Risk Indicator */}
          <div className="mb-3 p-3 rounded-lg border" style={{
            borderColor: PONDING_RISK_COLORS[analysis.pondingRisk] + '66',
            backgroundColor: PONDING_RISK_COLORS[analysis.pondingRisk] + '11',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: PONDING_RISK_COLORS[analysis.pondingRisk] }}
              />
              <span className="text-xs font-medium text-white">
                Ponding Risk: <span className="capitalize" style={{ color: PONDING_RISK_COLORS[analysis.pondingRisk] }}>
                  {analysis.pondingRisk}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-gray-500">Current Drains</span>
                <p className="text-white font-medium">{analysis.existingDrainCount}</p>
              </div>
              <div>
                <span className="text-gray-500">Recommended</span>
                <p className="text-white font-medium">{analysis.recommendedDrainCount}</p>
              </div>
              <div>
                <span className="text-gray-500">Adequacy</span>
                <p className={`font-medium capitalize ${
                  analysis.adequacy === 'adequate' ? 'text-green-400' :
                  analysis.adequacy === 'marginal' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {analysis.adequacy}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Section Area</span>
                <p className="text-white font-medium">{analysis.areaSqFt.toLocaleString()} sqft</p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="mb-3 p-2.5 bg-blue-900/20 border border-blue-900/40 rounded-lg">
              <h4 className="text-[10px] text-blue-400 uppercase tracking-wider mb-1.5">Recommendations</h4>
              <ul className="space-y-1">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="text-[10px] text-gray-400 leading-relaxed">
                    &bull; {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Layout Recommendation */}
          {layout && (
            <div className="mb-3 p-2.5 bg-gray-800/50 border border-gray-700 rounded-lg">
              <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Recommended Layout</h4>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <span className="text-gray-500">Type</span>
                  <p className="text-white">{DRAIN_TYPE_LABELS[layout.drainType]}</p>
                </div>
                <div>
                  <span className="text-gray-500">Count</span>
                  <p className="text-white">{layout.recommendedDrainCount}</p>
                </div>
                <div>
                  <span className="text-gray-500">Spacing</span>
                  <p className="text-white">{layout.spacingFt > 0 ? `${layout.spacingFt} ft` : 'N/A'}</p>
                </div>
              </div>
              {layout.notes.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {layout.notes.map((note, i) => (
                    <p key={i} className="text-[10px] text-gray-500">{note}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Drain Zone List */}
          <div className="space-y-2 mb-3">
            {sectionZones.map((zone) => (
              <div
                key={zone.id}
                className="p-2 bg-gray-800/50 border border-gray-700 rounded-lg flex items-center gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: PONDING_RISK_COLORS[zone.pondingRisk] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">
                    {DRAIN_TYPE_LABELS[zone.drainType]} &middot; {zone.drainCount} drain(s)
                  </p>
                  <p className="text-[10px] text-gray-500 capitalize">
                    Direction: {zone.direction}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveZone(zone.id)}
                  className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 bg-gray-700 hover:bg-red-900/30 rounded transition-colors shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}

            {sectionZones.length === 0 && (
              <div className="text-center py-4 text-[10px] text-gray-500">
                No drainage zones for this section.
              </div>
            )}
          </div>

          {/* Add Drain Zone */}
          {isAddingZone ? (
            <div className="p-3 bg-gray-800/50 border border-blue-700/50 rounded-lg space-y-2">
              <h4 className="text-xs font-medium text-blue-300">Add Drainage Zone</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Drain Type</label>
                  <select
                    value={newDrainType}
                    onChange={(e) => setNewDrainType(e.target.value as DrainageZone['drainType'])}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {DRAIN_TYPES.map((t) => (
                      <option key={t} value={t}>{DRAIN_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Direction</label>
                  <select
                    value={newDirection}
                    onChange={(e) => setNewDirection(e.target.value as DrainDirection)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {DIRECTION_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Drain Count</label>
                <input
                  type="number"
                  min="1"
                  value={newDrainCount}
                  onChange={(e) => setNewDrainCount(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddZone}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
                >
                  Add Zone
                </button>
                <button
                  onClick={() => setIsAddingZone(false)}
                  className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingZone(true)}
              className="w-full px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors border border-gray-700 border-dashed min-h-[44px]"
            >
              + Add Drainage Zone
            </button>
          )}
        </>
      )}
    </div>
  );
}
