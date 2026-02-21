import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { getEdgeColor, FACET_STROKE_COLORS } from '../../utils/colors';
import { getMidpoint, getCentroid, formatLength, formatArea } from '../../utils/geometry';
import type { DrawingMode, EdgeType, RoofVertex } from '../../types';
import PlaceholderMap from './PlaceholderMap';

// Distance threshold in pixels for vertex snap highlight
const SNAP_THRESHOLD_PX = 18;

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement | google.maps.Marker>>(new Map());
  const outlineMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const polygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map());
  const outlinePolylineRef = useRef<google.maps.Polyline | null>(null);
  const tempLineRef = useRef<google.maps.Polyline | null>(null);
  const previewLineRef = useRef<google.maps.Polyline | null>(null);
  const snapHighlightRef = useRef<google.maps.Marker | null>(null);
  const edgeLabelsRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const facetLabelsRef = useRef<Map<string, google.maps.Marker>>(new Map());

  const { loaded, error, apiKey } = useGoogleMaps();

  const {
    mapCenter, mapZoom, mapType, drawingMode,
    activeMeasurement, isDrawingOutline, currentOutlineVertices,
    edgeStartVertexId,
    addOutlinePoint, finishOutline,
    addEdge, setEdgeStartVertex,
    moveVertex, selectVertex, selectEdge, selectFacet,
    selectedVertexId, selectedEdgeId, selectedFacetId,
    setMapCenter, setMapZoom,
  } = useStore();

  // Initialize map
  useEffect(() => {
    if (!loaded || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: mapCenter,
      zoom: mapZoom,
      mapTypeId: mapType as google.maps.MapTypeId,
      tilt: 0,
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      rotateControl: false,
      gestureHandling: 'greedy',
    });

    mapInstanceRef.current = map;

    map.addListener('idle', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (center && zoom) {
        setMapCenter({ lat: center.lat(), lng: center.lng() });
        setMapZoom(zoom);
      }
    });
  }, [loaded]);

  // Update map center/zoom when store changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const current = map.getCenter();
    if (current && (Math.abs(current.lat() - mapCenter.lat) > 0.0001 || Math.abs(current.lng() - mapCenter.lng) > 0.0001)) {
      map.panTo(mapCenter);
    }
    if (map.getZoom() !== mapZoom) {
      map.setZoom(mapZoom);
    }
  }, [mapCenter, mapZoom]);

  // Update map type
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(mapType as google.maps.MapTypeId);
    }
  }, [mapType]);

  // Map click handler
  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      if (drawingMode === 'outline' && isDrawingOutline) {
        // Check if clicking near first point to close
        if (currentOutlineVertices.length >= 3) {
          const first = currentOutlineVertices[0];
          const map = mapInstanceRef.current;
          if (map) {
            const scale = Math.pow(2, map.getZoom() || 20);
            const threshold = 20000 / scale;
            if (Math.abs(lat - first.lat) < threshold && Math.abs(lng - first.lng) < threshold) {
              finishOutline();
              return;
            }
          }
        }
        addOutlinePoint(lat, lng);
      }
    },
    [drawingMode, isDrawingOutline, currentOutlineVertices, addOutlinePoint, finishOutline]
  );

  // Register map click listener
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const listener = map.addListener('click', handleMapClick);
    return () => google.maps.event.removeListener(listener);
  }, [handleMapClick]);

  // Set cursor based on drawing mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const cursorMap: Record<DrawingMode, string> = {
      select: 'default',
      pan: 'grab',
      outline: 'crosshair',
      ridge: 'crosshair',
      hip: 'crosshair',
      valley: 'crosshair',
      rake: 'crosshair',
      eave: 'crosshair',
      flashing: 'crosshair',
      facet: 'crosshair',
    };

    map.setOptions({ draggableCursor: cursorMap[drawingMode] || 'default' });
  }, [drawingMode]);

  // Render vertices as markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeMeasurement) return;

    const existingIds = new Set(activeMeasurement.vertices.map((v) => v.id));

    // Remove markers that no longer exist
    for (const [id, marker] of markersRef.current) {
      if (!existingIds.has(id)) {
        if ('setMap' in marker) (marker as google.maps.Marker).setMap(null);
        markersRef.current.delete(id);
      }
    }

    // Add/update markers
    for (const vertex of activeMeasurement.vertices) {
      let marker = markersRef.current.get(vertex.id);
      if (!marker) {
        const m = new google.maps.Marker({
          position: { lat: vertex.lat, lng: vertex.lng },
          map,
          draggable: drawingMode === 'select',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: selectedVertexId === vertex.id || edgeStartVertexId === vertex.id ? 8 : 6,
            fillColor: edgeStartVertexId === vertex.id ? '#22c55e' : selectedVertexId === vertex.id ? '#3b96f6' : '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          zIndex: 100,
        });

        m.addListener('click', () => {
          const currentMode = useStore.getState().drawingMode;
          const edgeTypes: DrawingMode[] = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing'];

          if (edgeTypes.includes(currentMode)) {
            const startId = useStore.getState().edgeStartVertexId;
            if (!startId) {
              setEdgeStartVertex(vertex.id);
            } else if (startId !== vertex.id) {
              addEdge(startId, vertex.id, currentMode as EdgeType);
            }
          } else if (currentMode === 'select') {
            selectVertex(vertex.id);
          }
        });

        m.addListener('dragend', () => {
          const pos = m.getPosition();
          if (pos) {
            moveVertex(vertex.id, pos.lat(), pos.lng());
          }
        });

        markersRef.current.set(vertex.id, m);
      } else {
        const gMarker = marker as google.maps.Marker;
        gMarker.setPosition({ lat: vertex.lat, lng: vertex.lng });
        gMarker.setDraggable(drawingMode === 'select');
        gMarker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: selectedVertexId === vertex.id || edgeStartVertexId === vertex.id ? 8 : 6,
          fillColor: edgeStartVertexId === vertex.id ? '#22c55e' : selectedVertexId === vertex.id ? '#3b96f6' : '#f59e0b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        });
      }
    }
  }, [activeMeasurement?.vertices, drawingMode, selectedVertexId, edgeStartVertexId]);

  // Render edges as polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeMeasurement) return;

    const existingIds = new Set(activeMeasurement.edges.map((e) => e.id));

    // Remove old polylines
    for (const [id, line] of polylinesRef.current) {
      if (!existingIds.has(id)) {
        line.setMap(null);
        polylinesRef.current.delete(id);
      }
    }

    // Add/update edges
    for (const edge of activeMeasurement.edges) {
      const startV = activeMeasurement.vertices.find((v) => v.id === edge.startVertexId);
      const endV = activeMeasurement.vertices.find((v) => v.id === edge.endVertexId);
      if (!startV || !endV) continue;

      const path = [
        { lat: startV.lat, lng: startV.lng },
        { lat: endV.lat, lng: endV.lng },
      ];

      let line = polylinesRef.current.get(edge.id);
      const color = getEdgeColor(edge.type);
      const isSelected = selectedEdgeId === edge.id;

      if (!line) {
        line = new google.maps.Polyline({
          path,
          map,
          strokeColor: color,
          strokeWeight: isSelected ? 4 : 2.5,
          strokeOpacity: isSelected ? 1 : 0.8,
          zIndex: isSelected ? 50 : 10,
        });

        line.addListener('click', () => {
          selectEdge(edge.id);
        });

        polylinesRef.current.set(edge.id, line);
      } else {
        line.setPath(path);
        line.setOptions({
          strokeColor: color,
          strokeWeight: isSelected ? 4 : 2.5,
          strokeOpacity: isSelected ? 1 : 0.8,
          zIndex: isSelected ? 50 : 10,
        });
      }
    }
  }, [activeMeasurement?.edges, activeMeasurement?.vertices, selectedEdgeId]);

  // Render edge length labels at midpoints
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeMeasurement) {
      // Clean up all labels
      for (const [, marker] of edgeLabelsRef.current) marker.setMap(null);
      edgeLabelsRef.current.clear();
      return;
    }

    const existingIds = new Set(activeMeasurement.edges.map((e) => e.id));

    // Remove labels for deleted edges
    for (const [id, marker] of edgeLabelsRef.current) {
      if (!existingIds.has(id)) {
        marker.setMap(null);
        edgeLabelsRef.current.delete(id);
      }
    }

    // Add/update edge labels
    for (const edge of activeMeasurement.edges) {
      const startV = activeMeasurement.vertices.find((v) => v.id === edge.startVertexId);
      const endV = activeMeasurement.vertices.find((v) => v.id === edge.endVertexId);
      if (!startV || !endV) continue;

      const mid = getMidpoint(startV, endV);
      const labelText = `${edge.lengthFt.toFixed(1)}'`;
      const color = getEdgeColor(edge.type);

      let marker = edgeLabelsRef.current.get(edge.id);
      if (!marker) {
        marker = new google.maps.Marker({
          position: mid,
          map,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
          label: {
            text: labelText,
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 'bold',
            className: 'edge-label',
          },
          clickable: false,
          zIndex: 80,
        });
        edgeLabelsRef.current.set(edge.id, marker);
      } else {
        marker.setPosition(mid);
        marker.setLabel({
          text: labelText,
          color: '#ffffff',
          fontSize: '10px',
          fontWeight: 'bold',
          className: 'edge-label',
        });
      }
    }
  }, [activeMeasurement?.edges, activeMeasurement?.vertices]);

  // Render facet area labels at centroids
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeMeasurement) {
      for (const [, marker] of facetLabelsRef.current) marker.setMap(null);
      facetLabelsRef.current.clear();
      return;
    }

    const existingIds = new Set(activeMeasurement.facets.map((f) => f.id));

    // Remove labels for deleted facets
    for (const [id, marker] of facetLabelsRef.current) {
      if (!existingIds.has(id)) {
        marker.setMap(null);
        facetLabelsRef.current.delete(id);
      }
    }

    // Add/update facet labels
    for (const facet of activeMeasurement.facets) {
      const vertices = facet.vertexIds
        .map((id) => activeMeasurement.vertices.find((v) => v.id === id))
        .filter((v): v is RoofVertex => v !== undefined);

      if (vertices.length < 3) continue;

      const centroid = getCentroid(vertices);
      const labelText = `${Math.round(facet.trueAreaSqFt)} sf`;

      let marker = facetLabelsRef.current.get(facet.id);
      if (!marker) {
        marker = new google.maps.Marker({
          position: centroid,
          map,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
          label: {
            text: labelText,
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 'bold',
            className: 'facet-label',
          },
          clickable: false,
          zIndex: 75,
        });
        facetLabelsRef.current.set(facet.id, marker);
      } else {
        marker.setPosition(centroid);
        marker.setLabel({
          text: labelText,
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 'bold',
          className: 'facet-label',
        });
      }
    }
  }, [activeMeasurement?.facets, activeMeasurement?.vertices]);

  // Render facets as polygons
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeMeasurement) return;

    const existingIds = new Set(activeMeasurement.facets.map((f) => f.id));

    // Remove old polygons
    for (const [id, polygon] of polygonsRef.current) {
      if (!existingIds.has(id)) {
        polygon.setMap(null);
        polygonsRef.current.delete(id);
      }
    }

    // Add/update facets
    activeMeasurement.facets.forEach((facet, idx) => {
      const vertices = facet.vertexIds
        .map((id) => activeMeasurement.vertices.find((v) => v.id === id))
        .filter((v): v is RoofVertex => v !== undefined);

      if (vertices.length < 3) return;

      const path = vertices.map((v) => ({ lat: v.lat, lng: v.lng }));
      const isSelected = selectedFacetId === facet.id;

      let polygon = polygonsRef.current.get(facet.id);
      if (!polygon) {
        polygon = new google.maps.Polygon({
          paths: path,
          map,
          fillColor: FACET_STROKE_COLORS[idx % FACET_STROKE_COLORS.length],
          fillOpacity: isSelected ? 0.35 : 0.2,
          strokeColor: FACET_STROKE_COLORS[idx % FACET_STROKE_COLORS.length],
          strokeWeight: isSelected ? 3 : 1.5,
          strokeOpacity: 0.8,
          zIndex: 5,
        });

        polygon.addListener('click', () => {
          selectFacet(facet.id);
        });

        polygonsRef.current.set(facet.id, polygon);
      } else {
        polygon.setPaths(path);
        polygon.setOptions({
          fillOpacity: isSelected ? 0.35 : 0.2,
          strokeWeight: isSelected ? 3 : 1.5,
        });
      }
    });
  }, [activeMeasurement?.facets, activeMeasurement?.vertices, selectedFacetId]);

  // Render outline being drawn
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (outlinePolylineRef.current) {
      outlinePolylineRef.current.setMap(null);
      outlinePolylineRef.current = null;
    }

    // Clean up previous outline markers
    for (const [id, m] of outlineMarkersRef.current) {
      m.setMap(null);
      outlineMarkersRef.current.delete(id);
    }

    if (isDrawingOutline && currentOutlineVertices.length > 0) {
      const path = currentOutlineVertices.map((v) => ({ lat: v.lat, lng: v.lng }));

      outlinePolylineRef.current = new google.maps.Polyline({
        path,
        map,
        strokeColor: '#f59e0b',
        strokeWeight: 2,
        strokeOpacity: 0.9,
        icons: [
          {
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
            offset: '0',
            repeat: '15px',
          },
        ],
        zIndex: 200,
      });

      // Render temp vertex markers for outline points
      for (const v of currentOutlineVertices) {
        if (!outlineMarkersRef.current.has(v.id)) {
          const m = new google.maps.Marker({
            position: { lat: v.lat, lng: v.lng },
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: '#f59e0b',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            zIndex: 201,
          });
          outlineMarkersRef.current.set(v.id, m);
        }
      }
    }

    return () => {
      for (const [id, m] of outlineMarkersRef.current) {
        m.setMap(null);
        outlineMarkersRef.current.delete(id);
      }
    };
  }, [isDrawingOutline, currentOutlineVertices]);

  // Edge drawing preview line: dashed line from start vertex to cursor
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const edgeModes: DrawingMode[] = ['ridge', 'hip', 'valley', 'rake', 'eave', 'flashing'];
    const isEdgeMode = edgeModes.includes(drawingMode);

    // Clean up if not in edge mode or no start vertex
    if (!isEdgeMode || !edgeStartVertexId || !activeMeasurement) {
      if (previewLineRef.current) {
        previewLineRef.current.setMap(null);
        previewLineRef.current = null;
      }
      if (snapHighlightRef.current) {
        snapHighlightRef.current.setMap(null);
        snapHighlightRef.current = null;
      }
      return;
    }

    const startVertex = activeMeasurement.vertices.find((v) => v.id === edgeStartVertexId);
    if (!startVertex) return;

    const edgeColor = getEdgeColor(drawingMode as EdgeType);

    // Create preview line if it doesn't exist
    if (!previewLineRef.current) {
      previewLineRef.current = new google.maps.Polyline({
        path: [
          { lat: startVertex.lat, lng: startVertex.lng },
          { lat: startVertex.lat, lng: startVertex.lng },
        ],
        map,
        strokeColor: edgeColor,
        strokeWeight: 2,
        strokeOpacity: 0.6,
        icons: [
          {
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, scale: 2 },
            offset: '0',
            repeat: '10px',
          },
        ],
        zIndex: 150,
      });
    } else {
      previewLineRef.current.setOptions({ strokeColor: edgeColor });
    }

    // Create snap highlight marker
    if (!snapHighlightRef.current) {
      snapHighlightRef.current = new google.maps.Marker({
        position: { lat: 0, lng: 0 },
        map: null, // hidden initially
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: edgeColor,
          fillOpacity: 0.3,
          strokeColor: edgeColor,
          strokeWeight: 2,
        },
        zIndex: 99,
        clickable: false,
      });
    }

    // Mouse move handler: update preview line endpoint
    const moveListener = map.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !previewLineRef.current) return;

      const mouseLatLng = e.latLng;

      // Check if near any vertex for snap highlight
      let snappedToVertex = false;
      const vertices = useStore.getState().activeMeasurement?.vertices || [];
      const projection = map.getProjection();
      const zoom = map.getZoom() || 20;

      if (projection) {
        const mousePoint = projection.fromLatLngToPoint(mouseLatLng);
        if (mousePoint) {
          const scale = Math.pow(2, zoom);
          for (const v of vertices) {
            if (v.id === edgeStartVertexId) continue;
            const vPoint = projection.fromLatLngToPoint(new google.maps.LatLng(v.lat, v.lng));
            if (vPoint) {
              const dx = (mousePoint.x - vPoint.x) * scale;
              const dy = (mousePoint.y - vPoint.y) * scale;
              const distPx = Math.sqrt(dx * dx + dy * dy);
              if (distPx < SNAP_THRESHOLD_PX) {
                // Snap preview line to this vertex
                previewLineRef.current.setPath([
                  { lat: startVertex.lat, lng: startVertex.lng },
                  { lat: v.lat, lng: v.lng },
                ]);
                // Show snap highlight
                if (snapHighlightRef.current) {
                  snapHighlightRef.current.setPosition({ lat: v.lat, lng: v.lng });
                  snapHighlightRef.current.setMap(map);
                }
                snappedToVertex = true;
                break;
              }
            }
          }
        }
      }

      if (!snappedToVertex) {
        previewLineRef.current.setPath([
          { lat: startVertex.lat, lng: startVertex.lng },
          { lat: mouseLatLng.lat(), lng: mouseLatLng.lng() },
        ]);
        if (snapHighlightRef.current) {
          snapHighlightRef.current.setMap(null);
        }
      }
    });

    return () => {
      google.maps.event.removeListener(moveListener);
      if (previewLineRef.current) {
        previewLineRef.current.setMap(null);
        previewLineRef.current = null;
      }
      if (snapHighlightRef.current) {
        snapHighlightRef.current.setMap(null);
        snapHighlightRef.current = null;
      }
    };
  }, [drawingMode, edgeStartVertexId, activeMeasurement?.vertices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const [, marker] of markersRef.current) {
        if ('setMap' in marker) (marker as google.maps.Marker).setMap(null);
      }
      for (const [, m] of outlineMarkersRef.current) m.setMap(null);
      for (const [, line] of polylinesRef.current) line.setMap(null);
      for (const [, polygon] of polygonsRef.current) polygon.setMap(null);
      for (const [, m] of edgeLabelsRef.current) m.setMap(null);
      for (const [, m] of facetLabelsRef.current) m.setMap(null);
      if (outlinePolylineRef.current) outlinePolylineRef.current.setMap(null);
      if (tempLineRef.current) tempLineRef.current.setMap(null);
      if (previewLineRef.current) previewLineRef.current.setMap(null);
      if (snapHighlightRef.current) snapHighlightRef.current.setMap(null);
    };
  }, []);

  // Show placeholder if no API key
  if (!apiKey || error) {
    return <PlaceholderMap />;
  }

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-skyhawk-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading satellite imagery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Map type selector */}
      <div className="absolute top-3 right-3 bg-gray-900/90 backdrop-blur rounded-lg overflow-hidden flex border border-gray-700/50 z-10">
        {(['satellite', 'hybrid', 'roadmap'] as const).map((type) => (
          <button
            key={type}
            onClick={() => useStore.getState().setMapType(type)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              mapType === type
                ? 'bg-skyhawk-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Measurement stats overlay */}
      {activeMeasurement && activeMeasurement.facets.length > 0 && (
        <div className="absolute top-3 left-3 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700/50 z-10 px-3 py-2">
          <div className="flex items-center gap-4 text-[10px]">
            <div className="text-center">
              <div className="text-gray-500 uppercase tracking-wider">Area</div>
              <div className="text-white font-semibold text-xs">{Math.round(activeMeasurement.totalTrueAreaSqFt).toLocaleString()} sf</div>
            </div>
            <div className="w-px h-6 bg-gray-700" />
            <div className="text-center">
              <div className="text-gray-500 uppercase tracking-wider">Squares</div>
              <div className="text-white font-semibold text-xs">{activeMeasurement.totalSquares.toFixed(1)}</div>
            </div>
            <div className="w-px h-6 bg-gray-700" />
            <div className="text-center">
              <div className="text-gray-500 uppercase tracking-wider">Pitch</div>
              <div className="text-white font-semibold text-xs">{activeMeasurement.predominantPitch}/12</div>
            </div>
            <div className="w-px h-6 bg-gray-700" />
            <div className="text-center">
              <div className="text-gray-500 uppercase tracking-wider">Perimeter</div>
              <div className="text-white font-semibold text-xs">{Math.round(activeMeasurement.totalDripEdgeLf).toLocaleString()} lf</div>
            </div>
          </div>
        </div>
      )}

      {/* Drawing mode indicator */}
      {drawingMode !== 'pan' && drawingMode !== 'select' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur px-4 py-2 rounded-lg border border-gray-700/50 z-10">
          <p className="text-sm text-gray-300">
            <span className="text-skyhawk-400 font-medium">
              {drawingMode === 'outline' ? 'Drawing Outline' : `Drawing ${drawingMode.charAt(0).toUpperCase() + drawingMode.slice(1)}`}
            </span>
            {drawingMode === 'outline'
              ? ' — Click to place points, click first point to close'
              : ' — Click vertices to create line'}
          </p>
        </div>
      )}

      {/* Edge start indicator */}
      {edgeStartVertexId && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-blue-900/90 backdrop-blur px-4 py-2 rounded-lg border border-blue-700/50 z-10">
          <p className="text-sm text-blue-300">
            Click another vertex to complete the {drawingMode} line
          </p>
        </div>
      )}
    </div>
  );
}
