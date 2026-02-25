/**
 * Unit tests for batch processing utilities
 * Run with: npx vitest run tests/unit/batchProcessor.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  parseAddressBlock,
  parseCsvBlock,
  parseAddressLine,
  createBatchJob,
  computeBatchStats,
  deduplicateAddresses,
  formatDuration,
  exportBatchResultsCsv,
} from '../../src/utils/batchProcessor';
import type { BatchAddress, BatchJob } from '../../src/types/batch';

// ─── parseAddressLine ────────────────────────────────────────────

describe('parseAddressLine', () => {
  it('parses "address, city, state zip" format', () => {
    const result = parseAddressLine('123 Main St, Oklahoma City, OK 73102');
    expect(result).toEqual({
      address: '123 Main St',
      city: 'Oklahoma City',
      state: 'OK',
      zip: '73102',
    });
  });

  it('parses address with zip+4', () => {
    const result = parseAddressLine('456 Elm Ave, Edmond, OK 73013-1234');
    expect(result).toEqual({
      address: '456 Elm Ave',
      city: 'Edmond',
      state: 'OK',
      zip: '73013-1234',
    });
  });

  it('parses "address, city, state" without zip', () => {
    const result = parseAddressLine('789 Oak Dr, Norman, OK');
    expect(result).toEqual({
      address: '789 Oak Dr',
      city: 'Norman',
      state: 'OK',
      zip: '',
    });
  });

  it('parses "address, city state zip" (missing comma between city and state)', () => {
    const result = parseAddressLine('100 Pine Rd, Moore OK 73160');
    expect(result).toEqual({
      address: '100 Pine Rd',
      city: 'Moore',
      state: 'OK',
      zip: '73160',
    });
  });

  it('parses TSV format (tab-separated)', () => {
    const result = parseAddressLine('200 Cedar Ln\tMustang\tOK\t73064');
    expect(result).toEqual({
      address: '200 Cedar Ln',
      city: 'Mustang',
      state: 'OK',
      zip: '73064',
    });
  });

  it('parses 3-column TSV (no zip)', () => {
    const result = parseAddressLine('300 Birch Ct\tYukon\tOK');
    expect(result).toEqual({
      address: '300 Birch Ct',
      city: 'Yukon',
      state: 'OK',
      zip: '',
    });
  });

  it('treats unstructured text as address-only', () => {
    const result = parseAddressLine('some random text');
    expect(result).toEqual({
      address: 'some random text',
      city: '',
      state: '',
      zip: '',
    });
  });

  it('handles lowercase state codes', () => {
    const result = parseAddressLine('123 Main St, OKC, ok 73102');
    expect(result.state).toBe('OK');
  });
});

// ─── parseAddressBlock ───────────────────────────────────────────

describe('parseAddressBlock', () => {
  it('parses multiple lines of addresses', () => {
    const input = `123 Main St, Oklahoma City, OK 73102
456 Elm Ave, Edmond, OK 73013
789 Oak Dr, Norman, OK 73071`;
    const result = parseAddressBlock(input);
    expect(result).toHaveLength(3);
    expect(result[0].address).toBe('123 Main St');
    expect(result[0].city).toBe('Oklahoma City');
    expect(result[1].address).toBe('456 Elm Ave');
    expect(result[2].zip).toBe('73071');
  });

  it('skips empty lines', () => {
    const input = `123 Main St, OKC, OK 73102

456 Elm Ave, Edmond, OK 73013

`;
    const result = parseAddressBlock(input);
    expect(result).toHaveLength(2);
  });

  it('skips header rows', () => {
    const input = `Address, City, State, ZIP
123 Main St, OKC, OK 73102
456 Elm Ave, Edmond, OK 73013`;
    const result = parseAddressBlock(input);
    expect(result).toHaveLength(2);
    expect(result[0].address).toBe('123 Main St');
  });

  it('handles Windows-style line endings', () => {
    const input = '123 Main St, OKC, OK 73102\r\n456 Elm Ave, Edmond, OK 73013';
    const result = parseAddressBlock(input);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(parseAddressBlock('')).toHaveLength(0);
    expect(parseAddressBlock('   ')).toHaveLength(0);
  });
});

// ─── parseCsvBlock ───────────────────────────────────────────────

describe('parseCsvBlock', () => {
  it('parses standard CSV with header', () => {
    const csv = `Address,City,State,ZIP
123 Main St,Oklahoma City,OK,73102
456 Elm Ave,Edmond,OK,73013`;
    const result = parseCsvBlock(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      raw: '123 Main St,Oklahoma City,OK,73102',
      address: '123 Main St',
      city: 'Oklahoma City',
      state: 'OK',
      zip: '73102',
    });
  });

  it('parses TSV with header', () => {
    const tsv = `Address\tCity\tState\tZIP
123 Main St\tOKC\tOK\t73102
456 Elm Ave\tEdmond\tOK\t73013`;
    const result = parseCsvBlock(tsv);
    expect(result).toHaveLength(2);
    expect(result[0].address).toBe('123 Main St');
  });

  it('handles alternative column names', () => {
    const csv = `Street Address,Town,St,Postal Code
123 Main St,OKC,OK,73102`;
    const result = parseCsvBlock(csv);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('123 Main St');
  });

  it('handles quoted fields with commas', () => {
    const csv = `Address,City,State,ZIP
"123 Main St, Suite 200",Oklahoma City,OK,73102`;
    const result = parseCsvBlock(csv);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('123 Main St, Suite 200');
  });

  it('falls back to line parsing when no header match', () => {
    const input = `123 Main St, OKC, OK 73102
456 Elm Ave, Edmond, OK 73013`;
    const result = parseCsvBlock(input);
    expect(result).toHaveLength(2);
    expect(result[0].address).toBe('123 Main St');
  });

  it('skips rows with empty addresses', () => {
    const csv = `Address,City,State,ZIP
,Oklahoma City,OK,73102
456 Elm Ave,Edmond,OK,73013`;
    const result = parseCsvBlock(csv);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('456 Elm Ave');
  });

  it('returns empty for single-line input', () => {
    expect(parseCsvBlock('hello')).toHaveLength(0);
  });
});

// ─── createBatchJob ──────────────────────────────────────────────

describe('createBatchJob', () => {
  const addresses: BatchAddress[] = [
    { raw: 'a', address: '123 Main St', city: 'OKC', state: 'OK', zip: '73102' },
    { raw: 'b', address: '456 Elm Ave', city: 'Edmond', state: 'OK', zip: '73013' },
  ];

  it('creates a batch job with correct structure', () => {
    const job = createBatchJob(addresses);
    expect(job.id).toBeTruthy();
    expect(job.status).toBe('idle');
    expect(job.items).toHaveLength(2);
    expect(job.concurrency).toBe(1);
    expect(job.createdAt).toBeTruthy();
  });

  it('assigns sequential indices to items', () => {
    const job = createBatchJob(addresses);
    expect(job.items[0].index).toBe(0);
    expect(job.items[1].index).toBe(1);
  });

  it('all items start as queued', () => {
    const job = createBatchJob(addresses);
    for (const item of job.items) {
      expect(item.status).toBe('queued');
      expect(item.progress).toBe(0);
    }
  });

  it('uses custom name', () => {
    const job = createBatchJob(addresses, 'Storm Damage Batch');
    expect(job.name).toBe('Storm Damage Batch');
  });

  it('generates default name with count', () => {
    const job = createBatchJob(addresses);
    expect(job.name).toContain('2 properties');
  });

  it('uses custom concurrency', () => {
    const job = createBatchJob(addresses, undefined, 3);
    expect(job.concurrency).toBe(3);
  });
});

// ─── computeBatchStats ───────────────────────────────────────────

describe('computeBatchStats', () => {
  function makeJob(statuses: Array<{ status: string; area?: number; squares?: number; started?: string; completed?: string }>): BatchJob {
    return {
      id: 'test',
      name: 'Test Batch',
      status: 'running',
      concurrency: 1,
      createdAt: new Date().toISOString(),
      items: statuses.map((s, i) => ({
        id: `item-${i}`,
        index: i,
        input: { raw: '', address: `Addr ${i}`, city: '', state: '', zip: '' },
        status: s.status as any,
        progress: s.status === 'complete' ? 100 : 0,
        message: '',
        startedAt: s.started,
        completedAt: s.completed,
        result: s.status === 'complete'
          ? {
              propertyId: `p-${i}`,
              address: `Addr ${i}`,
              totalAreaSqFt: s.area || 2000,
              totalSquares: s.squares || 20,
              facetCount: 5,
              predominantPitch: 6,
              dataSource: 'lidar-mask',
              confidence: 'high',
            }
          : undefined,
      })),
    };
  }

  it('counts statuses correctly', () => {
    const job = makeJob([
      { status: 'queued' },
      { status: 'geocoding' },
      { status: 'measuring' },
      { status: 'complete', area: 2000, squares: 20 },
      { status: 'error' },
      { status: 'skipped' },
    ]);
    const stats = computeBatchStats(job);
    expect(stats.total).toBe(6);
    expect(stats.queued).toBe(1);
    expect(stats.processing).toBe(2);
    expect(stats.complete).toBe(1);
    expect(stats.errors).toBe(1);
    expect(stats.skipped).toBe(1);
  });

  it('sums area and squares from completed items', () => {
    const job = makeJob([
      { status: 'complete', area: 1500, squares: 15 },
      { status: 'complete', area: 2500, squares: 25 },
      { status: 'queued' },
    ]);
    const stats = computeBatchStats(job);
    expect(stats.totalAreaSqFt).toBe(4000);
    expect(stats.totalSquares).toBe(40);
  });

  it('computes average time per property', () => {
    const now = Date.now();
    const job = makeJob([
      { status: 'complete', started: new Date(now - 3000).toISOString(), completed: new Date(now).toISOString() },
      { status: 'complete', started: new Date(now - 5000).toISOString(), completed: new Date(now).toISOString() },
    ]);
    const stats = computeBatchStats(job);
    expect(stats.avgTimePerProperty).toBe(4000); // (3000 + 5000) / 2
  });

  it('estimates remaining time', () => {
    const now = Date.now();
    const job = makeJob([
      { status: 'complete', started: new Date(now - 2000).toISOString(), completed: new Date(now).toISOString() },
      { status: 'queued' },
      { status: 'queued' },
    ]);
    const stats = computeBatchStats(job);
    expect(stats.estimatedTimeRemaining).toBe(4000); // 2 queued * 2000ms avg
  });

  it('handles empty job', () => {
    const job = makeJob([]);
    const stats = computeBatchStats(job);
    expect(stats.total).toBe(0);
    expect(stats.avgTimePerProperty).toBe(0);
  });
});

// ─── deduplicateAddresses ────────────────────────────────────────

describe('deduplicateAddresses', () => {
  it('removes exact duplicates', () => {
    const addresses: BatchAddress[] = [
      { raw: 'a', address: '123 Main St', city: 'OKC', state: 'OK', zip: '73102' },
      { raw: 'b', address: '123 Main St', city: 'OKC', state: 'OK', zip: '73102' },
      { raw: 'c', address: '456 Elm Ave', city: 'Edmond', state: 'OK', zip: '73013' },
    ];
    const { unique, duplicateIndices } = deduplicateAddresses(addresses);
    expect(unique).toHaveLength(2);
    expect(duplicateIndices).toEqual([1]);
  });

  it('treats case-different addresses as duplicates', () => {
    const addresses: BatchAddress[] = [
      { raw: 'a', address: '123 Main St', city: 'Oklahoma City', state: 'OK', zip: '' },
      { raw: 'b', address: '123 MAIN ST', city: 'OKLAHOMA CITY', state: 'ok', zip: '' },
    ];
    const { unique, duplicateIndices } = deduplicateAddresses(addresses);
    expect(unique).toHaveLength(1);
    expect(duplicateIndices).toEqual([1]);
  });

  it('treats addresses with different punctuation as duplicates', () => {
    const addresses: BatchAddress[] = [
      { raw: 'a', address: '123 Main St.', city: 'OKC', state: 'OK', zip: '' },
      { raw: 'b', address: '123 Main St', city: 'OKC', state: 'OK', zip: '' },
    ];
    const { unique } = deduplicateAddresses(addresses);
    expect(unique).toHaveLength(1);
  });

  it('returns no duplicates when all unique', () => {
    const addresses: BatchAddress[] = [
      { raw: 'a', address: '123 Main St', city: 'OKC', state: 'OK', zip: '' },
      { raw: 'b', address: '456 Elm Ave', city: 'Edmond', state: 'OK', zip: '' },
    ];
    const { unique, duplicateIndices } = deduplicateAddresses(addresses);
    expect(unique).toHaveLength(2);
    expect(duplicateIndices).toHaveLength(0);
  });

  it('handles empty array', () => {
    const { unique, duplicateIndices } = deduplicateAddresses([]);
    expect(unique).toHaveLength(0);
    expect(duplicateIndices).toHaveLength(0);
  });
});

// ─── formatDuration ──────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats zero/negative as dash', () => {
    expect(formatDuration(0)).toBe('—');
    expect(formatDuration(-100)).toBe('—');
  });

  it('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(45000)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(300000)).toBe('5m 0s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3660000)).toBe('1h 1m');
    expect(formatDuration(7200000)).toBe('2h 0m');
  });
});

// ─── exportBatchResultsCsv ───────────────────────────────────────

describe('exportBatchResultsCsv', () => {
  it('generates CSV with headers', () => {
    const job: BatchJob = {
      id: 'test',
      name: 'Test',
      status: 'complete',
      concurrency: 1,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'i1',
          index: 0,
          input: { raw: '', address: '123 Main St', city: 'OKC', state: 'OK', zip: '73102' },
          status: 'complete',
          progress: 100,
          message: 'Done',
          result: {
            propertyId: 'p1',
            address: '123 Main St',
            totalAreaSqFt: 2500,
            totalSquares: 25,
            facetCount: 6,
            predominantPitch: 8,
            dataSource: 'lidar-mask',
            confidence: 'high',
          },
        },
      ],
    };

    const csv = exportBatchResultsCsv(job);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Address');
    expect(lines[0]).toContain('Total Area');
    expect(lines[1]).toContain('123 Main St');
    expect(lines[1]).toContain('2500');
    expect(lines[1]).toContain('25.0');
    expect(lines[1]).toContain('8/12');
  });

  it('handles error items', () => {
    const job: BatchJob = {
      id: 'test',
      name: 'Test',
      status: 'complete',
      concurrency: 1,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'i1',
          index: 0,
          input: { raw: '', address: '999 Bad St', city: '', state: '', zip: '' },
          status: 'error',
          progress: 0,
          message: 'Failed',
          error: 'Geocoding failed',
        },
      ],
    };

    const csv = exportBatchResultsCsv(job);
    expect(csv).toContain('error');
    expect(csv).toContain('Geocoding failed');
  });

  it('escapes commas in fields', () => {
    const job: BatchJob = {
      id: 'test',
      name: 'Test',
      status: 'complete',
      concurrency: 1,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'i1',
          index: 0,
          input: { raw: '', address: '123 Main St, Suite 200', city: 'OKC', state: 'OK', zip: '' },
          status: 'queued',
          progress: 0,
          message: '',
        },
      ],
    };

    const csv = exportBatchResultsCsv(job);
    expect(csv).toContain('"123 Main St, Suite 200"');
  });
});
