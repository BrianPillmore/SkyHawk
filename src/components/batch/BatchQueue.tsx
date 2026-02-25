import type { BatchItem } from '../../types/batch';
import { BATCH_STATUS_COLORS, BATCH_STATUS_LABELS } from '../../types/batch';

interface BatchQueueProps {
  items: BatchItem[];
}

export default function BatchQueue({ items }: BatchQueueProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Property Queue</h3>
        <span className="text-xs text-gray-500">{items.length} properties</span>
      </div>

      <div className="divide-y divide-gray-800/50 max-h-[600px] overflow-y-auto">
        {items.map((item) => (
          <BatchQueueItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function BatchQueueItem({ item }: { item: BatchItem }) {
  const isActive = item.status === 'geocoding' || item.status === 'measuring';
  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';

  return (
    <div
      className={`px-4 py-3 flex items-center gap-3 ${
        isActive ? 'bg-gray-800/30' : ''
      }`}
    >
      {/* Index */}
      <span className="text-xs text-gray-600 w-6 text-right shrink-0">
        {item.index + 1}
      </span>

      {/* Status indicator */}
      <div className="shrink-0">
        {isActive ? (
          <div className="w-5 h-5 border-2 border-gotruf-500 border-t-transparent rounded-full animate-spin" />
        ) : isComplete ? (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : isError ? (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-gray-700" />
        )}
      </div>

      {/* Address */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">
          {item.input.address}
          {item.input.city && (
            <span className="text-gray-500">
              , {item.input.city}
              {item.input.state && `, ${item.input.state}`}
              {item.input.zip && ` ${item.input.zip}`}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate">{item.message}</div>
      </div>

      {/* Progress / Result */}
      <div className="shrink-0 text-right">
        {isActive && (
          <div className="w-20">
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gotruf-500 rounded-full transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        )}
        {isComplete && item.result && (
          <div className="text-xs">
            <span className="text-green-400 font-medium">
              {item.result.totalSquares.toFixed(1)} sq
            </span>
            <span className="text-gray-600 ml-1">
              {item.result.facetCount}f
            </span>
          </div>
        )}
        {isError && (
          <span className="text-xs text-red-400">Failed</span>
        )}
        {item.status === 'queued' && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${BATCH_STATUS_COLORS[item.status]}20`,
              color: BATCH_STATUS_COLORS[item.status],
            }}
          >
            {BATCH_STATUS_LABELS[item.status]}
          </span>
        )}
      </div>
    </div>
  );
}
