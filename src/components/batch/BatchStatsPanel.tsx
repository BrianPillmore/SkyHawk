import type { BatchStats, BatchJobStatus } from '../../types/batch';
import { formatDuration } from '../../utils/batchProcessor';

interface BatchStatsPanelProps {
  stats: BatchStats;
  jobStatus: BatchJobStatus;
}

export default function BatchStatsPanel({ stats, jobStatus }: BatchStatsPanelProps) {
  const progressPercent = stats.total > 0
    ? Math.round(((stats.complete + stats.errors + stats.skipped) / stats.total) * 100)
    : 0;

  return (
    <div className="mb-6">
      {/* Progress bar */}
      {(jobStatus === 'running' || jobStatus === 'complete') && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">
              {stats.complete + stats.errors + stats.skipped} / {stats.total} properties
            </span>
            <span className="text-sm font-medium text-white">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gotruf-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {jobStatus === 'running' && stats.estimatedTimeRemaining > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              ~{formatDuration(stats.estimatedTimeRemaining)} remaining
            </p>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MiniStat label="Total" value={stats.total} color="text-white" />
        <MiniStat label="Complete" value={stats.complete} color="text-green-400" />
        <MiniStat label="Errors" value={stats.errors} color="text-red-400" />
        <MiniStat label="Queued" value={stats.queued} color="text-gray-400" />
        <MiniStat
          label="Total Area"
          value={stats.totalAreaSqFt > 0 ? `${(stats.totalAreaSqFt / 1000).toFixed(1)}k sf` : '—'}
          color="text-blue-400"
        />
        <MiniStat
          label="Total Squares"
          value={stats.totalSquares > 0 ? stats.totalSquares.toFixed(0) : '—'}
          color="text-purple-400"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
