import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { generateReport } from '../../utils/reportGenerator';
import { captureMapScreenshot } from '../../utils/mapCapture';
import { renderLengthDiagram, renderAreaDiagram, renderPitchDiagram } from '../../utils/diagramRenderer';
import { captureObliqueViews } from '../../services/imageryApi';
import { downloadHtmlReport } from '../../utils/htmlReportExporter';
import type { HtmlReportData } from '../../utils/htmlReportExporter';

export default function ReportPanel() {
  const { activeMeasurement, activePropertyId, properties, saveMeasurement, solarInsights, roofCondition } = useStore();
  const [generating, setGenerating] = useState(false);
  const [companyName, setCompanyName] = useState('GotRuf Reports');
  const [notes, setNotes] = useState('');
  const [includeMap, setIncludeMap] = useState(true);
  const [includeDamage, setIncludeDamage] = useState(true);
  const [includeClaims, setIncludeClaims] = useState(true);
  const [includeMultiStructure, setIncludeMultiStructure] = useState(true);
  const [includeSolar, setIncludeSolar] = useState(true);
  const [includeLengthDiagram, setIncludeLengthDiagram] = useState(true);
  const [includeAreaDiagram, setIncludeAreaDiagram] = useState(true);
  const [includePitchDiagram, setIncludePitchDiagram] = useState(true);
  const [includeObliqueViews, setIncludeObliqueViews] = useState(false);
  const [includeSolarPanelLayout, setIncludeSolarPanelLayout] = useState(true);
  const [includeHtmlExport, setIncludeHtmlExport] = useState(true);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [htmlTooltipVisible, setHtmlTooltipVisible] = useState(false);

  const property = activePropertyId ? properties.find((p) => p.id === activePropertyId) : null;
  const hasSolarPanels = !!(solarInsights?.solarPotential?.solarPanels?.length);

  const damageCount = property?.damageAnnotations?.length ?? 0;
  const claimsCount = property?.claims?.length ?? 0;
  const structureCount = property?.measurements?.length ?? 0;
  const hasEdges = (activeMeasurement?.edges.length ?? 0) > 0;

  if (!activeMeasurement) return null;

  const hasData = activeMeasurement.facets.length > 0;

  const handleGenerateReport = async () => {
    if (!property || !hasData) return;
    setGenerating(true);
    try {
      saveMeasurement();

      // Capture map screenshot
      let mapScreenshot: string | undefined;
      if (includeMap) {
        mapScreenshot = await captureMapScreenshot();
      }

      // Render wireframe diagrams
      let lengthDiagramImage: string | undefined;
      let areaDiagramImage: string | undefined;
      let pitchDiagramImage: string | undefined;

      if (includeLengthDiagram && hasEdges) {
        lengthDiagramImage = renderLengthDiagram(activeMeasurement) ?? undefined;
      }
      if (includeAreaDiagram && hasData) {
        areaDiagramImage = renderAreaDiagram(activeMeasurement) ?? undefined;
      }
      if (includePitchDiagram && hasData) {
        pitchDiagramImage = renderPitchDiagram(activeMeasurement) ?? undefined;
      }

      // Capture oblique views
      let obliqueViews: { north?: string; south?: string; east?: string; west?: string } | undefined;
      if (includeObliqueViews) {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          obliqueViews = await captureObliqueViews(property.lat, property.lng, apiKey);
        }
      }

      await generateReport(property, activeMeasurement, {
        companyName,
        notes,
        mapScreenshot,
        includeDamage,
        includeClaims,
        includeMultiStructure,
        includeSolar,
        latitude: property.lat,
        solarInsights,
        includeSolarPanelLayout: includeSolarPanelLayout && hasSolarPanels,
        includeLengthDiagram,
        includeAreaDiagram,
        includePitchDiagram,
        lengthDiagramImage,
        areaDiagramImage,
        pitchDiagramImage,
        includeObliqueViews,
        obliqueViews,
        roofCondition,
      });
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportHtml = () => {
    if (!property || !hasData || !activeMeasurement) return;
    setExportingHtml(true);
    try {
      saveMeasurement();

      const dataSourceLabel = activeMeasurement.dataSource === 'lidar-mask' ? 'LIDAR + Solar API'
        : activeMeasurement.dataSource === 'hybrid' ? 'Solar API + AI Vision'
        : activeMeasurement.dataSource === 'ai-vision' ? 'AI Vision'
        : 'Manual Measurement';
      const confidenceLevel = activeMeasurement.dataSource === 'lidar-mask' ? 'High'
        : activeMeasurement.dataSource === 'hybrid' ? 'High'
        : activeMeasurement.dataSource === 'ai-vision' ? 'Medium'
        : 'Standard';

      const reportData: HtmlReportData = {
        property: {
          address: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
          lat: property.lat,
          lng: property.lng,
        },
        measurement: {
          vertices: activeMeasurement.vertices.map((v) => ({ id: v.id, lat: v.lat, lng: v.lng })),
          edges: activeMeasurement.edges.map((e) => ({
            id: e.id,
            startVertexId: e.startVertexId,
            endVertexId: e.endVertexId,
            type: e.type,
            lengthFt: e.lengthFt,
          })),
          facets: activeMeasurement.facets.map((f) => ({
            id: f.id,
            name: f.name,
            pitch: f.pitch,
            areaSqFt: f.areaSqFt,
            trueAreaSqFt: f.trueAreaSqFt,
            vertexIds: f.vertexIds,
          })),
          totalArea: activeMeasurement.totalAreaSqFt,
          totalTrueArea: activeMeasurement.totalTrueAreaSqFt,
          suggestedWaste: activeMeasurement.suggestedWastePercent,
        },
        generatedAt: new Date().toISOString(),
        confidence: confidenceLevel,
        dataSource: dataSourceLabel,
      };

      downloadHtmlReport(reportData);
    } catch (err) {
      console.error('HTML export failed:', err);
    } finally {
      setExportingHtml(false);
    }
  };

  const handleSave = () => {
    saveMeasurement();
  };

  return (
    <div className="p-3 space-y-4">
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Report Settings
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gotruf-500"
              placeholder="Your Company Name"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gotruf-500 resize-none"
              placeholder="Additional notes for the report..."
            />
          </div>
        </div>
      </section>

      {/* Report Preview Info */}
      {hasData && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Report Contents
          </h3>
          <div className="space-y-1.5 text-xs text-gray-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMap}
                onChange={(e) => setIncludeMap(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>Aerial view screenshot</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Property overview & address
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Roof measurement summary
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Facet details with squares
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Ridge, hip, valley, rake, eave lengths
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Waste factor calculation table
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">&#10003;</span> Material estimation
            </div>

            {/* Wireframe Diagrams */}
            <div className="mt-2 pt-2 border-t border-gray-700/50">
              <span className="text-gray-500 text-[10px] uppercase tracking-wider">Diagram Pages</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLengthDiagram}
                onChange={(e) => setIncludeLengthDiagram(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>Length diagram (edge measurements)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAreaDiagram}
                onChange={(e) => setIncludeAreaDiagram(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>Area diagram (facet areas)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includePitchDiagram}
                onChange={(e) => setIncludePitchDiagram(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>Pitch diagram (color-coded)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeObliqueViews}
                onChange={(e) => setIncludeObliqueViews(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>Oblique views (N/S/E/W satellite)</span>
            </label>

            <div className="mt-2 pt-2 border-t border-gray-700/50">
              <span className="text-gray-500 text-[10px] uppercase tracking-wider">Additional Sections</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDamage}
                onChange={(e) => setIncludeDamage(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>
                Damage assessment annotations
                {damageCount > 0 && (
                  <span className="text-gray-500 ml-1">({damageCount} marker{damageCount !== 1 ? 's' : ''})</span>
                )}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeClaims}
                onChange={(e) => setIncludeClaims(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>
                Claims information
                {claimsCount > 0 && (
                  <span className="text-gray-500 ml-1">({claimsCount} claim{claimsCount !== 1 ? 's' : ''})</span>
                )}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMultiStructure}
                onChange={(e) => setIncludeMultiStructure(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>
                Multi-structure summary
                {structureCount > 1 && (
                  <span className="text-gray-500 ml-1">({structureCount} structure{structureCount !== 1 ? 's' : ''})</span>
                )}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSolar}
                onChange={(e) => setIncludeSolar(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>Solar potential analysis</span>
            </label>
            {hasSolarPanels && (
              <label className="flex items-center gap-2 cursor-pointer pl-5">
                <input
                  type="checkbox"
                  checked={includeSolarPanelLayout}
                  onChange={(e) => setIncludeSolarPanelLayout(e.target.checked)}
                  className="accent-gotruf-500"
                />
                <span>Solar panel layout diagram</span>
              </label>
            )}

            <div className="mt-2 pt-2 border-t border-gray-700/50">
              <span className="text-gray-500 text-[10px] uppercase tracking-wider">Export Formats</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHtmlExport}
                onChange={(e) => setIncludeHtmlExport(e.target.checked)}
                className="accent-gotruf-500"
              />
              <span>Interactive HTML export</span>
            </label>
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="space-y-2">
        <button
          onClick={handleSave}
          disabled={!hasData}
          className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Measurement
        </button>

        <button
          onClick={handleGenerateReport}
          disabled={!hasData || generating}
          className="w-full px-4 py-2.5 bg-gotruf-600 hover:bg-gotruf-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Generating...' : 'Generate PDF Report'}
        </button>

        {includeHtmlExport && (
          <div className="relative">
            <button
              onClick={handleExportHtml}
              disabled={!hasData || exportingHtml}
              onMouseEnter={() => setHtmlTooltipVisible(true)}
              onMouseLeave={() => setHtmlTooltipVisible(false)}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingHtml ? 'Exporting...' : 'Export Interactive HTML'}
            </button>
            {htmlTooltipVisible && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-gray-200 text-xs rounded-lg shadow-lg whitespace-nowrap z-10">
                Self-contained HTML file with interactive map
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            )}
          </div>
        )}
      </section>

      {!hasData && (
        <p className="text-xs text-gray-500 text-center">
          Draw roof outlines to enable report generation.
        </p>
      )}
    </div>
  );
}
