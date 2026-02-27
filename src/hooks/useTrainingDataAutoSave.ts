import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { autoSaveIfReady, cancelPendingAutoSave, resetAutoSaveState } from '../services/trainingDataService';

/**
 * Hook that subscribes to store changes and auto-saves user edge drawings
 * as ML training data after 5 seconds of inactivity.
 *
 * Mount this once in the Workspace component. It watches for changes to
 * the active measurement's edges/vertices and triggers the debounced
 * auto-save pipeline:
 *   1. Captures satellite image of current map view
 *   2. POSTs image + edge geometry to /api/ml/annotations/auto-save-drawing
 *   3. Server renders edge mask + stores in PostgreSQL + filesystem
 *
 * The training data is automatically weighted 3x in the training sampler,
 * creating an active learning feedback loop.
 */
export function useTrainingDataAutoSave(): void {
  const activePropertyId = useStore((s) => s.activePropertyId);

  useEffect(() => {
    // Reset tracking when switching properties
    resetAutoSaveState();

    if (!activePropertyId) return;

    // Subscribe to store changes — fires on every state mutation
    const unsubscribe = useStore.subscribe((state) => {
      autoSaveIfReady({
        token: state.token,
        activeMeasurement: state.activeMeasurement
          ? {
              id: state.activeMeasurement.id,
              vertices: state.activeMeasurement.vertices,
              edges: state.activeMeasurement.edges,
              updatedAt: state.activeMeasurement.updatedAt,
            }
          : null,
        activePropertyId: state.activePropertyId,
        properties: state.properties.map((p) => ({
          id: p.id,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
        })),
        mapCenter: state.mapCenter,
        mapZoom: state.mapZoom,
      });
    });

    return () => {
      unsubscribe();
      cancelPendingAutoSave();
    };
  }, [activePropertyId]);
}
