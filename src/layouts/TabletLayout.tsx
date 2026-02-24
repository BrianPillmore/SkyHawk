import { useRef, useState, useCallback, useEffect } from 'react';
import { useIsPortrait } from '../hooks/useMediaQuery';
import MapView from '../components/map/MapView';
import Sidebar from '../components/layout/Sidebar';

/** Default panel sizes as percentages */
const DEFAULT_LEFT_PERCENT = 40;
const MIN_PANEL_PERCENT = 25;
const MAX_PANEL_PERCENT = 75;

/**
 * TabletLayout provides a split-view optimized for tablet devices.
 *
 * Landscape: side-by-side (left: map, right: panels).
 * Portrait: top/bottom (top: map 60%, bottom: panels 40%).
 *
 * A draggable divider allows resizing.
 */
export default function TabletLayout() {
  const isPortrait = useIsPortrait();
  const [splitPercent, setSplitPercent] = useState(DEFAULT_LEFT_PERCENT);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Reset split when orientation changes
  useEffect(() => {
    setSplitPercent(isPortrait ? 60 : DEFAULT_LEFT_PERCENT);
  }, [isPortrait]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = isPortrait ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isPortrait]);

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let position: number;

      if ('touches' in e) {
        const touch = e.touches[0];
        position = isPortrait
          ? ((touch.clientY - rect.top) / rect.height) * 100
          : ((touch.clientX - rect.left) / rect.width) * 100;
      } else {
        position = isPortrait
          ? ((e.clientY - rect.top) / rect.height) * 100
          : ((e.clientX - rect.left) / rect.width) * 100;
      }

      const clamped = Math.min(MAX_PANEL_PERCENT, Math.max(MIN_PANEL_PERCENT, position));
      setSplitPercent(clamped);
    };

    const handleDragEnd = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
    document.addEventListener('touchcancel', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
      document.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [isPortrait]);

  if (isPortrait) {
    // Portrait: top/bottom split (map on top, panels on bottom)
    return (
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
        {/* Map panel (top) */}
        <div
          className="relative overflow-hidden shrink-0"
          style={{ height: `${splitPercent}%` }}
        >
          <MapView />
        </div>

        {/* Resizable divider */}
        <div
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          className="h-2 bg-gray-800 border-y border-gray-700/50 cursor-row-resize
                     flex items-center justify-center shrink-0 touch-none
                     hover:bg-gray-700 active:bg-gotruf-900/40 transition-colors"
        >
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        {/* Panel content (bottom) */}
        <div
          className="flex flex-col overflow-hidden bg-gray-900"
          style={{ height: `${100 - splitPercent}%` }}
        >
          <TabletPanelContent />
        </div>
      </div>
    );
  }

  // Landscape: side-by-side (map on left, panels on right)
  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
      {/* Map panel (left) */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{ width: `${splitPercent}%` }}
      >
        <MapView />
      </div>

      {/* Resizable divider */}
      <div
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className="w-2 bg-gray-800 border-x border-gray-700/50 cursor-col-resize
                   flex items-center justify-center shrink-0 touch-none
                   hover:bg-gray-700 active:bg-gotruf-900/40 transition-colors"
      >
        <div className="h-10 w-1 rounded-full bg-gray-600" />
      </div>

      {/* Panel content (right) */}
      <div
        className="flex flex-col overflow-hidden bg-gray-900"
        style={{ width: `${100 - splitPercent}%` }}
      >
        <TabletPanelContent />
      </div>
    </div>
  );
}

/**
 * Panel content wrapper for tablet layout.
 * Renders the Sidebar content inline (no overlay / bottom sheet) since
 * both panels are always visible on tablet.
 */
function TabletPanelContent() {
  return (
    <div className="flex-1 overflow-hidden">
      <Sidebar />
    </div>
  );
}
