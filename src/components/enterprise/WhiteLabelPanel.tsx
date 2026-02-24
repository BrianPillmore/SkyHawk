import { useState, useEffect, useCallback } from 'react';
import type { WhiteLabelConfig } from '../../types/enterprise';
import {
  getWhiteLabelConfig,
  updateWhiteLabelConfig,
} from '../../services/enterpriseApi';

const DEFAULT_CONFIG: WhiteLabelConfig = {
  companyName: '',
  logoUrl: '',
  primaryColor: '#3b82f6',
  secondaryColor: '#1e40af',
  headerText: '',
  footerText: '',
  customDomain: '',
};

export default function WhiteLabelPanel() {
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Organization ID - in a real app this would come from context/store
  const [orgId, setOrgId] = useState<string>('');
  const [showOrgIdInput, setShowOrgIdInput] = useState(true);

  const loadConfig = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWhiteLabelConfig(id);
      setConfig({ ...DEFAULT_CONFIG, ...data });
    } catch (err) {
      // If 404, that just means no config yet, which is fine
      if (err instanceof Error && err.message.includes('404')) {
        setConfig(DEFAULT_CONFIG);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load branding config');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgId && !showOrgIdInput) {
      loadConfig(orgId);
    }
  }, [orgId, showOrgIdInput, loadConfig]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateWhiteLabelConfig(orgId, config);
      setConfig({ ...DEFAULT_CONFIG, ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branding config');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: keyof WhiteLabelConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  return (
    <div className="p-4 text-gray-200">
      <h2 className="text-lg font-bold mb-3 text-white">White-Label Branding</h2>

      {/* Error display */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-800/50 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Saved notification */}
      {saved && (
        <div className="mb-3 p-2 bg-green-900/30 border border-green-800/50 rounded text-sm text-green-400">
          Branding configuration saved successfully.
        </div>
      )}

      {/* Organization ID input */}
      {showOrgIdInput && (
        <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700 mb-4">
          <h3 className="text-sm font-semibold text-white">Select Organization</h3>
          <input
            type="text"
            placeholder="Organization ID"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
          />
          <button
            onClick={() => {
              if (orgId.trim()) setShowOrgIdInput(false);
            }}
            disabled={!orgId.trim()}
            className="w-full py-1.5 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            Load Branding Config
          </button>
        </div>
      )}

      {/* Branding configuration form */}
      {!showOrgIdInput && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-xs text-gray-500 text-center py-4">Loading branding configuration...</p>
          ) : (
            <>
              {/* Company Name */}
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Company Identity</h3>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={config.companyName || ''}
                    onChange={(e) => handleFieldChange('companyName', e.target.value)}
                    placeholder="Your Company Name"
                    className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Logo URL</label>
                  <input
                    type="url"
                    value={config.logoUrl || ''}
                    onChange={(e) => handleFieldChange('logoUrl', e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
                  />
                  {config.logoUrl && (
                    <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-700">
                      <p className="text-xs text-gray-500 mb-1">Preview:</p>
                      <img
                        src={config.logoUrl}
                        alt="Logo preview"
                        className="max-h-12 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Colors */}
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Brand Colors</h3>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.primaryColor || '#3b82f6'}
                        onChange={(e) => handleFieldChange('primaryColor', e.target.value)}
                        className="w-8 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={config.primaryColor || '#3b82f6'}
                        onChange={(e) => handleFieldChange('primaryColor', e.target.value)}
                        placeholder="#3b82f6"
                        maxLength={7}
                        className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Secondary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.secondaryColor || '#1e40af'}
                        onChange={(e) => handleFieldChange('secondaryColor', e.target.value)}
                        className="w-8 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={config.secondaryColor || '#1e40af'}
                        onChange={(e) => handleFieldChange('secondaryColor', e.target.value)}
                        placeholder="#1e40af"
                        maxLength={7}
                        className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
                {/* Color preview */}
                <div className="mt-2 flex gap-2">
                  <div
                    className="flex-1 h-8 rounded"
                    style={{ backgroundColor: config.primaryColor || '#3b82f6' }}
                  />
                  <div
                    className="flex-1 h-8 rounded"
                    style={{ backgroundColor: config.secondaryColor || '#1e40af' }}
                  />
                </div>
              </div>

              {/* Text Customization */}
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Text Customization</h3>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Header Text</label>
                  <input
                    type="text"
                    value={config.headerText || ''}
                    onChange={(e) => handleFieldChange('headerText', e.target.value)}
                    placeholder="Custom header text for reports"
                    className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Footer Text</label>
                  <input
                    type="text"
                    value={config.footerText || ''}
                    onChange={(e) => handleFieldChange('footerText', e.target.value)}
                    placeholder="Custom footer text for reports"
                    className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
                  />
                </div>
              </div>

              {/* Custom Domain */}
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Custom Domain</h3>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Custom Domain</label>
                  <input
                    type="text"
                    value={config.customDomain || ''}
                    onChange={(e) => handleFieldChange('customDomain', e.target.value)}
                    placeholder="app.yourdomain.com"
                    className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Point a CNAME record to app.skyhawk.io to use your custom domain.
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preview</h3>
                <div
                  className="rounded-lg overflow-hidden border border-gray-700"
                  style={{ backgroundColor: '#1a1a2e' }}
                >
                  {/* Preview header */}
                  <div
                    className="px-4 py-2 flex items-center gap-2"
                    style={{ backgroundColor: config.primaryColor || '#3b82f6' }}
                  >
                    {config.logoUrl && (
                      <img
                        src={config.logoUrl}
                        alt="Logo"
                        className="h-6 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span className="text-sm font-semibold text-white">
                      {config.companyName || 'SkyHawk'}
                    </span>
                  </div>
                  {/* Preview content */}
                  <div className="p-4">
                    {config.headerText && (
                      <p className="text-xs text-gray-300 mb-2">{config.headerText}</p>
                    )}
                    <div className="h-16 bg-gray-900/50 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-500">Report Content Area</span>
                    </div>
                    {config.footerText && (
                      <p className="text-xs text-gray-500 mt-2 text-center">{config.footerText}</p>
                    )}
                  </div>
                  {/* Preview footer */}
                  <div
                    className="px-4 py-1 text-center"
                    style={{ backgroundColor: config.secondaryColor || '#1e40af' }}
                  >
                    <span className="text-xs text-white/70">
                      {config.customDomain || 'app.skyhawk.io'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
                <button
                  onClick={() => {
                    setShowOrgIdInput(true);
                    setConfig(DEFAULT_CONFIG);
                    setOrgId('');
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
                >
                  Switch Org
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
