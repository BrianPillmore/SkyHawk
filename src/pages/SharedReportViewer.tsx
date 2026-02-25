import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchSharedReport,
  SharedReportError,
  type SharedReportData,
  type SharedReportMeasurement,
  type SharedReportDamage,
} from '../services/sharedReportApi';

export default function SharedReportViewer() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setError({ status: 400, message: 'Invalid share link.' });
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const result = await fetchSharedReport(token!);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof SharedReportError) {
            setError({ status: err.status, message: err.message });
          } else {
            setError({ status: 0, message: 'Unable to connect. Please try again later.' });
          }
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onGoHome={() => navigate('/')} />;
  }

  if (!data) {
    return <ErrorState error={{ status: 0, message: 'No data available.' }} onGoHome={() => navigate('/')} />;
  }

  const { share, property, measurements, damageAnnotations } = data;
  const latestMeasurement = measurements[0] || null;
  const fullAddress = [property.address, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7 text-gotruf-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2zm0 2.84L19 12h-1.5v7.5h-3V13.5h-5v5.5h-3V12H5L12 4.84z" />
            </svg>
            <span className="text-lg font-bold text-white tracking-tight">
              Got<span className="text-gotruf-500">Ruf</span>
            </span>
          </div>
          <ShareBadge share={share} />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Property Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h1 className="text-xl font-bold text-white mb-1">{property.address}</h1>
          <p className="text-sm text-gray-400">{fullAddress}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span>Shared by <strong className="text-gray-300">{share.sharedByUsername}</strong></span>
            <span>on {new Date(share.createdAt).toLocaleDateString()}</span>
            {share.expiresAt && (
              <span className="text-amber-500">
                Expires {new Date(share.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Satellite Map Preview */}
        {property.lat && property.lng && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="h-64 bg-gray-800 relative">
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${property.lat},${property.lng}&zoom=19&size=800x300&maptype=satellite&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`}
                alt={`Satellite view of ${property.address}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/90 to-transparent h-16" />
            </div>
          </div>
        )}

        {/* Measurement Summary */}
        {latestMeasurement ? (
          <MeasurementSection measurement={latestMeasurement} />
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-500">No measurements available for this property.</p>
          </div>
        )}

        {/* Damage Annotations */}
        {damageAnnotations.length > 0 && (
          <DamageSection annotations={damageAnnotations} />
        )}

        {/* CTA */}
        <div className="bg-gradient-to-br from-gotruf-900/40 to-gray-900 border border-gotruf-700/30 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400 mb-2">Want your own property reports?</p>
          <p className="text-lg font-bold text-white mb-4">
            Get your first report <span className="text-gotruf-400">free</span>
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="px-6 py-2.5 bg-gotruf-600 hover:bg-gotruf-700 text-white font-medium rounded-lg transition-colors"
          >
            Sign Up Free
          </button>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-600 py-4">
          <p>Powered by GotRuf.com — Aerial Property Intelligence</p>
          <p className="mt-1">Measurements powered by Google Solar API + AI Vision</p>
        </footer>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function ShareBadge({ share }: { share: SharedReportData['share'] }) {
  const colors: Record<string, string> = {
    view: 'bg-gray-700 text-gray-300',
    comment: 'bg-blue-900/50 text-blue-400',
    edit: 'bg-amber-900/50 text-amber-400',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[share.permissions] || colors.view}`}>
      {share.permissions === 'view' ? 'View Only' : share.permissions === 'comment' ? 'Can Comment' : 'Can Edit'}
    </span>
  );
}

function MeasurementSection({ measurement }: { measurement: SharedReportMeasurement }) {
  const stats = [
    { label: 'Total Area', value: `${Math.round(measurement.total_area_sqft).toLocaleString()} sf`, sub: 'Plan/flat area' },
    { label: 'True Area', value: `${Math.round(measurement.total_true_area_sqft).toLocaleString()} sf`, sub: 'Pitch-adjusted' },
    { label: 'Squares', value: measurement.total_squares.toFixed(1), sub: '1 sq = 100 sf' },
    { label: 'Predominant Pitch', value: `${measurement.predominant_pitch}/12`, sub: pitchToAngle(measurement.predominant_pitch) },
    { label: 'Suggested Waste', value: `${measurement.suggested_waste_percent}%`, sub: complexityLabel(measurement.structure_complexity) },
    { label: 'Data Source', value: sourceLabel(measurement.data_source), sub: 'Measurement method' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Roof Measurements</h2>
        <span className="text-xs text-gray-500">
          Measured {new Date(measurement.created_at).toLocaleDateString()}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-800/50 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
            <p className="text-lg font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-gray-600">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DamageSection({ annotations }: { annotations: SharedReportDamage[] }) {
  const severityColors: Record<string, string> = {
    low: 'text-green-400 bg-green-900/30 border-green-800/50',
    medium: 'text-amber-400 bg-amber-900/30 border-amber-800/50',
    high: 'text-red-400 bg-red-900/30 border-red-800/50',
    critical: 'text-red-300 bg-red-900/50 border-red-700/50',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-white mb-4">
        Damage Annotations ({annotations.length})
      </h2>
      <div className="space-y-2">
        {annotations.map((d) => (
          <div
            key={d.id}
            className={`rounded-lg px-4 py-3 border ${severityColors[d.severity] || severityColors.medium}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium capitalize">{d.type.replace(/_/g, ' ')}</span>
              <span className="text-xs font-semibold uppercase">{d.severity}</span>
            </div>
            {d.note && <p className="text-xs opacity-80">{d.note}</p>}
            <p className="text-[10px] opacity-60 mt-1">
              Reported {new Date(d.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-gotruf-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading shared report...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, onGoHome }: { error: { status: number; message: string }; onGoHome: () => void }) {
  const icons: Record<number, string> = { 404: '🔗', 410: '⏰', 400: '⚠️' };
  const icon = icons[error.status] || '❌';

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <p className="text-5xl mb-4">{icon}</p>
        <h1 className="text-xl font-bold text-white mb-2">
          {error.status === 404 ? 'Report Not Found' :
           error.status === 410 ? 'Link Expired' :
           'Something Went Wrong'}
        </h1>
        <p className="text-sm text-gray-400 mb-6">{error.message}</p>
        <button
          onClick={onGoHome}
          className="px-5 py-2 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Go to GotRuf.com
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function pitchToAngle(pitch: number): string {
  const degrees = Math.round(Math.atan(pitch / 12) * 180 / Math.PI);
  return `${degrees}° slope`;
}

function complexityLabel(complexity: string): string {
  const labels: Record<string, string> = {
    Simple: 'Simple roof',
    Normal: 'Standard complexity',
    Complex: 'Complex roof',
  };
  return labels[complexity] || complexity || 'Standard';
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    'solar-api': 'Solar API',
    'lidar': 'LIDAR',
    'ai-vision': 'AI Vision',
    'manual': 'Manual',
    'hybrid': 'Hybrid',
  };
  return labels[source] || source || 'Auto';
}
