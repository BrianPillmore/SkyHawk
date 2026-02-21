import { create } from 'zustand';
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
import {
  calculatePolygonAreaSqFt,
  adjustAreaForPitch,
  areaToSquares,
  calculateEdgeLengthFt,
  calculateSuggestedWaste,
  getPredominantPitch,
} from '../utils/geometry';

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

  // Actions - Undo support
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

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  properties: [],
  activePropertyId: null,
  activeMeasurement: null,
  drawingMode: 'pan',
  selectedVertexId: null,
  selectedEdgeId: null,
  selectedFacetId: null,
  isDrawingOutline: false,
  currentOutlineVertices: [],
  edgeStartVertexId: null,
  mapType: 'satellite',
  mapCenter: { lat: 39.8283, lng: -98.5795 }, // Center of US
  mapZoom: 5,
  sidebarOpen: true,
  activePanel: 'tools',

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
      ...(property ? { mapCenter: { lat: property.lat, lng: property.lng }, mapZoom: 20 } : {}),
    });
  },

  deleteProperty: (id) => {
    set((s) => ({
      properties: s.properties.filter((p) => p.id !== id),
      activePropertyId: s.activePropertyId === id ? null : s.activePropertyId,
      activeMeasurement: s.activeMeasurement?.propertyId === id ? null : s.activeMeasurement,
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
    set((s) => {
      if (!s.activeMeasurement) return s;
      const vertices = s.activeMeasurement.vertices.map((v) =>
        v.id === id ? { ...v, lat, lng } : v
      );
      // Recalculate edges that use this vertex
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

    // Add vertices to measurement
    const newVertices = [...activeMeasurement.vertices, ...currentOutlineVertices];

    // Create eave edges connecting outline vertices
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

    // Create a facet for the outlined area
    const facetId = uuidv4();
    const facetVertexIds = currentOutlineVertices.map((v) => v.id);
    const flatArea = calculatePolygonAreaSqFt(currentOutlineVertices);
    const defaultPitch = 6; // Default 6/12 pitch
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

  // Clear all drawing
  clearAll: () => {
    const { activePropertyId } = get();
    if (!activePropertyId) return;
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
}));
