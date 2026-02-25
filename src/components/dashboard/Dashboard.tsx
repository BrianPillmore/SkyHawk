import { useStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import { formatArea, formatNumber } from '../../utils/geometry';

export default function Dashboard({ onAddProperty }: { onAddProperty?: () => void }) {
  const { properties, setActiveProperty, deleteProperty, reportCredits } = useStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 via-gotruf-950 to-gray-900 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-10 h-10 text-gotruf-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2zm0 2.84L19 12h-1.5v7.5h-3V13.5h-5v5.5h-3V12H5L12 4.84z" />
            </svg>
            <h1 className="text-3xl font-bold">
              Got<span className="text-gotruf-500">Ruf</span>
            </h1>
          </div>
          <p className="text-lg text-gray-400 mb-2">
            Aerial Property Intelligence Platform
          </p>
          <p className="text-sm text-gray-500 max-w-2xl">
            Professional-grade roof measurement, analysis, and reporting for roofing contractors,
            insurance adjusters, and property professionals. Powered by satellite imagery and
            precision measurement tools.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Properties" value={String(properties.length)} icon="🏠" />
          <StatCard
            label="Total Reports"
            value={String(properties.reduce((sum, p) => sum + p.measurements.length, 0))}
            icon="📊"
          />
          <StatCard
            label="Total Area Measured"
            value={formatArea(
              properties.reduce(
                (sum, p) =>
                  sum + p.measurements.reduce((ms, m) => ms + m.totalTrueAreaSqFt, 0),
                0
              )
            )}
            icon="📐"
          />
          <StatCard label="Report Credits" value={String(reportCredits)} icon="🎟️" />
        </div>

        {/* Properties List */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Properties</h2>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/batch')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
                Batch Process
              </button>
              {onAddProperty && (
                <button
                  onClick={onAddProperty}
                  className="flex items-center gap-2 px-4 py-2 bg-gotruf-600 hover:bg-gotruf-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Property
                </button>
              )}
            </div>
          </div>

          {properties.length === 0 ? (
            <div
              className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center cursor-pointer hover:border-gotruf-600/50 transition-colors"
              onClick={onAddProperty}
            >
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-gotruf-900/30">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-400 mb-2">No Properties Yet</h3>
              <p className="text-sm text-gray-500 mb-6">
                Click here or search for an address above to start measuring your first property.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((property) => {
                const latestMeasurement = property.measurements[property.measurements.length - 1];
                return (
                  <div
                    key={property.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors cursor-pointer group"
                    onClick={() => setActiveProperty(property.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-white group-hover:text-gotruf-400 transition-colors">
                          {property.address}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {property.city}, {property.state} {property.zip}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProperty(property.id);
                        }}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {latestMeasurement ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-800/50 rounded px-2 py-1.5">
                          <span className="text-gray-500">Area: </span>
                          <span className="text-gray-300">{formatArea(latestMeasurement.totalTrueAreaSqFt)}</span>
                        </div>
                        <div className="bg-gray-800/50 rounded px-2 py-1.5">
                          <span className="text-gray-500">Squares: </span>
                          <span className="text-gray-300">{formatNumber(latestMeasurement.totalSquares, 1)}</span>
                        </div>
                        <div className="bg-gray-800/50 rounded px-2 py-1.5">
                          <span className="text-gray-500">Facets: </span>
                          <span className="text-gray-300">{latestMeasurement.facets.length}</span>
                        </div>
                        <div className="bg-gray-800/50 rounded px-2 py-1.5">
                          <span className="text-gray-500">Pitch: </span>
                          <span className="text-gray-300">{latestMeasurement.predominantPitch}/12</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600">No measurements yet</p>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                      <span className="text-[10px] text-gray-600">
                        {property.measurements.length} measurement{property.measurements.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {new Date(property.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="border-t border-gray-800 pt-8">
          <h2 className="text-xl font-bold mb-6">Platform Capabilities</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FeatureCard
              title="Roof Measurement"
              description="Precise area, pitch, ridge, hip, valley, rake, and eave measurements"
              icon="📐"
              status="active"
            />
            <FeatureCard
              title="PDF Reports"
              description="Professional reports with measurements, waste factors, and material estimates"
              icon="📄"
              status="active"
            />
            <FeatureCard
              title="Satellite Imagery"
              description="High-resolution satellite imagery via Google Maps integration"
              icon="🛰️"
              status="active"
            />
            <FeatureCard
              title="3D Visualization"
              description="Interactive 3D roof models with rotation and inspection"
              icon="🏗️"
              status="planned"
            />
            <FeatureCard
              title="Insurance Claims"
              description="Claims workflow with damage assessment and Xactimate export"
              icon="🛡️"
              status="planned"
            />
            <FeatureCard
              title="AI Detection"
              description="Automatic roof outline and damage detection from imagery"
              icon="🤖"
              status="planned"
            />
            <FeatureCard
              title="Solar Analysis"
              description="Solar panel placement, shading analysis, and energy estimates"
              icon="☀️"
              status="planned"
            />
            <FeatureCard
              title="Drone Integration"
              description="Drone flight planning, imagery upload, and processing"
              icon="🚁"
              status="planned"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
  status,
}: {
  title: string;
  description: string;
  icon: string;
  status: 'active' | 'planned';
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            status === 'active'
              ? 'bg-green-900/50 text-green-400 border border-green-800/50'
              : 'bg-gray-800 text-gray-500 border border-gray-700/50'
          }`}
        >
          {status === 'active' ? 'Active' : 'Planned'}
        </span>
      </div>
      <h3 className="text-sm font-medium text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
