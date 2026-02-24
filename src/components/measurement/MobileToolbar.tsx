import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { DrawingMode } from '../../types';

/** Essential tools shown in the compact pill toolbar */
const ESSENTIAL_TOOLS: { mode: DrawingMode; label: string; icon: string }[] = [
  { mode: 'outline', label: 'Outline', icon: '\u2B21' },
  { mode: 'ridge', label: 'Edge', icon: '\u2501' },
  { mode: 'select', label: 'Select', icon: '\u{1F446}' },
];

/** Full tool set shown when expanded */
const ALL_TOOLS: { mode: DrawingMode; label: string; icon: string }[] = [
  { mode: 'pan', label: 'Pan', icon: '\u{1F590}\uFE0F' },
  { mode: 'select', label: 'Select', icon: '\u{1F446}' },
  { mode: 'outline', label: 'Outline', icon: '\u2B21' },
  { mode: 'ridge', label: 'Ridge', icon: '\u2501' },
  { mode: 'hip', label: 'Hip', icon: '\u2572' },
  { mode: 'valley', label: 'Valley', icon: '\u2571' },
  { mode: 'rake', label: 'Rake', icon: '\u2502' },
  { mode: 'eave', label: 'Eave', icon: '\u2500' },
  { mode: 'flashing', label: 'Flash', icon: '\u2504' },
  { mode: 'damage', label: 'Damage', icon: '\u26A0' },
];

type ToolbarState = 'minimized' | 'compact' | 'expanded';

export default function MobileToolbar() {
  const [toolbarState, setToolbarState] = useState<ToolbarState>('compact');
  const touchStartY = useRef<number | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const {
    drawingMode,
    setDrawingMode,
    undo,
    isDrawingOutline,
    finishOutline,
    _undoStack,
  } = useStore();

  const canUndo = _undoStack.length > 0;

  // Handle swipe gestures on the toolbar
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;

    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const SWIPE_THRESHOLD = 40;

    if (deltaY > SWIPE_THRESHOLD) {
      // Swiped up: expand
      setToolbarState((prev) => {
        if (prev === 'minimized') return 'compact';
        if (prev === 'compact') return 'expanded';
        return prev;
      });
    } else if (deltaY < -SWIPE_THRESHOLD) {
      // Swiped down: minimize
      setToolbarState((prev) => {
        if (prev === 'expanded') return 'compact';
        if (prev === 'compact') return 'minimized';
        return prev;
      });
    }

    touchStartY.current = null;
  }, []);

  // Dismiss expanded toolbar on tap outside
  useEffect(() => {
    if (toolbarState !== 'expanded') return;

    const handleTapOutside = (e: TouchEvent | MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setToolbarState('compact');
      }
    };

    document.addEventListener('touchstart', handleTapOutside, { passive: true });
    document.addEventListener('mousedown', handleTapOutside);

    return () => {
      document.removeEventListener('touchstart', handleTapOutside);
      document.removeEventListener('mousedown', handleTapOutside);
    };
  }, [toolbarState]);

  // Minimized state: single floating action button
  if (toolbarState === 'minimized') {
    return (
      <button
        onClick={() => setToolbarState('compact')}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full
                   bg-gotruf-600 text-white shadow-lg shadow-gotruf-900/50
                   flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Open tools"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384-3.114A1 1 0 015 11.19V5.422a1 1 0 01.528-.884l5.472-3.163a1 1 0 01.999 0l5.472 3.163a1 1 0 01.529.884v5.768a1 1 0 01-.528.886l-5.384 3.114a1 1 0 01-.998 0z" />
        </svg>
      </button>
    );
  }

  const tools = toolbarState === 'expanded' ? ALL_TOOLS : ESSENTIAL_TOOLS;

  // Actions for the compact toolbar
  const actionButtons = [
    ...(canUndo
      ? [{ key: 'undo', label: 'Undo', icon: '\u21A9', action: undo }]
      : []),
    ...(isDrawingOutline
      ? [{ key: 'done', label: 'Done', icon: '\u2713', action: finishOutline }]
      : []),
  ];

  return (
    <div
      ref={toolbarRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`fixed z-50 left-1/2 -translate-x-1/2 transition-all duration-200 ease-out
        ${toolbarState === 'expanded' ? 'bottom-6' : 'bottom-20'}`}
    >
      {/* Drag indicator */}
      <div className="flex justify-center mb-1">
        <div className="w-8 h-1 rounded-full bg-gray-500/60" />
      </div>

      <div
        className={`bg-gray-900/95 backdrop-blur-lg border border-gray-700/60 shadow-2xl
          ${toolbarState === 'expanded'
            ? 'rounded-2xl px-3 py-3 max-w-[92vw]'
            : 'rounded-full px-2 py-1.5'
          }`}
      >
        {toolbarState === 'expanded' ? (
          /* Expanded: full grid of tools */
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-1">
              {tools.map((tool) => (
                <button
                  key={tool.mode}
                  onClick={() => setDrawingMode(tool.mode)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl
                    min-w-[44px] min-h-[44px] transition-colors
                    ${drawingMode === tool.mode
                      ? 'bg-gotruf-600/30 text-gotruf-300 ring-1 ring-gotruf-500/50'
                      : 'text-gray-400 active:bg-gray-800'
                    }`}
                >
                  <span className="text-lg leading-none">{tool.icon}</span>
                  <span className="text-[9px] font-medium leading-tight">{tool.label}</span>
                </button>
              ))}
            </div>

            {/* Action row in expanded mode */}
            <div className="flex gap-2 border-t border-gray-700/50 pt-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium min-h-[44px]
                  ${canUndo
                    ? 'bg-gray-800 text-gray-300 active:bg-gray-700'
                    : 'bg-gray-800/50 text-gray-600'
                  }`}
              >
                <span>{'\u21A9'}</span> Undo
              </button>
              {isDrawingOutline && (
                <button
                  onClick={finishOutline}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium
                    bg-amber-600 text-white active:bg-amber-500 min-h-[44px]"
                >
                  <span>{'\u2713'}</span> Done
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Compact: horizontal pill */
          <div className="flex items-center gap-0.5">
            {tools.map((tool) => (
              <button
                key={tool.mode}
                onClick={() => setDrawingMode(tool.mode)}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full
                  min-w-[44px] min-h-[44px] transition-colors
                  ${drawingMode === tool.mode
                    ? 'bg-gotruf-600/30 text-gotruf-300'
                    : 'text-gray-400 active:bg-gray-800'
                  }`}
              >
                <span className="text-base leading-none">{tool.icon}</span>
                <span className="text-[8px] font-medium leading-tight">{tool.label}</span>
              </button>
            ))}

            {/* Divider */}
            {actionButtons.length > 0 && (
              <div className="w-px h-8 bg-gray-700/60 mx-0.5" />
            )}

            {actionButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={btn.action}
                className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full
                  min-w-[44px] min-h-[44px] text-gray-400 active:bg-gray-800 transition-colors"
              >
                <span className="text-base leading-none">{btn.icon}</span>
                <span className="text-[8px] font-medium leading-tight">{btn.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
