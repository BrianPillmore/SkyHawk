import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Property,
  RoofMeasurement,
  RoofVertex,
  RoofEdge,
  RoofFacet,
  DrawingMode,
  EdgeType,
  MapType,
} from '../types';
import type { ReconstructedRoof } from '../types/solar';
import {
  calculatePolygonAreaSqFt,
  adjustAreaForPitch,
  areaToSquares,
  calculateEdgeLengthFt,
  calculateSuggestedWaste,
  getPredominantPitch,
} from '../utils/geometry';

const MAX_UNDO_STACK = 50;

interface AppState {
  // Properties
  properties: Property[];
  activePropertyId: string | null;

  // Current measurement session
  activeMeasurement: RoofMeasurement | null;
  drawingMode: DrawingMode;
  selectedVertexId: string | null;
  selectedEdgeId: string | null;
  selectedFacetId: string | null;

  // Drawing state
  isDrawingOutline: boolean;
  currentOutlineVertices: RoofVertex[];
  edgeStartVertexId: string | null;

  // Map state
  mapType: MapType;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;

  // UI state
  sidebarOpen: boolean;
  activePanel: 'tools' | 'measurements' | 'report';

  // Undo/Redo
  _undoStack: RoofMeasurement[];
  _redoStack: RoofMeasurement[];

  // Actions - Properties
  createProperty: (address: string, city: string, state: string, zip: string, lat: number, lng: number) => string;
  setActiveProperty: (id: string | null) => void;
  deleteProperty: (id: string) => void;

  // Actions - Measurement
  startNewMeasurement: () => void;
  setDrawingMode: (mode: DrawingMode) => void;

  // Actions - Vertices
  addVertex: (lat: number, lng: number) => string;
  moveVertex: (id: string, lat: number, lng: number) => void;
  deleteVertex: (id: string) => void;
  selectVertex: (id: string | null) => void;

  // Actions - Outline drawing
  startOutline: () => void;
  addOutlinePoint: (lat: number, lng: number) => void;
  finishOutline: () => void;
  cancelOutline: () => void;

  // Actions - Edges
  addEdge: (startVertexId: string, endVertexId: string, type: EdgeType) => string;
  deleteEdge: (id: string) => void;
  selectEdge: (id: string | null) => void;
  setEdgeStartVertex: (id: string | null) => void;

  // Actions - Facets
  addFacet: (name: string, vertexIds: string[], pitch: number) => string;
  updateFacetPitch: (id: string, pitch: number) => void;
  deleteFacet: (id: string) => void;
  selectFacet: (id: string | null) => void;

  // Actions - Map
  setMapType: (type: MapType) => void;
  setMapCenter: (center: { lat: number; lng: number }) => void;
  setMapZoom: (zoom: number) => void;

  // Actions - UI
  toggleSidebar: () => void;
  setActivePanel: (panel: 'tools' | 'measurements' | 'report') => void;

  // Actions - Recalculate
  recalculateMeasurements: () => void;
  saveMeasurement: () => void;

  // Actions - Auto measurement
  applyAutoMeasurement: (reconstructed: ReconstructedRoof) => void;

  // Actions - Undo/Redo
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
}

function createEmptyMeasurement(propertyId: string): RoofMeasurement {
  return {
    id: uuidv4(),
    propertyId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    vertices: [],
    edges: [],
    facets: [],
    totalAreaSqFt: 0,
    totalTrueAreaSqFt: 0,
    totalSquares: 0,
    predominantPitch: 0,
    totalRidgeLf: 0,
    totalHipLf: 0,
    totalValleyLf: 0,
    totalRakeLf: 0,
    totalEaveLf: 0,
    totalFlashingLf: 0,
    totalDripEdgeLf: 0,
    suggestedWastePercent: 10,
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      // Helper: snapshot current measurement onto undo stack
      const pushUndo = () => {
        const { activeMeasurement, _undoStack } = get();
        if (!activeMeasurement) return;
        const snapshot = JSON.parse(JSON.stringify(activeMeasurement)) as RoofMeasurement;
        set({
          _undoStack: [..._undoStack.slice(-(MAX_UNDO_STACK - 1)), snapshot],
          _redoStack: [],
        });
      };

      return {
        // Initial state
        properties: [],
        activePropertyId: null,
        activeMeasurement: null,
        drawingMode: 'pan' as DrawingMode,
        selectedVertexId: null,
        selectedEdgeId: null,
        selectedFacetId: null,
        isDrawingOutline: false,
        currentOutlineVertices: [],
        edgeStartVertexId: null,
        mapType: 'satellite' as MapType,
        mapCenter: { lat: 39.8283, lng: -98.5795 },
        mapZoom: 5,
        sidebarOpen: true,
        activePanel: 'tools' as const,
        _undoStack: [],
        _redoStack: [],

        // Property actions
        createProperty: (address, city, state, zip, lat, lng) => {
          const id = uuidv4();
          const property: Property = {
            id,
            address,
            city,
            state,
            zip,
            lat,
            lng,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            measurements: [],
            notes: '',
          };
          set((s) => ({
            properties: [...s.properties, property],
            activePropertyId: id,
            mapCenter: { lat, lng },
            mapZoom: 20,
          }));
          return id;
        },

        setActiveProperty: (id) => {
          const property = id ? get().properties.find((p) => p.id === id) : null;
          set({
            activePropertyId: id,
            activeMeasurement: null,
            _undoStack: [],
            _redoStack: [],
            ...(property ? { mapCenter: { lat: property.lat, lng: property.lng }, mapZoom: 20 } : {}),
          });
        },

        deleteProperty: (id) => {
          set((s) => ({
            properties: s.properties.filter((p) => p.id !== id),
            activePropertyId: s.activePropertyId === id ? null : s.activePropertyId,
            activeMeasurement: s.activeMeasurement?.propertyId === id ? null : s.activeMeasurement,
            ...(s.activePropertyId === id ? { _undoStack: [], _redoStack: [] } : {}),
          }));
        },

        // Measurement actions
        startNewMeasurement: () => {
          const { activePropertyId } = get();
          if (!activePropertyId) return;
          set({
            activeMeasurement: createEmptyMeasurement(activePropertyId),
            drawingMode: 'outline',
            selectedVertexId: null,
            selectedEdgeId: null,
            selectedFacetId: null,
            _undoStack: [],
            _redoStack: [],
          });
        },

        setDrawingMode: (mode) => {
          set({
            drawingMode: mode,
            selectedVertexId: null,
            selectedEdgeId: null,
            selectedFacetId: null,
            edgeStartVertexId: null,
            isDrawingOutline: mode === 'outline',
            currentOutlineVertices: mode === 'outline' ? [] : get().currentOutlineVertices,
          });
        },

        // Vertex actions
        addVertex: (lat, lng) => {
          const id = uuidv4();
          const vertex: RoofVertex = { id, lat, lng };
          pushUndo();
          set((s) => {
            if (!s.activeMeasurement) return s;
            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                vertices: [...s.activeMeasurement.vertices, vertex],
                updatedAt: new Date().toISOString(),
              },
            };
          });
          return id;
        },

        moveVertex: (id, lat, lng) => {
          pushUndo();
          set((s) => {
            if (!s.activeMeasurement) return s;
            const vertices = s.activeMeasurement.vertices.map((v) =>
              v.id === id ? { ...v, lat, lng } : v
            );
            const edges = s.activeMeasurement.edges.map((e) => {
              if (e.startVertexId === id || e.endVertexId === id) {
                const startV = vertices.find((v) => v.id === e.startVertexId);
                const endV = vertices.find((v) => v.id === e.endVertexId);
                if (startV && endV) {
                  return { ...e, lengthFt: calculateEdgeLengthFt(startV, endV) };
                }
              }
              return e;
            });
            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                vertices,
                edges,
                updatedAt: new Date().toISOString(),
              },
            };
          });
          get().recalculateMeasurements();
        },

        deleteVertex: (id) => {
          pushUndo();
          set((s) => {
            if (!s.activeMeasurement) return s;
            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                vertices: s.activeMeasurement.vertices.filter((v) => v.id !== id),
                edges: s.activeMeasurement.edges.filter(
                  (e) => e.startVertexId !== id && e.endVertexId !== id
                ),
                facets: s.activeMeasurement.facets.filter(
                  (f) => !f.vertexIds.includes(id)
                ),
                updatedAt: new Date().toISOString(),
              },
              selectedVertexId: s.selectedVertexId === id ? null : s.selectedVertexId,
            };
          });
          get().recalculateMeasurements();
        },

        selectVertex: (id) => set({ selectedVertexId: id, selectedEdgeId: null, selectedFacetId: null }),

        // Outline drawing
        startOutline: () => {
          set({ isDrawingOutline: true, currentOutlineVertices: [] });
        },

        addOutlinePoint: (lat, lng) => {
          const id = uuidv4();
          set((s) => ({
            currentOutlineVertices: [...s.currentOutlineVertices, { id, lat, lng }],
          }));
        },

        finishOutline: () => {
          const { currentOutlineVertices, activeMeasurement } = get();
          if (currentOutlineVertices.length < 3 || !activeMeasurement) {
            set({ isDrawingOutline: false, currentOutlineVertices: [] });
            return;
          }

          pushUndo();

          const newVertices = [...activeMeasurement.vertices, ...currentOutlineVertices];

          const newEdges = [...activeMeasurement.edges];
          for (let i = 0; i < currentOutlineVertices.length; i++) {
            const start = currentOutlineVertices[i];
            const end = currentOutlineVertices[(i + 1) % currentOutlineVertices.length];
            newEdges.push({
              id: uuidv4(),
              startVertexId: start.id,
              endVertexId: end.id,
              type: 'eave',
              lengthFt: calculateEdgeLengthFt(start, end),
            });
          }

          const facetId = uuidv4();
          const facetVertexIds = currentOutlineVertices.map((v) => v.id);
          const flatArea = calculatePolygonAreaSqFt(currentOutlineVertices);
          const defaultPitch = 6;
          const trueArea = adjustAreaForPitch(flatArea, defaultPitch);
          const facetEdgeIds = newEdges
            .slice(activeMeasurement.edges.length)
            .map((e) => e.id);

          const newFacet: RoofFacet = {
            id: facetId,
            name: `Facet ${activeMeasurement.facets.length + 1}`,
            vertexIds: facetVertexIds,
            pitch: defaultPitch,
            areaSqFt: flatArea,
            trueAreaSqFt: trueArea,
            edgeIds: facetEdgeIds,
          };

          set({
            activeMeasurement: {
              ...activeMeasurement,
              vertices: newVertices,
              edges: newEdges,
              facets: [...activeMeasurement.facets, newFacet],
              updatedAt: new Date().toISOString(),
            },
            isDrawingOutline: false,
            currentOutlineVertices: [],
            drawingMode: 'select',
          });

          get().recalculateMeasurements();
        },

        cancelOutline: () => {
          set({ isDrawingOutline: false, currentOutlineVertices: [] });
        },

        // Edge actions
        addEdge: (startVertexId, endVertexId, type) => {
          const { activeMeasurement } = get();
          if (!activeMeasurement) return '';

          const startV = activeMeasurement.vertices.find((v) => v.id === startVertexId);
          const endV = activeMeasurement.vertices.find((v) => v.id === endVertexId);
          if (!startV || !endV) return '';

          pushUndo();

          const id = uuidv4();
          const edge: RoofEdge = {
            id,
            startVertexId,
            endVertexId,
            type,
            lengthFt: calculateEdgeLengthFt(startV, endV),
          };

          set((s) => {
            if (!s.activeMeasurement) return s;
            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                edges: [...s.activeMeasurement.edges, edge],
                updatedAt: new Date().toISOString(),
              },
              edgeStartVertexId: null,
            };
          });

          get().recalculateMeasurements();
          return id;
        },

        deleteEdge: (id) => {
          pushUndo();
          set((s) => {
            if (!s.activeMeasurement) return s;
            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                edges: s.activeMeasurement.edges.filter((e) => e.id !== id),
                updatedAt: new Date().toISOString(),
              },
              selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
            };
          });
          get().recalculateMeasurements();
        },

        selectEdge: (id) => set({ selectedEdgeId: id, selectedVertexId: null, selectedFacetId: null }),

        setEdgeStartVertex: (id) => set({ edgeStartVertexId: id }),

        // Facet actions
        addFacet: (name, vertexIds, pitch) => {
          const { activeMeasurement } = get();
          if (!activeMeasurement) return '';

          const vertices = vertexIds
            .map((id) => activeMeasurement.vertices.find((v) => v.id === id))
            .filter((v): v is RoofVertex => v !== undefined);

          const flatArea = calculatePolygonAreaSqFt(vertices);
          const trueArea = adjustAreaForPitch(flatArea, pitch);

          pushUndo();

          const id = uuidv4();
          const facet: RoofFacet = {
            id,
            name,
            vertexIds,
            pitch,
            areaSqFt: flatArea,
            trueAreaSqFt: trueArea,
            edgeIds: [],
          };

          set((s) => {
            if (!s.activeMeasurement) return s;
            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                facets: [...s.activeMeasurement.facets, facet],
                updatedAt: new Date().toISOString(),
              },
            };
          });

          get().recalculateMeasurements();
          return id;
        },

        updateFacetPitch: (id, pitch) => {
          pushUndo();
          set((s) => {
            if (!s.activeMeasurement) return s;
            const facets = s.activeMeasurement.facets.map((f) => {
              if (f.id !== id) return f;
              const trueArea = adjustAreaForPitch(f.areaSqFt, pitch);
              return { ...f, pitch, trueAreaSqFt: trueArea };
            });
            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                facets,
                updatedAt: new Date().toISOString(),
              },
            };
          });
          get().recalculateMeasurements();
        },

        deleteFacet: (id) => {
          pushUndo();
          set((s) => {
            if (!s.activeMeasurement) return s;
            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                facets: s.activeMeasurement.facets.filter((f) => f.id !== id),
                updatedAt: new Date().toISOString(),
              },
              selectedFacetId: s.selectedFacetId === id ? null : s.selectedFacetId,
            };
          });
          get().recalculateMeasurements();
        },

        selectFacet: (id) => set({ selectedFacetId: id, selectedVertexId: null, selectedEdgeId: null }),

        // Map actions
        setMapType: (type) => set({ mapType: type }),
        setMapCenter: (center) => set({ mapCenter: center }),
        setMapZoom: (zoom) => set({ mapZoom: zoom }),

        // UI actions
        toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
        setActivePanel: (panel) => set({ activePanel: panel }),

        // Recalculate all measurements
        recalculateMeasurements: () => {
          set((s) => {
            if (!s.activeMeasurement) return s;
            const { facets, edges } = s.activeMeasurement;

            const totalAreaSqFt = facets.reduce((sum, f) => sum + f.areaSqFt, 0);
            const totalTrueAreaSqFt = facets.reduce((sum, f) => sum + f.trueAreaSqFt, 0);

            const edgeByType = (type: EdgeType) =>
              edges.filter((e) => e.type === type).reduce((sum, e) => sum + e.lengthFt, 0);

            const totalRidgeLf = edgeByType('ridge');
            const totalHipLf = edgeByType('hip');
            const totalValleyLf = edgeByType('valley');
            const totalRakeLf = edgeByType('rake');
            const totalEaveLf = edgeByType('eave');
            const totalFlashingLf = edgeByType('flashing') + edgeByType('step-flashing');

            return {
              activeMeasurement: {
                ...s.activeMeasurement,
                totalAreaSqFt,
                totalTrueAreaSqFt,
                totalSquares: areaToSquares(totalTrueAreaSqFt),
                predominantPitch: getPredominantPitch(facets),
                totalRidgeLf,
                totalHipLf,
                totalValleyLf,
                totalRakeLf,
                totalEaveLf,
                totalFlashingLf,
                totalDripEdgeLf: totalRakeLf + totalEaveLf,
                suggestedWastePercent: calculateSuggestedWaste(facets, edges),
                updatedAt: new Date().toISOString(),
              },
            };
          });
        },

        // Save measurement to property
        saveMeasurement: () => {
          const { activeMeasurement, activePropertyId } = get();
          if (!activeMeasurement || !activePropertyId) return;

          set((s) => ({
            properties: s.properties.map((p) => {
              if (p.id !== activePropertyId) return p;
              const existing = p.measurements.findIndex((m) => m.id === activeMeasurement.id);
              const measurements =
                existing >= 0
                  ? p.measurements.map((m) => (m.id === activeMeasurement.id ? activeMeasurement : m))
                  : [...p.measurements, activeMeasurement];
              return { ...p, measurements, updatedAt: new Date().toISOString() };
            }),
          }));
        },

        // Auto measurement
        applyAutoMeasurement: (reconstructed: ReconstructedRoof) => {
          const { activePropertyId } = get();
          if (!activePropertyId) return;

          pushUndo();

          const measurement = createEmptyMeasurement(activePropertyId);

          const vertices: RoofVertex[] = reconstructed.vertices.map((v) => ({
            id: uuidv4(),
            lat: v.lat,
            lng: v.lng,
          }));

          const edges: RoofEdge[] = reconstructed.edges.map((e) => {
            const startV = vertices[e.startIndex];
            const endV = vertices[e.endIndex];
            return {
              id: uuidv4(),
              startVertexId: startV.id,
              endVertexId: endV.id,
              type: e.type,
              lengthFt: startV && endV ? calculateEdgeLengthFt(startV, endV) : 0,
            };
          });

          const facets: RoofFacet[] = reconstructed.facets.map((f) => {
            const facetVertexIds = f.vertexIndices.map((idx) => vertices[idx]?.id).filter(Boolean);
            const facetVertices = f.vertexIndices
              .map((idx) => vertices[idx])
              .filter((v): v is RoofVertex => v !== undefined);
            const flatArea = calculatePolygonAreaSqFt(facetVertices);
            const trueArea = adjustAreaForPitch(flatArea, f.pitch);

            return {
              id: uuidv4(),
              name: f.name,
              vertexIds: facetVertexIds,
              pitch: f.pitch,
              areaSqFt: flatArea,
              trueAreaSqFt: trueArea,
              edgeIds: [],
            };
          });

          measurement.vertices = vertices;
          measurement.edges = edges;
          measurement.facets = facets;

          set({
            activeMeasurement: measurement,
            drawingMode: 'select',
            selectedVertexId: null,
            selectedEdgeId: null,
            selectedFacetId: null,
            isDrawingOutline: false,
            currentOutlineVertices: [],
            edgeStartVertexId: null,
          });

          get().recalculateMeasurements();
        },

        // Undo/Redo
        undo: () => {
          const { _undoStack, activeMeasurement } = get();
          if (_undoStack.length === 0 || !activeMeasurement) return;

          const previous = _undoStack[_undoStack.length - 1];
          const currentSnapshot = JSON.parse(JSON.stringify(activeMeasurement)) as RoofMeasurement;

          set((s) => ({
            activeMeasurement: previous,
            _undoStack: s._undoStack.slice(0, -1),
            _redoStack: [...s._redoStack, currentSnapshot],
            selectedVertexId: null,
            selectedEdgeId: null,
            selectedFacetId: null,
          }));
        },

        redo: () => {
          const { _redoStack, activeMeasurement } = get();
          if (_redoStack.length === 0 || !activeMeasurement) return;

          const next = _redoStack[_redoStack.length - 1];
          const currentSnapshot = JSON.parse(JSON.stringify(activeMeasurement)) as RoofMeasurement;

          set((s) => ({
            activeMeasurement: next,
            _redoStack: s._redoStack.slice(0, -1),
            _undoStack: [...s._undoStack, currentSnapshot],
            selectedVertexId: null,
            selectedEdgeId: null,
            selectedFacetId: null,
          }));
        },

        // Clear all
        clearAll: () => {
          const { activePropertyId } = get();
          if (!activePropertyId) return;
          pushUndo();
          set({
            activeMeasurement: createEmptyMeasurement(activePropertyId),
            selectedVertexId: null,
            selectedEdgeId: null,
            selectedFacetId: null,
            isDrawingOutline: false,
            currentOutlineVertices: [],
            edgeStartVertexId: null,
            drawingMode: 'outline',
          });
        },
      };
    },
    {
      name: 'skyhawk-storage',
      version: 1,
      partialize: (state) => ({
        properties: state.properties,
        activePropertyId: state.activePropertyId,
        activeMeasurement: state.activeMeasurement,
        mapType: state.mapType,
        mapCenter: state.mapCenter,
        mapZoom: state.mapZoom,
      }),
    }
  )
);
