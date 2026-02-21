import { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { RoofMeasurement, Property } from '../../types';
import { formatArea, formatLength, formatPitch, formatNumber } from '../../utils/geometry';
import { EDGE_COLORS, EDGE_LABELS } from '../../utils/colors';
import { calculateWasteTable } from '../../utils/geometry';
import { estimateMaterials } from '../../utils/materials';
import { exportMeasurementJSON, exportMeasurementGeoJSON, exportMeasurementCSV } from '../../utils/exportData';
import { exportESX } from '../../utils/esxExport';
import PitchDiagram from './PitchDiagram';
import DamagePanel from './DamagePanel';
import RoofViewer3D from './RoofViewer3D';

export default function MeasurementsPanel() {
  const {
    activeMeasurement,
    selectedFacetId,
    selectFacet,
    updateFacetPitch,
    deleteFacet,
    deleteEdge,
    selectEdge,
    selectedEdgeId,
    properties,
    activePropertyId,
  } = useStore();

  if (!activeMeasurement) return null;

  const { facets, edges } = activeMeasurement;
  const wasteTable = calculateWasteTable(activeMeasurement.totalTrueAreaSqFt);

  return (
    <div className="p-3 space-y-4">
      {/* Summary */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Roof Summary
          </h3>
          <ExportDropdown measurement={activeMeasurement} property={properties.find(p => p.id === activePropertyId)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SummaryCard label="Total Area" value={formatArea(activeMeasurement.totalTrueAreaSqFt)} />
          <SummaryCard label="Flat Area" value={formatArea(activeMeasurement.totalAreaSqFt)} />
          <SummaryCard label="Squares" value={formatNumber(activeMeasurement.totalSquares, 1)} />
          <SummaryCard label="Predominant Pitch" value={formatPitch(activeMeasurement.predominantPitch)} />
          <SummaryCard label="Facets" value={String(facets.length)} />
          <SummaryCard label="Waste Factor" value={`${activeMeasurement.suggestedWastePercent}%`} />
        </div>
      </section>

      {/* Edge Lengths */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Line Measurements
        </h3>
        <div className="space-y-1.5">
          <LineSummary type="ridge" label="Ridges" length={activeMeasurement.totalRidgeLf} count={edges.filter(e => e.type === 'ridge').length} />
          <LineSummary type="hip" label="Hips" length={activeMeasurement.totalHipLf} count={edges.filter(e => e.type === 'hip').length} />
          <LineSummary type="valley" label="Valleys" length={activeMeasurement.totalValleyLf} count={edges.filter(e => e.type === 'valley').length} />
          <LineSummary type="rake" label="Rakes" length={activeMeasurement.totalRakeLf} count={edges.filter(e => e.type === 'rake').length} />
          <LineSummary type="eave" label="Eaves" length={activeMeasurement.totalEaveLf} count={edges.filter(e => e.type === 'eave').length} />
          <LineSummary type="flashing" label="Flashing" length={activeMeasurement.totalFlashingLf} count={edges.filter(e => e.type === 'flashing' || e.type === 'step-flashing').length} />
          <div className="pt-1.5 border-t border-gray-800">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300 font-medium">Drip Edge (Total)</span>
              <span className="text-white font-medium">{formatLength(activeMeasurement.totalDripEdgeLf)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Facets */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Roof Facets ({facets.length})
        </h3>
        {facets.length === 0 ? (
          <p className="text-xs text-gray-500">No facets drawn yet. Use the Outline tool to draw roof facets.</p>
        ) : (
          <div className="space-y-2">
            {facets.map((facet) => (
              <div
                key={facet.id}
                onClick={() => selectFacet(facet.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedFacetId === facet.id
                    ? 'bg-skyhawk-900/30 border-skyhawk-600'
                    : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{facet.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFacet(facet.id); }}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Delete
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">True Area:</span>
                    <span className="text-gray-300">{formatArea(facet.trueAreaSqFt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Flat Area:</span>
                    <span className="text-gray-300">{formatArea(facet.areaSqFt)}</span>
                  </div>
                  <div className="flex justify-between items-center col-span-2">
                    <span className="text-gray-500">Pitch:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="24"
                        step="1"
                        value={facet.pitch}
                        onChange={(e) => updateFacetPitch(facet.id, Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 h-1 accent-skyhawk-500"
                      />
                      <span className="text-white font-medium w-10 text-right">
                        {formatPitch(facet.pitch)}
                      </span>
                    </div>
                  </div>
                </div>
                {selectedFacetId === facet.id && (
                  <div className="mt-2 flex justify-center border-t border-gray-700/50 pt-2">
                    <PitchDiagram pitch={facet.pitch} width={150} height={90} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edge Details */}
      {edges.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Edge Details ({edges.length})
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {edges.map((edge) => (
              <div
                key={edge.id}
                onClick={() => selectEdge(edge.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-all ${
                  selectedEdgeId === edge.id
                    ? 'bg-gray-700 ring-1 ring-gray-500'
                    : 'hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: EDGE_COLORS[edge.type] || '#fff' }}
                  />
                  <span className="text-gray-400">{EDGE_LABELS[edge.type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300">{formatLength(edge.lengthFt)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteEdge(edge.id); }}
                    className="text-red-400/60 hover:text-red-400 ml-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3D Roof Model */}
      {activeMeasurement.facets.length > 0 && (
        <RoofViewer3D measurement={activeMeasurement} />
      )}

      {/* Damage Annotations */}
      <DamagePanel />

      {/* Material Estimates */}
      {activeMeasurement.totalSquares > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Material Estimates
          </h3>
          <MaterialEstimateTable measurement={activeMeasurement} />
        </section>
      )}

      {/* Waste Table */}
      {activeMeasurement.totalTrueAreaSqFt > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Waste Factor Table
          </h3>
          <div className="bg-gray-800/50 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-3 py-2 text-left text-gray-400">Waste %</th>
                  <th className="px-3 py-2 text-right text-gray-400">Total Area</th>
                  <th className="px-3 py-2 text-right text-gray-400">Squares</th>
                </tr>
              </thead>
              <tbody>
                {wasteTable.map((row) => (
                  <tr
                    key={row.wastePercent}
                    className={`border-b border-gray-700/50 ${
                      row.wastePercent === activeMeasurement.suggestedWastePercent
                        ? 'bg-skyhawk-900/30 text-skyhawk-300'
                        : 'text-gray-300'
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      {row.wastePercent}%
                      {row.wastePercent === activeMeasurement.suggestedWastePercent && (
                        <span className="ml-1 text-skyhawk-500 text-[10px]">suggested</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">{formatArea(row.totalAreaWithWaste)}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatNumber(row.totalSquaresWithWaste, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-700/50">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
    </div>
  );
}

function LineSummary({ type, label, length, count }: { type: string; label: string; length: number; count: number }) {
  const color = EDGE_COLORS[type as keyof typeof EDGE_COLORS] || '#fff';
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-gray-400">{label}</span>
        {count > 0 && <span className="text-gray-600 text-xs">({count})</span>}
      </div>
      <span className={length > 0 ? 'text-white font-medium' : 'text-gray-600'}>{formatLength(length)}</span>
    </div>
  );
}

function MaterialEstimateTable({ measurement }: { measurement: RoofMeasurement }) {
  const materials = estimateMaterials(measurement);

  const rows: { label: string; qty: number; unit: string }[] = [
    { label: 'Shingle Bundles', qty: materials.shingleBundles, unit: 'bundles' },
    { label: 'Underlayment', qty: materials.underlaymentRolls, unit: 'rolls' },
    { label: 'Ice & Water Shield', qty: materials.iceWaterRolls, unit: 'rolls' },
    { label: 'Starter Strip', qty: materials.starterStripLf, unit: 'lf' },
    { label: 'Ridge Cap', qty: materials.ridgeCapLf, unit: 'lf' },
    { label: 'Drip Edge', qty: materials.dripEdgeLf, unit: 'lf' },
    { label: 'Step Flashing', qty: materials.stepFlashingPcs, unit: 'pcs' },
    { label: 'Pipe Boots', qty: materials.pipeBoots, unit: 'pcs' },
    { label: 'Roofing Nails', qty: materials.nailsLbs, unit: 'lbs' },
    { label: 'Caulk', qty: materials.caulkTubes, unit: 'tubes' },
    { label: 'Ridge Vent', qty: materials.ridgeVentLf, unit: 'lf' },
  ];

  // Filter out zero-quantity items
  const activeRows = rows.filter((r) => r.qty > 0);

  return (
    <div className="bg-gray-800/50 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="px-3 py-2 text-left text-gray-400">Material</th>
            <th className="px-3 py-2 text-right text-gray-400">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {activeRows.map((row, i) => (
            <tr
              key={row.label}
              className={`border-b border-gray-700/50 text-gray-300 ${i % 2 === 0 ? 'bg-gray-800/30' : ''}`}
            >
              <td className="px-3 py-1.5">{row.label}</td>
              <td className="px-3 py-1.5 text-right font-medium text-white">
                {row.qty} <span className="text-gray-500 font-normal">{row.unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[10px] text-gray-500 border-t border-gray-700/50">
        Includes {measurement.suggestedWastePercent}% waste factor. Estimates are approximate.
      </div>
    </div>
  );
}

function ExportDropdown({ measurement, property }: { measurement: RoofMeasurement; property?: Property }) {
  const [open, setOpen] = useState(false);

  const exports = [
    { label: 'JSON', fn: () => exportMeasurementJSON(measurement) },
    { label: 'GeoJSON', fn: () => exportMeasurementGeoJSON(measurement) },
    { label: 'CSV', fn: () => exportMeasurementCSV(measurement) },
    ...(property ? [{ label: 'ESX (Xactimate)', fn: () => exportESX(property, measurement) }] : []),
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2 py-1 text-[10px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors border border-gray-700"
        title="Export measurement data"
      >
        Export {open ? '\u25B4' : '\u25BE'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden min-w-[100px]">
          {exports.map((e) => (
            <button
              key={e.label}
              onClick={() => { e.fn(); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
