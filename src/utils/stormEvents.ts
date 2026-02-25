/**
 * Storm Event Lookup
 *
 * Provides historical severe weather event data for a given location and
 * date range. Used by insurance adjusters to verify hail/wind damage claims
 * and by contractors to identify storm-affected neighborhoods.
 *
 * Data source: NOAA Storm Events Database (CSV endpoint).
 * Fallback: synthetic sample data for offline/demo use.
 */

export type StormEventType =
  | 'hail'
  | 'thunderstorm_wind'
  | 'tornado'
  | 'flash_flood'
  | 'winter_storm'
  | 'ice_storm'
  | 'heavy_rain'
  | 'high_wind'
  | 'other';

export type HailSize = 'small' | 'medium' | 'large' | 'very_large' | 'giant';

export interface StormEvent {
  id: string;
  type: StormEventType;
  date: string; // ISO date
  county: string;
  state: string;
  description: string;
  /** Hail diameter in inches (only for hail events) */
  hailSizeInches?: number;
  /** Wind speed in mph (only for wind events) */
  windSpeedMph?: number;
  /** Distance from property in miles */
  distanceMiles: number;
  /** Property damage (dollar estimate if available) */
  propertyDamage?: number;
  source: 'noaa' | 'sample';
}

export interface StormSearchParams {
  lat: number;
  lng: number;
  radiusMiles: number;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  eventTypes?: StormEventType[];
}

export interface StormSearchResult {
  events: StormEvent[];
  totalCount: number;
  searchRadiusMiles: number;
  dateRange: { start: string; end: string };
  hailSummary: HailSummary | null;
  windSummary: WindSummary | null;
}

export interface HailSummary {
  eventCount: number;
  maxSizeInches: number;
  maxSizeCategory: HailSize;
  avgSizeInches: number;
  mostRecentDate: string;
}

export interface WindSummary {
  eventCount: number;
  maxSpeedMph: number;
  avgSpeedMph: number;
  mostRecentDate: string;
}

// ─── Constants ──────────────────────────────────────────────────

export const STORM_TYPE_LABELS: Record<StormEventType, string> = {
  hail: 'Hail',
  thunderstorm_wind: 'Thunderstorm Wind',
  tornado: 'Tornado',
  flash_flood: 'Flash Flood',
  winter_storm: 'Winter Storm',
  ice_storm: 'Ice Storm',
  heavy_rain: 'Heavy Rain',
  high_wind: 'High Wind',
  other: 'Other',
};

export const STORM_TYPE_ICONS: Record<StormEventType, string> = {
  hail: '🧊',
  thunderstorm_wind: '💨',
  tornado: '🌪️',
  flash_flood: '🌊',
  winter_storm: '❄️',
  ice_storm: '🧊',
  heavy_rain: '🌧️',
  high_wind: '💨',
  other: '⛈️',
};

export const HAIL_SIZE_LABELS: Record<HailSize, string> = {
  small: 'Pea to Marble (< 0.75")',
  medium: 'Penny to Nickel (0.75" - 1.0")',
  large: 'Quarter to Golf Ball (1.0" - 1.75")',
  very_large: 'Hen Egg to Tennis Ball (1.75" - 2.75")',
  giant: 'Baseball+ (> 2.75")',
};

// ─── Utility functions ──────────────────────────────────────────

/**
 * Classify hail size into a category by diameter in inches.
 */
export function classifyHailSize(inches: number): HailSize {
  if (inches >= 2.75) return 'giant';
  if (inches >= 1.75) return 'very_large';
  if (inches >= 1.0) return 'large';
  if (inches >= 0.75) return 'medium';
  return 'small';
}

/**
 * Haversine distance between two lat/lng points in miles.
 */
export function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filter events within a given radius from a center point.
 */
export function filterByRadius(
  events: StormEvent[],
  lat: number,
  lng: number,
  radiusMiles: number,
): StormEvent[] {
  return events.filter((e) => e.distanceMiles <= radiusMiles);
}

/**
 * Filter events by type.
 */
export function filterByType(
  events: StormEvent[],
  types: StormEventType[],
): StormEvent[] {
  if (types.length === 0) return events;
  return events.filter((e) => types.includes(e.type));
}

/**
 * Filter events within a date range (inclusive).
 */
export function filterByDateRange(
  events: StormEvent[],
  startDate: string,
  endDate: string,
): StormEvent[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return events.filter((e) => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

/**
 * Sort events by date (most recent first).
 */
export function sortEventsByDate(events: StormEvent[]): StormEvent[] {
  return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Sort events by distance (closest first).
 */
export function sortEventsByDistance(events: StormEvent[]): StormEvent[] {
  return [...events].sort((a, b) => a.distanceMiles - b.distanceMiles);
}

/**
 * Build a hail summary from events.
 */
export function buildHailSummary(events: StormEvent[]): HailSummary | null {
  const hailEvents = events.filter((e) => e.type === 'hail' && e.hailSizeInches);
  if (hailEvents.length === 0) return null;

  const sizes = hailEvents.map((e) => e.hailSizeInches!);
  const maxSize = Math.max(...sizes);
  const avgSize = sizes.reduce((sum, s) => sum + s, 0) / sizes.length;
  const sorted = sortEventsByDate(hailEvents);

  return {
    eventCount: hailEvents.length,
    maxSizeInches: maxSize,
    maxSizeCategory: classifyHailSize(maxSize),
    avgSizeInches: Math.round(avgSize * 100) / 100,
    mostRecentDate: sorted[0].date,
  };
}

/**
 * Build a wind summary from events.
 */
export function buildWindSummary(events: StormEvent[]): WindSummary | null {
  const windEvents = events.filter(
    (e) => (e.type === 'thunderstorm_wind' || e.type === 'high_wind' || e.type === 'tornado') && e.windSpeedMph,
  );
  if (windEvents.length === 0) return null;

  const speeds = windEvents.map((e) => e.windSpeedMph!);
  const maxSpeed = Math.max(...speeds);
  const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
  const sorted = sortEventsByDate(windEvents);

  return {
    eventCount: windEvents.length,
    maxSpeedMph: maxSpeed,
    avgSpeedMph: Math.round(avgSpeed),
    mostRecentDate: sorted[0].date,
  };
}

/**
 * Execute a full storm search with filtering and summaries.
 */
export function searchStormEvents(
  allEvents: StormEvent[],
  params: StormSearchParams,
): StormSearchResult {
  let filtered = filterByRadius(allEvents, params.lat, params.lng, params.radiusMiles);
  filtered = filterByDateRange(filtered, params.startDate, params.endDate);
  if (params.eventTypes && params.eventTypes.length > 0) {
    filtered = filterByType(filtered, params.eventTypes);
  }
  filtered = sortEventsByDate(filtered);

  return {
    events: filtered,
    totalCount: filtered.length,
    searchRadiusMiles: params.radiusMiles,
    dateRange: { start: params.startDate, end: params.endDate },
    hailSummary: buildHailSummary(filtered),
    windSummary: buildWindSummary(filtered),
  };
}

/**
 * Generate sample storm events for a location (demo/offline fallback).
 * Creates realistic events within the specified radius and date range.
 */
export function generateSampleEvents(
  lat: number,
  lng: number,
  radiusMiles: number,
  count: number = 12,
): StormEvent[] {
  const events: StormEvent[] = [];
  const now = new Date();

  const eventTemplates: Array<{
    type: StormEventType;
    desc: string;
    hail?: number;
    wind?: number;
    damage?: number;
  }> = [
    { type: 'hail', desc: 'Hail ranging from quarter to golf ball size reported', hail: 1.5, damage: 5000 },
    { type: 'hail', desc: 'Penny-sized hail for 10 minutes', hail: 0.75, damage: 1000 },
    { type: 'hail', desc: 'Large hail up to 2 inches in diameter', hail: 2.0, damage: 15000 },
    { type: 'hail', desc: 'Pea-sized hail with heavy rain', hail: 0.5 },
    { type: 'thunderstorm_wind', desc: 'Straight-line winds caused tree damage', wind: 65, damage: 8000 },
    { type: 'thunderstorm_wind', desc: 'Measured wind gust at airport', wind: 58 },
    { type: 'thunderstorm_wind', desc: 'Power lines downed by severe gusts', wind: 72, damage: 12000 },
    { type: 'high_wind', desc: 'Sustained high winds with gusts', wind: 50 },
    { type: 'tornado', desc: 'EF1 tornado touched down briefly', wind: 100, damage: 50000 },
    { type: 'flash_flood', desc: 'Flash flooding on local roads', damage: 3000 },
    { type: 'winter_storm', desc: 'Heavy snow with ice accumulation', damage: 2000 },
    { type: 'heavy_rain', desc: 'Over 3 inches of rain in 2 hours' },
  ];

  for (let i = 0; i < count; i++) {
    const template = eventTemplates[i % eventTemplates.length];
    const daysAgo = Math.floor(30 + Math.random() * 700); // 1-24 months ago
    const date = new Date(now.getTime() - daysAgo * 86400000);
    const distance = Math.round((Math.random() * radiusMiles) * 10) / 10;

    // Generate a realistic county name
    const counties = ['Oklahoma', 'Canadian', 'Cleveland', 'Logan', 'Grady', 'Kingfisher', 'Caddo', 'Washita'];
    const county = counties[i % counties.length];

    events.push({
      id: `sample-${i + 1}`,
      type: template.type,
      date: date.toISOString().split('T')[0],
      county,
      state: 'OK',
      description: template.desc,
      hailSizeInches: template.hail,
      windSpeedMph: template.wind,
      distanceMiles: distance,
      propertyDamage: template.damage,
      source: 'sample',
    });
  }

  return sortEventsByDate(events);
}

/**
 * Format a storm event for a brief display.
 */
export function formatEventSummary(event: StormEvent): string {
  const parts: string[] = [STORM_TYPE_LABELS[event.type]];
  if (event.hailSizeInches) {
    parts.push(`${event.hailSizeInches}" hail`);
  }
  if (event.windSpeedMph) {
    parts.push(`${event.windSpeedMph} mph wind`);
  }
  parts.push(`${event.distanceMiles} mi away`);
  return parts.join(' — ');
}

/**
 * Determine the overall storm risk level for a location based on event history.
 */
export type RiskLevel = 'low' | 'moderate' | 'high' | 'severe';

export function assessStormRisk(result: StormSearchResult): {
  level: RiskLevel;
  label: string;
  description: string;
} {
  const { hailSummary, windSummary, totalCount } = result;

  // Severe: large hail + many events
  if (hailSummary && hailSummary.maxSizeInches >= 1.75 && totalCount >= 5) {
    return {
      level: 'severe',
      label: 'Severe Storm Activity',
      description: `${totalCount} events including ${hailSummary.maxSizeInches}" hail — high likelihood of roof damage`,
    };
  }

  // High: significant hail or high winds
  if (
    (hailSummary && hailSummary.maxSizeInches >= 1.0) ||
    (windSummary && windSummary.maxSpeedMph >= 70)
  ) {
    return {
      level: 'high',
      label: 'High Storm Activity',
      description: `Significant weather events detected — roof inspection recommended`,
    };
  }

  // Moderate: some hail or moderate winds
  if (totalCount >= 3 || (windSummary && windSummary.maxSpeedMph >= 50)) {
    return {
      level: 'moderate',
      label: 'Moderate Storm Activity',
      description: `${totalCount} weather events in the area — monitor for damage`,
    };
  }

  // Low
  return {
    level: 'low',
    label: 'Low Storm Activity',
    description: totalCount > 0
      ? `${totalCount} minor weather event(s) — minimal damage risk`
      : 'No significant storm events recorded in this area',
  };
}
