import { useStore } from '../../store/useStore';
import { useAutoMeasure } from '../../hooks/useAutoMeasure';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

const MANUAL_DRAWING_MESSAGE = 'Please use the drawing tools to trace the roof manually.';

export default function AutoMeasureButton() {
  const { progress, detect, reset } = useAutoMeasure();
  const { apiKey } = useGoogleMaps();
  const activePropertyId = useStore((s) => s.activePropertyId);
  const properties = useStore((s) => s.properties);
  const setDrawingMode = useStore((s) => s.setDrawingMode);

  const activeProperty = properties.find((p) => p.id === activePropertyId);

  const isRunning = progress.status !== 'idle' && progress.status !== 'complete' && progress.status !== 'error';
  const isDisabled = !activeProperty || !apiKey || isRunning;

  const isManualDrawingPrompt = progress.status === 'error' && progress.message.includes(MANUAL_DRAWING_MESSAGE);

  const handleClick = async () => {
    if (!activeProperty || !apiKey) return;

    try {
      await detect(activeProperty.lat, activeProperty.lng, apiKey);
    } catch {
      // Error is handled in progress state
    }
  };

  const handleStartDrawing = () => {
    reset();
    setDrawingMode('outline');
  };

  return (
    <div className="mb-4">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
          isDisabled
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-gotruf-600 to-blue-600 hover:from-gotruf-500 hover:to-blue-500 text-white shadow-lg shadow-gotruf-900/30'
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
              className="h-full bg-gradient-to-r from-gotruf-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
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

      {/* Manual drawing prompt (info-style, not error) */}
      {isManualDrawingPrompt && (
        <div className="mt-2 p-2.5 bg-amber-900/30 border border-amber-700/50 rounded-lg">
          <p className="text-xs text-amber-300">
            Auto-detection unavailable for this location. Google Solar API does not have coverage here and our ML system is still in training.
          </p>
          <button
            onClick={handleStartDrawing}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-amber-700/50 hover:bg-amber-700/70 text-amber-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Start Drawing Roof Outline
          </button>
          <button
            onClick={reset}
            className="text-xs text-amber-400/70 hover:text-amber-300 underline mt-1.5 block mx-auto"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Generic error state (non-manual-drawing errors) */}
      {progress.status === 'error' && !isManualDrawingPrompt && (
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
