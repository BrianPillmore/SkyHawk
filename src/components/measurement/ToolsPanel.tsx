import { useStore } from '../../store/useStore';
import type { DrawingMode } from '../../types';
import { EDGE_COLORS, EDGE_LABELS } from '../../utils/colors';
import AutoMeasureButton from './AutoMeasureButton';

const TOOLS: { mode: DrawingMode; label: string; icon: string; description: string; color?: string }[] = [
  { mode: 'pan', label: 'Pan/Navigate', icon: '🖐️', description: 'Pan and navigate the map' },
  { mode: 'select', label: 'Select', icon: '👆', description: 'Select and edit vertices, edges, facets' },
  { mode: 'outline', label: 'Roof Outline', icon: '⬡', description: 'Draw roof outline polygon', color: '#f59e0b' },
  { mode: 'ridge', label: EDGE_LABELS.ridge, icon: '━', description: 'Draw ridge lines', color: EDGE_COLORS.ridge },
  { mode: 'hip', label: EDGE_LABELS.hip, icon: '╲', description: 'Draw hip lines', color: EDGE_COLORS.hip },
  { mode: 'valley', label: EDGE_LABELS.valley, icon: '╱', description: 'Draw valley lines', color: EDGE_COLORS.valley },
  { mode: 'rake', label: EDGE_LABELS.rake, icon: '│', description: 'Draw rake/gable edges', color: EDGE_COLORS.rake },
  { mode: 'eave', label: EDGE_LABELS.eave, icon: '─', description: 'Draw eave edges', color: EDGE_COLORS.eave },
  { mode: 'flashing', label: EDGE_LABELS.flashing, icon: '┄', description: 'Draw flashing lines', color: EDGE_COLORS.flashing },
];

export default function ToolsPanel() {
  const { drawingMode, setDrawingMode, clearAll, isDrawingOutline, finishOutline, cancelOutline } = useStore();

  return (
    <div className="p-3">
      {/* Auto Detect */}
      <AutoMeasureButton />

      <div className="mb-4 border-t border-gray-800" />

      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Manual Drawing Tools
      </h3>

      <div className="space-y-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.mode}
            onClick={() => setDrawingMode(tool.mode)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              drawingMode === tool.mode
                ? 'bg-skyhawk-900/50 text-skyhawk-300 ring-1 ring-skyhawk-700'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
            title={tool.description}
          >
            <span className="w-6 text-center text-base">{tool.icon}</span>
            <span className="flex-1 text-left">{tool.label}</span>
            {tool.color && (
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tool.color }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Outline drawing controls */}
      {isDrawingOutline && (
        <div className="mt-4 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
          <p className="text-xs text-amber-300 mb-2">
            Click on the map to place roof outline points. Click the first point or press Finish to close the polygon.
          </p>
          <div className="flex gap-2">
            <button
              onClick={finishOutline}
              className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors"
            >
              Finish Outline
            </button>
            <button
              onClick={cancelOutline}
              className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edge drawing hint */}
      {['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing'].includes(drawingMode) && (
        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
          <p className="text-xs text-blue-300">
            Click on a vertex to start a line, then click another vertex to complete the {drawingMode} line.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 pt-4 border-t border-gray-800">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Actions
        </h3>
        <div className="space-y-2">
          <button
            onClick={clearAll}
            className="w-full px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded-lg transition-colors border border-red-900/50"
          >
            Clear All Measurements
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="mt-6 pt-4 border-t border-gray-800">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Shortcuts
        </h3>
        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Pan</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Space</kbd>
          </div>
          <div className="flex justify-between">
            <span>Select</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">V</kbd>
          </div>
          <div className="flex justify-between">
            <span>Outline</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">O</kbd>
          </div>
          <div className="flex justify-between">
            <span>Ridge</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">R</kbd>
          </div>
          <div className="flex justify-between">
            <span>Delete</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Del</kbd>
          </div>
          <div className="flex justify-between">
            <span>Finish outline</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Enter</kbd>
          </div>
          <div className="flex justify-between">
            <span>Cancel</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Esc</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
