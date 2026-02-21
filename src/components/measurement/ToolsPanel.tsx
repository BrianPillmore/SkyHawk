import { useStore } from '../../store/useStore';
import type { DrawingMode, DamageType, DamageSeverity } from '../../types';
import { EDGE_COLORS, EDGE_LABELS } from '../../utils/colors';
import { DAMAGE_TYPE_LABELS, DAMAGE_SEVERITY_COLORS } from '../../types';
import AutoMeasureButton from './AutoMeasureButton';

const TOOLS: { mode: DrawingMode; label: string; icon: string; description: string; color?: string }[] = [
  { mode: 'pan', label: 'Pan/Navigate', icon: '\u{1F590}\uFE0F', description: 'Pan and navigate the map' },
  { mode: 'select', label: 'Select', icon: '\u{1F446}', description: 'Select and edit vertices, edges, facets' },
  { mode: 'outline', label: 'Roof Outline', icon: '\u2B21', description: 'Draw roof outline polygon', color: '#f59e0b' },
  { mode: 'ridge', label: EDGE_LABELS.ridge, icon: '\u2501', description: 'Draw ridge lines', color: EDGE_COLORS.ridge },
  { mode: 'hip', label: EDGE_LABELS.hip, icon: '\u2572', description: 'Draw hip lines', color: EDGE_COLORS.hip },
  { mode: 'valley', label: EDGE_LABELS.valley, icon: '\u2571', description: 'Draw valley lines', color: EDGE_COLORS.valley },
  { mode: 'rake', label: EDGE_LABELS.rake, icon: '\u2502', description: 'Draw rake/gable edges', color: EDGE_COLORS.rake },
  { mode: 'eave', label: EDGE_LABELS.eave, icon: '\u2500', description: 'Draw eave edges', color: EDGE_COLORS.eave },
  { mode: 'flashing', label: EDGE_LABELS.flashing, icon: '\u2504', description: 'Draw flashing lines', color: EDGE_COLORS.flashing },
  { mode: 'damage', label: 'Damage Marker', icon: '\u26A0', description: 'Place damage assessment markers', color: '#ef4444' },
];

export default function ToolsPanel() {
  const {
    drawingMode, setDrawingMode, clearAll,
    isDrawingOutline, finishOutline, cancelOutline,
    undo, redo, _undoStack, _redoStack,
    activeDamageType, activeDamageSeverity,
    setActiveDamageType, setActiveDamageSeverity,
  } = useStore();

  const canUndo = _undoStack.length > 0;
  const canRedo = _redoStack.length > 0;

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

      {/* Damage mode config */}
      {drawingMode === 'damage' && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg space-y-3">
          <p className="text-xs text-red-300 mb-2">
            Click on the map to place damage markers. Configure the type and severity below.
          </p>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Damage Type</label>
            <select
              value={activeDamageType}
              onChange={(e) => setActiveDamageType(e.target.value as DamageType)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {(Object.entries(DAMAGE_TYPE_LABELS) as [DamageType, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Severity</label>
            <div className="flex gap-1">
              {(['minor', 'moderate', 'severe'] as DamageSeverity[]).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setActiveDamageSeverity(sev)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors border ${
                    activeDamageSeverity === sev
                      ? 'border-white/40 text-white font-medium'
                      : 'border-gray-700 text-gray-400 hover:text-gray-300'
                  }`}
                  style={{
                    backgroundColor: activeDamageSeverity === sev
                      ? DAMAGE_SEVERITY_COLORS[sev] + '33'
                      : 'transparent',
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: DAMAGE_SEVERITY_COLORS[sev] }}
                  />
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 pt-4 border-t border-gray-800">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Actions
        </h3>
        <div className="space-y-2">
          {/* Undo / Redo */}
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors border ${
                canUndo
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
                  : 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors border ${
                canRedo
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
                  : 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Shift+Z)"
            >
              Redo
            </button>
          </div>
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
          <div className="flex justify-between">
            <span>Undo</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Ctrl+Z</kbd>
          </div>
          <div className="flex justify-between">
            <span>Redo</span>
            <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Ctrl+Shift+Z</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
