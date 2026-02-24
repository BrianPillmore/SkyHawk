import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store/useStore';
import * as api from '../services/propertyApi';
import type { Property, RoofMeasurement } from '../types';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

interface SyncQueue {
  type: 'create-property' | 'update-property' | 'delete-property' | 'save-measurement';
  payload: unknown;
  retries: number;
}

const MAX_RETRIES = 3;

/**
 * Sync orchestration hook.
 * Provides background sync between the Zustand store and the server API.
 * Uses optimistic updates — UI updates immediately, API calls fire in background.
 */
export function useSync() {
  const [status, setStatus] = useState<SyncStatus>('synced');
  const queueRef = useRef<SyncQueue[]>([]);
  const processingRef = useRef(false);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    setStatus('syncing');

    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      try {
        switch (item.type) {
          case 'create-property': {
            const p = item.payload as Property;
            await api.createProperty({
              address: p.address,
              city: p.city,
              state: p.state,
              zip: p.zip,
              lat: p.lat,
              lng: p.lng,
              notes: p.notes,
            });
            break;
          }
          case 'update-property': {
            const { id, ...data } = item.payload as Property;
            await api.updateProperty(id, data);
            break;
          }
          case 'delete-property': {
            const { id } = item.payload as { id: string };
            await api.deleteProperty(id);
            break;
          }
          case 'save-measurement': {
            const { propertyId, measurement } = item.payload as {
              propertyId: string;
              measurement: RoofMeasurement;
            };
            await api.saveMeasurement(propertyId, measurement);
            break;
          }
        }
        // Success — remove from queue
        queueRef.current.shift();
      } catch (err) {
        if (item.retries >= MAX_RETRIES) {
          console.error(`Sync failed after ${MAX_RETRIES} retries:`, item.type, err);
          queueRef.current.shift(); // Drop after max retries
          setStatus('error');
        } else {
          item.retries++;
          // Exponential backoff
          await new Promise((r) => setTimeout(r, Math.pow(2, item.retries) * 1000));
        }
      }
    }

    processingRef.current = false;
    setStatus(queueRef.current.length === 0 ? 'synced' : 'error');
  }, []);

  const enqueue = useCallback(
    (type: SyncQueue['type'], payload: unknown) => {
      if (!isAuthenticated) return;
      queueRef.current.push({ type, payload, retries: 0 });
      processQueue();
    },
    [isAuthenticated, processQueue],
  );

  // Sync actions that components can call
  const syncCreateProperty = useCallback(
    (property: Property) => enqueue('create-property', property),
    [enqueue],
  );

  const syncUpdateProperty = useCallback(
    (property: Property) => enqueue('update-property', property),
    [enqueue],
  );

  const syncDeleteProperty = useCallback(
    (id: string) => enqueue('delete-property', { id }),
    [enqueue],
  );

  const syncSaveMeasurement = useCallback(
    (propertyId: string, measurement: RoofMeasurement) =>
      enqueue('save-measurement', { propertyId, measurement }),
    [enqueue],
  );

  /**
   * Pull all properties from server and merge into local store.
   * Server data takes precedence (last-write-wins).
   */
  const pullFromServer = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;

    try {
      setStatus('syncing');
      const serverProperties = await api.listProperties();
      const store = useStore.getState();

      // For each server property, update or add to local store
      for (const sp of serverProperties) {
        const existing = store.properties.find(
          (p) => p.address === sp.address && p.lat === sp.lat && p.lng === sp.lng,
        );

        if (!existing) {
          // Server has a property we don't have locally — add it
          const localProp: Property = {
            id: sp.id,
            address: sp.address,
            city: sp.city,
            state: sp.state,
            zip: sp.zip,
            lat: sp.lat,
            lng: sp.lng,
            notes: sp.notes,
            createdAt: sp.created_at,
            updatedAt: sp.updated_at,
            measurements: [],
            damageAnnotations: [],
            snapshots: [],
            claims: [],
          };
          useStore.setState((s) => ({
            properties: [...s.properties, localProp],
          }));
        }
      }

      setStatus('synced');
    } catch (err) {
      console.warn('Pull from server failed:', err);
      setStatus('offline');
    }
  }, [isAuthenticated]);

  /**
   * Push all local properties to the server.
   * Used for initial migration of localStorage data.
   */
  const pushToServer = useCallback(async (): Promise<{ pushed: number; failed: number }> => {
    const store = useStore.getState();
    let pushed = 0;
    let failed = 0;

    setStatus('syncing');

    for (const property of store.properties) {
      try {
        const created = await api.createProperty({
          address: property.address,
          city: property.city,
          state: property.state,
          zip: property.zip,
          lat: property.lat,
          lng: property.lng,
          notes: property.notes,
        });

        // Save measurements for this property
        for (const measurement of property.measurements) {
          try {
            await api.saveMeasurement(created.id, measurement);
          } catch {
            console.warn(`Failed to sync measurement for ${property.address}`);
          }
        }

        pushed++;
      } catch (err) {
        console.warn(`Failed to push property ${property.address}:`, err);
        failed++;
      }
    }

    setStatus(failed > 0 ? 'error' : 'synced');
    return { pushed, failed };
  }, []);

  // Check server connectivity on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;
    api.checkServerHealth().then((healthy) => {
      if (mounted) {
        setStatus(healthy ? 'synced' : 'offline');
      }
    });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  return {
    status,
    syncCreateProperty,
    syncUpdateProperty,
    syncDeleteProperty,
    syncSaveMeasurement,
    pullFromServer,
    pushToServer,
  };
}
