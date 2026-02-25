import { v4 as uuidv4 } from 'uuid';
import type {
  BatchAddress,
  BatchItem,
  BatchJob,
  BatchStats,
  BatchItemStatus,
  ParsedAddressLine,
} from '../types/batch';

/**
 * Parse a multiline text block of addresses into structured BatchAddress entries.
 * Supports formats:
 *   - "123 Main St, Anytown, OK 73099"
 *   - "123 Main St\tAnytown\tOK\t73099" (TSV / spreadsheet paste)
 *   - Just "123 Main St, Anytown OK" (partial — city/state/zip parsed best-effort)
 */
export function parseAddressBlock(text: string): BatchAddress[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isHeaderRow(l));

  return lines.map((line) => {
    const parsed = parseAddressLine(line);
    return {
      raw: line,
      address: parsed.address,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
    };
  });
}

/**
 * Parse a CSV text block. Expects a header row with address, city, state, zip columns.
 * Column matching is case-insensitive and flexible (e.g. "Street Address", "addr", "city/town").
 */
export function parseCsvBlock(text: string): BatchAddress[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter = headerLine.includes('\t') ? '\t' : ',';
  const headers = splitRow(headerLine, delimiter).map((h) => h.toLowerCase().trim());

  const addressCol = headers.findIndex((h) =>
    /^(address|street|street.?address|addr)$/i.test(h),
  );
  const cityCol = headers.findIndex((h) => /^(city|town|city.?town)$/i.test(h));
  const stateCol = headers.findIndex((h) => /^(state|st|province)$/i.test(h));
  const zipCol = headers.findIndex((h) => /^(zip|zip.?code|postal|postal.?code)$/i.test(h));

  // If no header columns matched, treat all lines (including first) as raw addresses
  if (addressCol === -1) {
    return lines.map((line) => {
      const parsed = parseAddressLine(line);
      return { raw: line, ...parsed };
    });
  }

  return lines.slice(1).map((line) => {
    const cols = splitRow(line, delimiter);
    const address = cols[addressCol]?.trim() || '';
    const city = cityCol >= 0 ? cols[cityCol]?.trim() || '' : '';
    const state = stateCol >= 0 ? cols[stateCol]?.trim() || '' : '';
    const zip = zipCol >= 0 ? cols[zipCol]?.trim() || '' : '';

    return {
      raw: line,
      address,
      city,
      state,
      zip,
    };
  }).filter((a) => a.address.length > 0);
}

/**
 * Parse a single address line in common US formats.
 */
export function parseAddressLine(line: string): ParsedAddressLine {
  // Try TSV first (spreadsheet paste)
  if (line.includes('\t')) {
    const parts = line.split('\t').map((p) => p.trim());
    if (parts.length >= 4) {
      return { address: parts[0], city: parts[1], state: parts[2], zip: parts[3] };
    }
    if (parts.length === 3) {
      return { address: parts[0], city: parts[1], state: parts[2], zip: '' };
    }
  }

  // Try "address, city, state zip" format
  const commaMatch = line.match(
    /^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i,
  );
  if (commaMatch) {
    return {
      address: commaMatch[1].trim(),
      city: commaMatch[2].trim(),
      state: commaMatch[3].toUpperCase(),
      zip: commaMatch[4],
    };
  }

  // Try "address, city, state" (no zip)
  const noZipMatch = line.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})$/i);
  if (noZipMatch) {
    return {
      address: noZipMatch[1].trim(),
      city: noZipMatch[2].trim(),
      state: noZipMatch[3].toUpperCase(),
      zip: '',
    };
  }

  // Try "address, city state zip" (missing comma between city and state)
  const spacedMatch = line.match(
    /^(.+?),\s*(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i,
  );
  if (spacedMatch) {
    return {
      address: spacedMatch[1].trim(),
      city: spacedMatch[2].trim(),
      state: spacedMatch[3].toUpperCase(),
      zip: spacedMatch[4],
    };
  }

  // Fallback: treat entire line as address
  return { address: line, city: '', state: '', zip: '' };
}

/**
 * Detect header rows (CSV or paste) so they can be skipped.
 */
function isHeaderRow(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /^(address|street|#|number|property)/.test(lower) &&
    /(city|state|zip|postal|town)/.test(lower)
  );
}

/**
 * Split a CSV/TSV row respecting quoted fields.
 */
function splitRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Create a new BatchJob from a list of parsed addresses.
 */
export function createBatchJob(
  addresses: BatchAddress[],
  name?: string,
  concurrency = 1,
): BatchJob {
  const id = uuidv4();
  const items: BatchItem[] = addresses.map((addr, index) => ({
    id: uuidv4(),
    index,
    input: addr,
    status: 'queued' as BatchItemStatus,
    progress: 0,
    message: 'Waiting...',
  }));

  return {
    id,
    name: name || `Batch ${new Date().toLocaleDateString()} (${addresses.length} properties)`,
    status: 'idle',
    items,
    createdAt: new Date().toISOString(),
    concurrency,
  };
}

/**
 * Compute aggregate stats from a batch job.
 */
export function computeBatchStats(job: BatchJob): BatchStats {
  const items = job.items;
  const total = items.length;
  const queued = items.filter((i) => i.status === 'queued').length;
  const processing = items.filter((i) => i.status === 'geocoding' || i.status === 'measuring').length;
  const complete = items.filter((i) => i.status === 'complete').length;
  const errors = items.filter((i) => i.status === 'error').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;

  const completedItems = items.filter((i) => i.status === 'complete' && i.result);
  const totalAreaSqFt = completedItems.reduce((sum, i) => sum + (i.result?.totalAreaSqFt || 0), 0);
  const totalSquares = completedItems.reduce((sum, i) => sum + (i.result?.totalSquares || 0), 0);

  // Compute average time per property from completed items
  const completionTimes = completedItems
    .filter((i) => i.startedAt && i.completedAt)
    .map((i) => new Date(i.completedAt!).getTime() - new Date(i.startedAt!).getTime());

  const avgTimePerProperty =
    completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

  const remaining = queued + processing;
  const estimatedTimeRemaining = remaining * avgTimePerProperty;

  return {
    total,
    queued,
    processing,
    complete,
    errors,
    skipped,
    totalAreaSqFt,
    totalSquares,
    avgTimePerProperty,
    estimatedTimeRemaining,
  };
}

/**
 * Deduplicate addresses by normalized street + city + state.
 * Returns the deduplicated list and indices of duplicates.
 */
export function deduplicateAddresses(
  addresses: BatchAddress[],
): { unique: BatchAddress[]; duplicateIndices: number[] } {
  const seen = new Set<string>();
  const unique: BatchAddress[] = [];
  const duplicateIndices: number[] = [];

  for (let i = 0; i < addresses.length; i++) {
    const key = normalizeAddressKey(addresses[i]);
    if (seen.has(key)) {
      duplicateIndices.push(i);
    } else {
      seen.add(key);
      unique.push(addresses[i]);
    }
  }

  return { unique, duplicateIndices };
}

/**
 * Normalize an address for deduplication comparison.
 */
function normalizeAddressKey(addr: BatchAddress): string {
  return [
    addr.address.toLowerCase().replace(/[^a-z0-9]/g, ''),
    addr.city.toLowerCase().replace(/[^a-z0-9]/g, ''),
    addr.state.toLowerCase(),
  ].join('|');
}

/**
 * Format milliseconds into a human-readable time string.
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Export batch results as CSV text.
 */
export function exportBatchResultsCsv(job: BatchJob): string {
  const headers = [
    'Address',
    'City',
    'State',
    'ZIP',
    'Status',
    'Total Area (sq ft)',
    'Squares',
    'Facets',
    'Predominant Pitch',
    'Data Source',
    'Confidence',
    'Error',
  ];

  const rows = job.items.map((item) => [
    csvEscape(item.input.address),
    csvEscape(item.input.city),
    csvEscape(item.input.state),
    item.input.zip,
    item.status,
    item.result?.totalAreaSqFt.toFixed(0) || '',
    item.result?.totalSquares.toFixed(1) || '',
    item.result?.facetCount?.toString() || '',
    item.result ? `${item.result.predominantPitch}/12` : '',
    item.result?.dataSource || '',
    item.result?.confidence || '',
    csvEscape(item.error || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
