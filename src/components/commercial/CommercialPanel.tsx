import { useState, useCallback, useMemo } from 'react';
import type {
  CommercialProperty,
  CommercialRoofSection,
  CommercialRoofType,
} from '../../types/commercial';
import {
  COMMERCIAL_ROOF_TYPE_LABELS,
  BUILDING_TYPE_LABELS,
  CONDITION_COLORS,
} from '../../types/commercial';
import { mergeCommercialSections } from '../../utils/commercialRoof';
import { formatArea } from '../../utils/geometry';
import DrainagePanel from './DrainagePanel';
import ParapetPanel from './ParapetPanel';

interface CommercialPanelProps {
  property: CommercialProperty;
  onUpdate: (property: CommercialProperty) => void;
}

type SubPanel = 'sections' | 'drainage' | 'parapets';

const CONDITION_OPTIONS: CommercialRoofSection['condition'][] = ['good', 'fair', 'poor', 'failed'];
const ROOF_TYPE_OPTIONS: CommercialRoofType[] = [
  'flat', 'low-slope', 'metal-standing-seam', 'built-up',
  'modified-bitumen', 'single-ply', 'spray-foam',
];

export default function CommercialPanel({ property, onUpdate }: CommercialPanelProps) {
  const [activePanel, setActivePanel] = useState<SubPanel>('sections');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);

  // New section form state
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionType, setNewSectionType] = useState<CommercialRoofType>('flat');
  const [newSectionArea, setNewSectionArea] = useState('');
  const [newSectionSlope, setNewSectionSlope] = useState('0.25');
  const [newSectionCondition, setNewSectionCondition] = useState<CommercialRoofSection['condition']>('good');

  const summary = useMemo(() => mergeCommercialSections(property.sections), [property.sections]);

  const handleBuildingTypeChange = useCallback((type: CommercialProperty['buildingType']) => {
    onUpdate({ ...property, buildingType: type });
  }, [property, onUpdate]);

  const handleAddSection = useCallback(() => {
    if (!newSectionName.trim() || !newSectionArea) return;

    const newSection: CommercialRoofSection = {
      id: `section-${Date.now()}`,
      name: newSectionName.trim(),
      roofType: newSectionType,
      areaSqFt: parseFloat(newSectionArea),
      slopePctPerFt: parseFloat(newSectionSlope),
      condition: newSectionCondition,
      vertices: [],
    };

    const updatedSections = [...property.sections, newSection];
    const totalArea = updatedSections.reduce((sum, s) => sum + s.areaSqFt, 0);

    onUpdate({
      ...property,
      sections: updatedSections,
      totalRoofAreaSqFt: totalArea,
    });

    // Reset form
    setNewSectionName('');
    setNewSectionType('flat');
    setNewSectionArea('');
    setNewSectionSlope('0.25');
    setNewSectionCondition('good');
    setIsAddingSection(false);
  }, [property, onUpdate, newSectionName, newSectionType, newSectionArea, newSectionSlope, newSectionCondition]);

  const handleRemoveSection = useCallback((sectionId: string) => {
    const updatedSections = property.sections.filter((s) => s.id !== sectionId);
    const totalArea = updatedSections.reduce((sum, s) => sum + s.areaSqFt, 0);

    onUpdate({
      ...property,
      sections: updatedSections,
      totalRoofAreaSqFt: totalArea,
    });
  }, [property, onUpdate]);

  const handleUpdateSection = useCallback((sectionId: string, updates: Partial<CommercialRoofSection>) => {
    const updatedSections = property.sections.map((s) =>
      s.id === sectionId ? { ...s, ...updates } : s
    );
    const totalArea = updatedSections.reduce((sum, s) => sum + s.areaSqFt, 0);

    onUpdate({
      ...property,
      sections: updatedSections,
      totalRoofAreaSqFt: totalArea,
    });
    setEditingSectionId(null);
  }, [property, onUpdate]);

  return (
    <div className="p-3">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white mb-1">Commercial Property</h2>
        <p className="text-xs text-gray-500">Manage commercial roof sections, drainage, and parapets</p>
      </div>

      {/* Building Type Selector */}
      <div className="mb-4">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Building Type</label>
        <select
          value={property.buildingType}
          onChange={(e) => handleBuildingTypeChange(e.target.value as CommercialProperty['buildingType'])}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {(Object.entries(BUILDING_TYPE_LABELS) as [CommercialProperty['buildingType'], string][]).map(
            ([key, label]) => (
              <option key={key} value={key}>{label}</option>
            )
          )}
        </select>
      </div>

      {/* Summary Card */}
      <div className="mb-4 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Total Area</span>
            <p className="text-white font-medium">{formatArea(summary.totalAreaSqFt)}</p>
          </div>
          <div>
            <span className="text-gray-500">Sections</span>
            <p className="text-white font-medium">{summary.sectionCount}</p>
          </div>
          <div>
            <span className="text-gray-500">Predominant Type</span>
            <p className="text-white font-medium">
              {COMMERCIAL_ROOF_TYPE_LABELS[summary.predominantRoofType]}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Overall Condition</span>
            <p
              className="font-medium capitalize"
              style={{ color: CONDITION_COLORS[summary.overallCondition] }}
            >
              {summary.overallCondition}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Panel Navigation */}
      <div className="flex gap-1 mb-4">
        {([
          { key: 'sections' as SubPanel, label: 'Sections' },
          { key: 'drainage' as SubPanel, label: 'Drainage' },
          { key: 'parapets' as SubPanel, label: 'Parapets' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActivePanel(key)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              activePanel === key
                ? 'bg-blue-900/50 text-blue-300 ring-1 ring-blue-700'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sub-Panel Content */}
      {activePanel === 'sections' && (
        <div>
          {/* Section List */}
          <div className="space-y-2 mb-3">
            {property.sections.map((section) => (
              <div
                key={section.id}
                className="p-2.5 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                {editingSectionId === section.id ? (
                  /* Edit Mode */
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={section.name}
                      onChange={(e) =>
                        handleUpdateSection(section.id, { name: e.target.value })
                      }
                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={section.roofType}
                        onChange={(e) =>
                          handleUpdateSection(section.id, { roofType: e.target.value as CommercialRoofType })
                        }
                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {ROOF_TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>{COMMERCIAL_ROOF_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                      <select
                        value={section.condition}
                        onChange={(e) =>
                          handleUpdateSection(section.id, {
                            condition: e.target.value as CommercialRoofSection['condition'],
                          })
                        }
                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {CONDITION_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => setEditingSectionId(null)}
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
                      style={{ backgroundColor: CONDITION_COLORS[section.condition] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{section.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {COMMERCIAL_ROOF_TYPE_LABELS[section.roofType]} &middot; {formatArea(section.areaSqFt)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setEditingSectionId(section.id)}
                        className="px-2 py-1 text-[10px] text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemoveSection(section.id)}
                        className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 bg-gray-700 hover:bg-red-900/30 rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {property.sections.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-500">
                No roof sections defined. Add a section to get started.
              </div>
            )}
          </div>

          {/* Add Section Form */}
          {isAddingSection ? (
            <div className="p-3 bg-gray-800/50 border border-blue-700/50 rounded-lg space-y-2">
              <h4 className="text-xs font-medium text-blue-300">New Roof Section</h4>
              <input
                type="text"
                placeholder="Section name (e.g. Section A - Main Building)"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Roof Type</label>
                  <select
                    value={newSectionType}
                    onChange={(e) => setNewSectionType(e.target.value as CommercialRoofType)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {ROOF_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{COMMERCIAL_ROOF_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Area (sqft)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 25000"
                    value={newSectionArea}
                    onChange={(e) => setNewSectionArea(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Slope (in/ft)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0625"
                    value={newSectionSlope}
                    onChange={(e) => setNewSectionSlope(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Condition</label>
                  <select
                    value={newSectionCondition}
                    onChange={(e) => setNewSectionCondition(e.target.value as CommercialRoofSection['condition'])}
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
                  onClick={handleAddSection}
                  disabled={!newSectionName.trim() || !newSectionArea}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
                >
                  Add Section
                </button>
                <button
                  onClick={() => setIsAddingSection(false)}
                  className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingSection(true)}
              className="w-full px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors border border-gray-700 border-dashed min-h-[44px]"
            >
              + Add Roof Section
            </button>
          )}
        </div>
      )}

      {activePanel === 'drainage' && (
        <DrainagePanel
          sections={property.sections}
          drainageZones={property.drainageZones}
          onUpdateDrainageZones={(zones) => onUpdate({ ...property, drainageZones: zones })}
        />
      )}

      {activePanel === 'parapets' && (
        <ParapetPanel
          parapets={property.parapets}
          onUpdateParapets={(parapets) => onUpdate({ ...property, parapets })}
        />
      )}
    </div>
  );
}
