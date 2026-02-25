import { useState, useCallback, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import type { BatchJob, BatchItem, BatchAddress, BatchJobStatus } from '../../types/batch';
import {
  parseAddressBlock,
  parseCsvBlock,
  createBatchJob,
  computeBatchStats,
  deduplicateAddresses,
  formatDuration,
  exportBatchResultsCsv,
} from '../../utils/batchProcessor';
import BatchQueue from './BatchQueue';
import BatchStatsPanel from './BatchStatsPanel';

export default function BatchProcessor() {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'paste' | 'csv'>('paste');
  const [job, setJob] = useState<BatchJob | null>(null);
  const [concurrency, setConcurrency] = useState(1);
  const abortRef = useRef(false);
  const processingRef = useRef(false);

  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const handleParse = useCallback(() => {
    if (!inputText.trim()) return;

    const addresses =
      inputMode === 'csv'
        ? parseCsvBlock(inputText)
        : parseAddressBlock(inputText);

    if (addresses.length === 0) return;

    const { unique, duplicateIndices } = deduplicateAddresses(addresses);
    const newJob = createBatchJob(unique, undefined, concurrency);

    if (duplicateIndices.length > 0) {
      newJob.name += ` (${duplicateIndices.length} duplicates removed)`;
    }

    setJob(newJob);
  }, [inputText, inputMode, concurrency]);

  const handleStart = useCallback(async () => {
    if (!job || processingRef.current) return;

    abortRef.current = false;
    processingRef.current = true;

    setJob((prev) => prev ? { ...prev, status: 'running', startedAt: new Date().toISOString() } : prev);

    const items = [...job.items];
    let activeCount = 0;
    let nextIndex = 0;

    const processItem = async (item: BatchItem): Promise<void> => {
      if (abortRef.current) return;

      // Update status to geocoding
      updateItem(item.id, { status: 'geocoding', progress: 10, message: 'Geocoding address...', startedAt: new Date().toISOString() });

      try {
        // Simulate geocoding (in real usage, this calls Google Geocoding API)
        await delay(300);
        if (abortRef.current) return;

        // Simulate measurement processing
        updateItem(item.id, { status: 'measuring', progress: 40, message: 'Running auto-measurement...' });
        await delay(500);
        if (abortRef.current) return;

        updateItem(item.id, { status: 'measuring', progress: 70, message: 'Analyzing roof structure...' });
        await delay(400);
        if (abortRef.current) return;

        // Simulate completion with mock results
        const mockResult = {
          propertyId: `batch-${item.id}`,
          address: item.input.address,
          totalAreaSqFt: 1500 + Math.random() * 3000,
          totalSquares: 15 + Math.random() * 30,
          facetCount: 3 + Math.floor(Math.random() * 8),
          predominantPitch: 4 + Math.floor(Math.random() * 12),
          dataSource: Math.random() > 0.3 ? 'lidar-mask' : 'ai-vision',
          confidence: Math.random() > 0.2 ? 'high' : 'medium',
        };

        updateItem(item.id, {
          status: 'complete',
          progress: 100,
          message: `${mockResult.facetCount} facets, ${mockResult.totalSquares.toFixed(1)} sq`,
          result: mockResult,
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        updateItem(item.id, {
          status: 'error',
          progress: 0,
          message: err instanceof Error ? err.message : 'Processing failed',
          error: err instanceof Error ? err.message : 'Unknown error',
          completedAt: new Date().toISOString(),
        });
      }
    };

    // Process with concurrency limit
    const processNext = async (): Promise<void> => {
      while (nextIndex < items.length && !abortRef.current) {
        const item = items[nextIndex++];
        activeCount++;
        await processItem(item);
        activeCount--;
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => processNext());
    await Promise.all(workers);

    processingRef.current = false;

    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: abortRef.current ? 'cancelled' : 'complete',
        completedAt: new Date().toISOString(),
      };
    });
  }, [job, concurrency]);

  const handlePause = useCallback(() => {
    abortRef.current = true;
    processingRef.current = false;
    setJob((prev) => prev ? { ...prev, status: 'paused' } : prev);
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    processingRef.current = false;
    setJob(null);
    setInputText('');
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!job) return;
    const csv = exportBatchResultsCsv(job);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [job]);

  const updateItem = (itemId: string, updates: Partial<BatchItem>) => {
    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item,
        ),
      };
    });
  };

  const stats = job ? computeBatchStats(job) : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">Dashboard</span>
        </button>
        <div className="h-6 w-px bg-gray-700" />
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-gotruf-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          <h1 className="text-lg font-bold">Batch Processing</h1>
        </div>
        {job && job.status === 'complete' && (
          <div className="ml-auto">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {!job ? (
          /* ─── Input Phase ─── */
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Batch Property Processing</h2>
              <p className="text-gray-400">
                Enter multiple addresses to process them all at once. Paste a list, upload a CSV, or
                type addresses one per line.
              </p>
            </div>

            {/* Input mode tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setInputMode('paste')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  inputMode === 'paste'
                    ? 'bg-gotruf-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Paste Addresses
              </button>
              <button
                onClick={() => setInputMode('csv')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  inputMode === 'csv'
                    ? 'bg-gotruf-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                CSV / Spreadsheet
              </button>
            </div>

            {/* Text area */}
            <div className="mb-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  inputMode === 'paste'
                    ? '123 Main St, Oklahoma City, OK 73102\n456 Elm Ave, Edmond, OK 73013\n789 Oak Dr, Norman, OK 73071'
                    : 'Address,City,State,ZIP\n123 Main St,Oklahoma City,OK,73102\n456 Elm Ave,Edmond,OK,73013'
                }
                className="w-full h-64 bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 font-mono resize-y focus:border-gotruf-500 focus:outline-none focus:ring-1 focus:ring-gotruf-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">
                {inputMode === 'paste'
                  ? 'One address per line. Format: "Street, City, State ZIP"'
                  : 'CSV with header row. Columns: Address, City, State, ZIP'}
              </p>
            </div>

            {/* Concurrency setting */}
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm text-gray-400">Parallel processing:</label>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-gotruf-500 focus:outline-none"
              >
                <option value={1}>1 at a time (safest)</option>
                <option value={2}>2 parallel</option>
                <option value={3}>3 parallel</option>
                <option value={5}>5 parallel (fast)</option>
              </select>
            </div>

            {/* Parse button */}
            <button
              onClick={handleParse}
              disabled={!inputText.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-gotruf-600 hover:bg-gotruf-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Parse Addresses
            </button>
          </div>
        ) : (
          /* ─── Processing Phase ─── */
          <div>
            {/* Job Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{job.name}</h2>
                <p className="text-sm text-gray-400">
                  {job.status === 'idle' && 'Ready to process. Review addresses and click Start.'}
                  {job.status === 'running' && 'Processing properties...'}
                  {job.status === 'paused' && 'Paused. Click Resume to continue.'}
                  {job.status === 'complete' && 'All properties processed.'}
                  {job.status === 'cancelled' && 'Batch processing was cancelled.'}
                </p>
              </div>
              <div className="flex gap-2">
                {(job.status === 'idle' || job.status === 'paused') && (
                  <button
                    onClick={handleStart}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gotruf-600 hover:bg-gotruf-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    {job.status === 'paused' ? 'Resume' : 'Start Processing'}
                  </button>
                )}
                {job.status === 'running' && (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-1.5 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                    </svg>
                    Pause
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Stats */}
            {stats && <BatchStatsPanel stats={stats} jobStatus={job.status} />}

            {/* Queue */}
            <BatchQueue items={job.items} />
          </div>
        )}
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
