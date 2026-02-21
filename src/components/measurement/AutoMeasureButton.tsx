import { useStore } from '../../store/useStore';
import { useAutoMeasure } from '../../hooks/useAutoMeasure';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

export default function AutoMeasureButton() {
  const { progress, detect, reset } = useAutoMeasure();
  const { apiKey } = useGoogleMaps();
  const activePropertyId = useStore((s) => s.activePropertyId);
  const properties = useStore((s) => s.properties);

  const activeProperty = properties.find((p) => p.id === activePropertyId);
  const anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

  const isRunning = progress.status !== 'idle' && progress.status !== 'complete' && progress.status !== 'error';
  const isDisabled = !activeProperty || !apiKey || isRunning;

  const handleClick = async () => {
    if (!activeProperty || !apiKey) return;

    try {
      await detect(activeProperty.lat, activeProperty.lng, apiKey, anthropicApiKey || undefined);
    } catch {
      // Error is handled in progress state
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
          isDisabled
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-skyhawk-600 to-blue-600 hover:from-skyhawk-500 hover:to-blue-500 text-white shadow-lg shadow-skyhawk-900/30'
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {isRunning ? 'Detecting...' : 'Auto Detect Roof'}
      </button>

      {/* Progress bar */}
      {isRunning && (
        <div className="mt-2">
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-skyhawk-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {progress.message}
          </p>
        </div>
      )}

      {/* Completion message */}
      {progress.status === 'complete' && (
        <div className="mt-2 p-2.5 bg-green-900/30 border border-green-700/50 rounded-lg">
          <p className="text-xs text-green-300">{progress.message}</p>
          <p className="text-xs text-green-400/70 mt-1">
            Switch to Select mode to refine vertices and edges.
          </p>
        </div>
      )}

      {/* AI fallback badge */}
      {progress.status === 'ai-fallback' && (
        <div className="mt-2 p-2.5 bg-amber-900/30 border border-amber-700/50 rounded-lg">
          <p className="text-xs text-amber-300">
            AI Estimated - verify measurements
          </p>
        </div>
      )}

      {/* Error state */}
      {progress.status === 'error' && (
        <div className="mt-2 p-2.5 bg-red-900/30 border border-red-700/50 rounded-lg">
          <p className="text-xs text-red-300">{progress.message}</p>
          <button
            onClick={reset}
            className="text-xs text-red-400 hover:text-red-300 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Info text when no property */}
      {!activeProperty && (
        <p className="text-xs text-gray-500 mt-2">
          Search for an address to enable auto-detection.
        </p>
      )}
    </div>
  );
}
