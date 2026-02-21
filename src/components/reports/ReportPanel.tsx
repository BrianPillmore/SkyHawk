import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { generateReport } from '../../utils/reportGenerator';
import { captureMapScreenshot } from '../../utils/mapCapture';

export default function ReportPanel() {
  const { activeMeasurement, activePropertyId, properties, saveMeasurement } = useStore();
  const [generating, setGenerating] = useState(false);
  const [companyName, setCompanyName] = useState('SkyHawk Reports');
  const [notes, setNotes] = useState('');
  const [includeMap, setIncludeMap] = useState(true);
  const [includeDamage, setIncludeDamage] = useState(true);
  const [includeClaims, setIncludeClaims] = useState(true);
  const [includeMultiStructure, setIncludeMultiStructure] = useState(true);

  const property = activePropertyId ? properties.find((p) => p.id === activePropertyId) : null;

  const damageCount = property?.damageAnnotations?.length ?? 0;
  const claimsCount = property?.claims?.length ?? 0;
  const structureCount = property?.measurements?.length ?? 0;

  if (!activeMeasurement) return null;

  const hasData = activeMeasurement.facets.length > 0;

  const handleGenerateReport = async () => {
    if (!property || !hasData) return;
    setGenerating(true);
    try {
      saveMeasurement();
      let mapScreenshot: string | undefined;
      if (includeMap) {
        mapScreenshot = await captureMapScreenshot();
      }
      await generateReport(property, activeMeasurement, {
        companyName,
        notes,
        mapScreenshot,
        includeDamage,
        includeClaims,
        includeMultiStructure,
      });
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setGenerating(false);
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
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
              placeholder="Your Company Name"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-skyhawk-500 resize-none"
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
                className="accent-skyhawk-500"
              />
              <span>Aerial view screenshot</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Property overview & address
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Roof measurement summary
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Pitch diagram & facet details
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Ridge, hip, valley, rake, eave lengths
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Waste factor calculation table
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Material estimation
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDamage}
                onChange={(e) => setIncludeDamage(e.target.checked)}
                className="accent-skyhawk-500"
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
                className="accent-skyhawk-500"
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
                className="accent-skyhawk-500"
              />
              <span>
                Multi-structure summary
                {structureCount > 1 && (
                  <span className="text-gray-500 ml-1">({structureCount} structure{structureCount !== 1 ? 's' : ''})</span>
                )}
              </span>
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
          className="w-full px-4 py-2.5 bg-skyhawk-600 hover:bg-skyhawk-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Generating...' : 'Generate PDF Report'}
        </button>
      </section>

      {!hasData && (
        <p className="text-xs text-gray-500 text-center">
          Draw roof outlines to enable report generation.
        </p>
      )}
    </div>
  );
}
