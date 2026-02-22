import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const state = useStore.getState();

      // Undo/Redo (Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          state.undo();
          return;
        }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          state.redo();
          return;
        }
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          state.setDrawingMode('pan');
          break;
        case 'v':
          state.setDrawingMode('select');
          break;
        case 'o':
          state.setDrawingMode('outline');
          break;
        case 'r':
          state.setDrawingMode('ridge');
          break;
        case 'h':
          state.setDrawingMode('hip');
          break;
        case 'y':
          state.setDrawingMode('valley');
          break;
        case 'k':
          state.setDrawingMode('rake');
          break;
        case 'e':
          state.setDrawingMode('eave');
          break;
        case 'f':
          state.setDrawingMode('flashing');
          break;
        case 'enter':
          if (state.isDrawingOutline) {
            e.preventDefault();
            state.finishOutline();
          }
          break;
        case 'escape':
          if (state.isDrawingOutline) {
            state.cancelOutline();
          } else {
            state.selectVertex(null);
            state.selectEdge(null);
            state.selectFacet(null);
            state.setEdgeStartVertex(null);
          }
          break;
        case 'delete':
        case 'backspace':
          if (state.selectedVertexId) {
            state.deleteVertex(state.selectedVertexId);
          } else if (state.selectedEdgeId) {
            state.deleteEdge(state.selectedEdgeId);
          } else if (state.selectedFacetId) {
            state.deleteFacet(state.selectedFacetId);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
