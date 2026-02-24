import { useMemo } from 'react';
import type {
  CommercialProperty,
  CommercialMaterialEstimate,
} from '../../types/commercial';
import {
  COMMERCIAL_ROOF_TYPE_LABELS,
  BUILDING_TYPE_LABELS,
  CONDITION_COLORS,
  COPING_TYPE_LABELS,
  PONDING_RISK_COLORS,
} from '../../types/commercial';
import { mergeCommercialSections, calculateParapetLength, calculateRooftopPenetrations } from '../../utils/commercialRoof';
import { analyzeDrainage } from '../../utils/drainageAnalysis';
import { estimateCommercialMaterials, formatCurrency } from '../../utils/commercialMaterials';

interface CommercialReportSectionProps {
  property: CommercialProperty;
}

/**
 * Commercial-specific report content for PDF generation.
 * Renders a printable breakdown of all commercial roof data.
 * Can also be used as a preview component.
 */
export default function CommercialReportSection({ property }: CommercialReportSectionProps) {
  const summary = useMemo(() => mergeCommercialSections(property.sections), [property.sections]);
  const parapetLengths = useMemo(() => calculateParapetLength(property.parapets), [property.parapets]);
  const penetrations = useMemo(() => calculateRooftopPenetrations(property.hvacUnits), [property.hvacUnits]);

  const drainageResults = useMemo(
    () => property.sections.map((section) => analyzeDrainage(section, property.drainageZones)),
    [property.sections, property.drainageZones]
  );

  const materialEstimates = useMemo(
    () => property.sections.map((section) => estimateCommercialMaterials(section, property.parapets)),
    [property.sections, property.parapets]
  );

  const totalMaterialCost = materialEstimates.reduce((sum, e) => sum + e.materialCost, 0);
  const totalLaborCost = materialEstimates.reduce((sum, e) => sum + e.laborCost, 0);
  const totalProjectCost = materialEstimates.reduce((sum, e) => sum + e.totalCost, 0);

  return (
    <div className="space-y-6 text-xs text-gray-300">
      {/* Property Overview */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 pb-1 border-b border-gray-700">
          Commercial Property Overview
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Building Type</span>
            <span className="text-white">{BUILDING_TYPE_LABELS[property.buildingType]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Roof Area</span>
            <span className="text-white">{summary.totalAreaSqFt.toLocaleString()} sqft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Sections</span>
            <span className="text-white">{summary.sectionCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Overall Condition</span>
            <span className="capitalize font-medium" style={{ color: CONDITION_COLORS[summary.overallCondition] }}>
              {summary.overallCondition}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Predominant Type</span>
            <span className="text-white">{COMMERCIAL_ROOF_TYPE_LABELS[summary.predominantRoofType]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Perimeter</span>
            <span className="text-white">{Math.round(summary.totalPerimeterLf).toLocaleString()} lf</span>
          </div>
        </div>
      </div>

      {/* Section-by-Section Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 pb-1 border-b border-gray-700">
          Roof Section Breakdown
        </h3>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-1.5 pr-2">Section</th>
              <th className="text-left py-1.5 pr-2">Type</th>
              <th className="text-right py-1.5 pr-2">Area (sqft)</th>
              <th className="text-right py-1.5 pr-2">Slope</th>
              <th className="text-center py-1.5">Condition</th>
            </tr>
          </thead>
          <tbody>
            {property.sections.map((section) => (
              <tr key={section.id} className="border-b border-gray-800/50">
                <td className="py-1.5 pr-2 text-white">{section.name}</td>
                <td className="py-1.5 pr-2 text-gray-400">{COMMERCIAL_ROOF_TYPE_LABELS[section.roofType]}</td>
                <td className="py-1.5 pr-2 text-right text-white">{section.areaSqFt.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-right text-gray-400">{section.slopePctPerFt}"/ft</td>
                <td className="py-1.5 text-center">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium capitalize"
                    style={{
                      backgroundColor: CONDITION_COLORS[section.condition] + '22',
                      color: CONDITION_COLORS[section.condition],
                    }}
                  >
                    {section.condition}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drainage Adequacy */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 pb-1 border-b border-gray-700">
          Drainage Adequacy Assessment
        </h3>
        {drainageResults.length > 0 ? (
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-1.5 pr-2">Section</th>
                <th className="text-right py-1.5 pr-2">Drains</th>
                <th className="text-right py-1.5 pr-2">Recommended</th>
                <th className="text-center py-1.5 pr-2">Adequacy</th>
                <th className="text-center py-1.5">Ponding Risk</th>
              </tr>
            </thead>
            <tbody>
              {drainageResults.map((result) => {
                const section = property.sections.find((s) => s.id === result.sectionId);
                return (
                  <tr key={result.sectionId} className="border-b border-gray-800/50">
                    <td className="py-1.5 pr-2 text-white">{section?.name ?? result.sectionId}</td>
                    <td className="py-1.5 pr-2 text-right text-white">{result.existingDrainCount}</td>
                    <td className="py-1.5 pr-2 text-right text-gray-400">{result.recommendedDrainCount}</td>
                    <td className="py-1.5 pr-2 text-center">
                      <span className={`capitalize ${
                        result.adequacy === 'adequate' ? 'text-green-400' :
                        result.adequacy === 'marginal' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {result.adequacy}
                      </span>
                    </td>
                    <td className="py-1.5 text-center">
                      <span
                        className="inline-flex items-center gap-1 capitalize"
                        style={{ color: PONDING_RISK_COLORS[result.pondingRisk] }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ backgroundColor: PONDING_RISK_COLORS[result.pondingRisk] }}
                        />
                        {result.pondingRisk}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 italic">No drainage data available.</p>
        )}
      </div>

      {/* Parapet/Coping Summary */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 pb-1 border-b border-gray-700">
          Parapet &amp; Coping Summary
        </h3>
        {property.parapets.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <span className="text-gray-500 block">Total Parapet</span>
                <span className="text-white font-medium">{parapetLengths.totalLf.toLocaleString()} lf</span>
              </div>
              <div>
                <span className="text-gray-500 block">Coping Length</span>
                <span className="text-white font-medium">{parapetLengths.copingLf.toLocaleString()} lf</span>
              </div>
              <div>
                <span className="text-gray-500 block">Segments</span>
                <span className="text-white font-medium">{property.parapets.length}</span>
              </div>
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1.5 pr-2">Segment</th>
                  <th className="text-right py-1.5 pr-2">Length (ft)</th>
                  <th className="text-right py-1.5 pr-2">Height (ft)</th>
                  <th className="text-left py-1.5 pr-2">Coping</th>
                  <th className="text-center py-1.5">Condition</th>
                </tr>
              </thead>
              <tbody>
                {property.parapets.map((seg, i) => (
                  <tr key={seg.id} className="border-b border-gray-800/50">
                    <td className="py-1.5 pr-2 text-white">Segment {i + 1}</td>
                    <td className="py-1.5 pr-2 text-right text-white">{seg.lengthFt}</td>
                    <td className="py-1.5 pr-2 text-right text-gray-400">{seg.heightFt}</td>
                    <td className="py-1.5 pr-2 text-gray-400">
                      {COPING_TYPE_LABELS[seg.copingType]}
                      {seg.copingType !== 'none' ? ` (${seg.copingWidthIn}")` : ''}
                    </td>
                    <td className="py-1.5 text-center">
                      <span
                        className="capitalize"
                        style={{ color: CONDITION_COLORS[seg.condition] }}
                      >
                        {seg.condition}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-gray-500 italic">No parapet data recorded.</p>
        )}
      </div>

      {/* Rooftop Penetration Inventory */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 pb-1 border-b border-gray-700">
          Rooftop Penetration Inventory
        </h3>
        {property.hvacUnits.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <span className="text-gray-500 block">Total Penetration Area</span>
                <span className="text-white font-medium">{penetrations.totalArea.toLocaleString()} sqft</span>
              </div>
              <div>
                <span className="text-gray-500 block">Flashing Perimeter</span>
                <span className="text-white font-medium">{penetrations.flashingPerimeter.toLocaleString()} lf</span>
              </div>
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1.5 pr-2">Type</th>
                  <th className="text-right py-1.5 pr-2">Size (WxL)</th>
                  <th className="text-right py-1.5 pr-2">Height</th>
                  <th className="text-center py-1.5">Flashing</th>
                </tr>
              </thead>
              <tbody>
                {property.hvacUnits.map((unit) => (
                  <tr key={unit.id} className="border-b border-gray-800/50">
                    <td className="py-1.5 pr-2 text-white capitalize">{unit.type.replace('-', ' ')}</td>
                    <td className="py-1.5 pr-2 text-right text-gray-400">
                      {unit.widthFt}&apos; x {unit.lengthFt}&apos;
                    </td>
                    <td className="py-1.5 pr-2 text-right text-gray-400">{unit.heightFt}&apos;</td>
                    <td className="py-1.5 text-center">
                      <span
                        className="capitalize"
                        style={{ color: CONDITION_COLORS[unit.flashingCondition] }}
                      >
                        {unit.flashingCondition}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-gray-500 italic">No rooftop units recorded.</p>
        )}
      </div>

      {/* Material Estimate with Costs */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 pb-1 border-b border-gray-700">
          Material Estimate &amp; Costs
        </h3>
        {materialEstimates.length > 0 ? (
          <>
            <table className="w-full text-[10px] mb-3">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1.5 pr-2">Section</th>
                  <th className="text-right py-1.5 pr-2">Membrane</th>
                  <th className="text-right py-1.5 pr-2">Insulation</th>
                  <th className="text-right py-1.5 pr-2">Material $</th>
                  <th className="text-right py-1.5 pr-2">Labor $</th>
                  <th className="text-right py-1.5">Total $</th>
                </tr>
              </thead>
              <tbody>
                {materialEstimates.map((est) => {
                  const section = property.sections.find((s) => s.id === est.sectionId);
                  return (
                    <tr key={est.sectionId} className="border-b border-gray-800/50">
                      <td className="py-1.5 pr-2 text-white">{section?.name ?? est.sectionId}</td>
                      <td className="py-1.5 pr-2 text-right text-gray-400">{est.membraneSqFt.toLocaleString()} sqft</td>
                      <td className="py-1.5 pr-2 text-right text-gray-400">{est.insulationBoardCount} boards</td>
                      <td className="py-1.5 pr-2 text-right text-white">{formatCurrency(est.materialCost)}</td>
                      <td className="py-1.5 pr-2 text-right text-white">{formatCurrency(est.laborCost)}</td>
                      <td className="py-1.5 text-right text-white font-medium">{formatCurrency(est.totalCost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Totals */}
            <div className="p-2.5 bg-gray-800/50 border border-gray-700 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-gray-500 block">Total Materials</span>
                  <span className="text-white font-medium">{formatCurrency(totalMaterialCost)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Total Labor</span>
                  <span className="text-white font-medium">{formatCurrency(totalLaborCost)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Project Total</span>
                  <span className="text-green-400 font-semibold">{formatCurrency(totalProjectCost)}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-gray-500 italic">No sections to estimate.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Generate commercial report data as a plain object for PDF export.
 * This can be consumed by reportGenerator.ts to add commercial sections.
 */
export function getCommercialReportData(property: CommercialProperty) {
  const summary = mergeCommercialSections(property.sections);
  const parapetLengths = calculateParapetLength(property.parapets);
  const penetrations = calculateRooftopPenetrations(property.hvacUnits);

  const drainageResults = property.sections.map((section) =>
    analyzeDrainage(section, property.drainageZones)
  );

  const materialEstimates: CommercialMaterialEstimate[] = property.sections.map((section) =>
    estimateCommercialMaterials(section, property.parapets)
  );

  const totalMaterialCost = materialEstimates.reduce((sum, e) => sum + e.materialCost, 0);
  const totalLaborCost = materialEstimates.reduce((sum, e) => sum + e.laborCost, 0);
  const totalProjectCost = materialEstimates.reduce((sum, e) => sum + e.totalCost, 0);

  return {
    summary,
    parapetLengths,
    penetrations,
    drainageResults,
    materialEstimates,
    totalMaterialCost,
    totalLaborCost,
    totalProjectCost,
  };
}
