import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import {
  generateSampleEvents,
  searchStormEvents,
  assessStormRisk,
  formatEventSummary,
  classifyHailSize,
  STORM_TYPE_LABELS,
  STORM_TYPE_ICONS,
  HAIL_SIZE_LABELS,
  type StormEvent,
  type StormEventType,
  type StormSearchResult,
} from '../../utils/stormEvents';

const RADIUS_OPTIONS = [5, 10, 25, 50];
const DATE_RANGE_OPTIONS: { label: string; months: number }[] = [
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
  { label: '5 years', months: 60 },
];

const FILTER_TYPES: { type: StormEventType; label: string }[] = [
  { type: 'hail', label: 'Hail' },
  { type: 'thunderstorm_wind', label: 'Wind' },
  { type: 'tornado', label: 'Tornado' },
  { type: 'flash_flood', label: 'Flood' },
  { type: 'winter_storm', label: 'Winter' },
];

export default function StormHistoryPanel() {
  const { properties, activePropertyId } = useStore();
  const property = properties.find((p) => p.id === activePropertyId);

  const [radiusMiles, setRadiusMiles] = useState(25);
  const [rangeMonths, setRangeMonths] = useState(24);
  const [selectedTypes, setSelectedTypes] = useState<StormEventType[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const lat = property?.lat ?? 0;
  const lng = property?.lng ?? 0;
  const hasLocation = lat !== 0 || lng !== 0;

  // Generate sample events and search
  const result = useMemo<StormSearchResult | null>(() => {
    if (!hasLocation) return null;

    const allEvents = generateSampleEvents(lat, lng, radiusMiles, 20);

    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - rangeMonths);

    return searchStormEvents(allEvents, {
      lat,
      lng,
      radiusMiles,
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      eventTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    });
  }, [lat, lng, radiusMiles, rangeMonths, selectedTypes, hasLocation]);

  const risk = useMemo(() => {
    if (!result) return null;
    return assessStormRisk(result);
  }, [result]);

  if (!property) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <p>Select a property to view storm history.</p>
      </div>
    );
  }

  if (!hasLocation) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <p>Property location not available.</p>
        <p className="text-xs mt-1">Run a measurement to establish coordinates.</p>
      </div>
    );
  }

  return (
    <div className="p-4 text-gray-200 space-y-4">
      <h2 className="text-lg font-bold text-white">Storm History</h2>
      <p className="text-xs text-gray-500">
        Weather events near {property.address || 'this property'}
      </p>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-500 mb-1">Radius</label>
          <select
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(parseInt(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>{r} miles</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-1">Date Range</label>
          <select
            value={rangeMonths}
            onChange={(e) => setRangeMonths(parseInt(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200"
          >
            {DATE_RANGE_OPTIONS.map((r) => (
              <option key={r.months} value={r.months}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TYPES.map(({ type, label }) => {
          const isActive = selectedTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => {
                setSelectedTypes((prev) =>
                  isActive ? prev.filter((t) => t !== type) : [...prev, type],
                );
              }}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                isActive
                  ? 'bg-gotruf-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          );
        })}
        {selectedTypes.length > 0 && (
          <button
            onClick={() => setSelectedTypes([])}
            className="px-2 py-1 rounded text-[10px] text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      {result && (
        <>
          {/* Risk Assessment */}
          {risk && <RiskBadge risk={risk} />}

          {/* Summaries */}
          <div className="grid grid-cols-2 gap-2">
            {result.hailSummary && (
              <SummaryCard
                title="Hail Events"
                icon="🧊"
                stats={[
                  `${result.hailSummary.eventCount} events`,
                  `Max: ${result.hailSummary.maxSizeInches}" (${HAIL_SIZE_LABELS[result.hailSummary.maxSizeCategory]})`,
                  `Avg: ${result.hailSummary.avgSizeInches}"`,
                ]}
              />
            )}
            {result.windSummary && (
              <SummaryCard
                title="Wind Events"
                icon="💨"
                stats={[
                  `${result.windSummary.eventCount} events`,
                  `Max: ${result.windSummary.maxSpeedMph} mph`,
                  `Avg: ${result.windSummary.avgSpeedMph} mph`,
                ]}
              />
            )}
          </div>

          {/* Event count */}
          <p className="text-xs text-gray-500">
            {result.totalCount} event{result.totalCount !== 1 ? 's' : ''} within {result.searchRadiusMiles} miles
          </p>

          {/* Events list */}
          <div className="space-y-1.5">
            {result.events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                expanded={expandedEventId === event.id}
                onToggle={() => setExpandedEventId(
                  expandedEventId === event.id ? null : event.id,
                )}
              />
            ))}
            {result.events.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-4">
                No storm events found for the selected criteria.
              </p>
            )}
          </div>

          {/* Data source note */}
          <p className="text-[10px] text-gray-600 text-center">
            Sample data shown for demonstration. Production version will pull from NOAA Storm Events Database.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: ReturnType<typeof assessStormRisk> }) {
  const colors: Record<string, string> = {
    low: 'bg-green-900/30 border-green-800/50 text-green-400',
    moderate: 'bg-amber-900/30 border-amber-800/50 text-amber-400',
    high: 'bg-orange-900/30 border-orange-800/50 text-orange-400',
    severe: 'bg-red-900/30 border-red-800/50 text-red-400',
  };

  return (
    <div className={`rounded-lg p-3 border ${colors[risk.level]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold">{risk.label}</span>
        <span className="text-[10px] font-semibold uppercase">{risk.level}</span>
      </div>
      <p className="text-xs opacity-80">{risk.description}</p>
    </div>
  );
}

function SummaryCard({ title, icon, stats }: { title: string; icon: string; stats: string[] }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-semibold text-white">{title}</span>
      </div>
      {stats.map((s, i) => (
        <p key={i} className="text-[10px] text-gray-400">{s}</p>
      ))}
    </div>
  );
}

function EventRow({
  event,
  expanded,
  onToggle,
}: {
  event: StormEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const severityColor = getSeverityColor(event);

  return (
    <div
      className={`bg-gray-800/50 rounded-lg border transition-colors cursor-pointer ${
        expanded ? 'border-gray-600' : 'border-gray-800 hover:border-gray-700'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm">{STORM_TYPE_ICONS[event.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white">
              {STORM_TYPE_LABELS[event.type]}
            </span>
            <span className={`text-[10px] font-semibold ${severityColor}`}>
              {event.hailSizeInches ? `${event.hailSizeInches}"` : ''}
              {event.windSpeedMph ? `${event.windSpeedMph} mph` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span>{new Date(event.date).toLocaleDateString()}</span>
            <span>{event.distanceMiles} mi away</span>
            <span>{event.county} Co.</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-2 border-t border-gray-800 pt-2 space-y-1">
          <p className="text-xs text-gray-300">{event.description}</p>
          {event.hailSizeInches && (
            <p className="text-[10px] text-gray-500">
              Hail size: {event.hailSizeInches}" — {HAIL_SIZE_LABELS[classifyHailSize(event.hailSizeInches)]}
            </p>
          )}
          {event.propertyDamage && (
            <p className="text-[10px] text-gray-500">
              Est. property damage: ${event.propertyDamage.toLocaleString()}
            </p>
          )}
          <p className="text-[10px] text-gray-600">
            Source: {event.source === 'noaa' ? 'NOAA Storm Events Database' : 'Sample data'}
          </p>
        </div>
      )}
    </div>
  );
}

function getSeverityColor(event: StormEvent): string {
  if (event.hailSizeInches) {
    if (event.hailSizeInches >= 1.75) return 'text-red-400';
    if (event.hailSizeInches >= 1.0) return 'text-orange-400';
    if (event.hailSizeInches >= 0.75) return 'text-amber-400';
    return 'text-gray-400';
  }
  if (event.windSpeedMph) {
    if (event.windSpeedMph >= 70) return 'text-red-400';
    if (event.windSpeedMph >= 58) return 'text-orange-400';
    return 'text-amber-400';
  }
  return 'text-gray-400';
}
