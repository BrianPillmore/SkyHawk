import { useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { EDGE_COLORS } from '../../utils/colors';
import type { RoofMeasurement, RoofFacet, RoofEdge, RoofVertex } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const METERS_PER_DEG_LAT = 111_320;
const SCALE = 1; // 1 scene unit = 1 meter

/** Blue/gray palette for facets */
const FACET_PALETTE = [
  '#4a7cbb', // steel blue
  '#5b8fc9', // muted blue
  '#6e9ecf', // soft blue
  '#7baed6', // light blue
  '#8fb8d4', // sky blue
  '#7c94a8', // blue-gray
  '#6b8296', // slate
  '#8da4b8', // ash blue
];

const FACET_SELECTED_COLOR = '#f59e0b'; // amber highlight
const FACET_OPACITY = 0.85;
const FACET_SELECTED_OPACITY = 0.95;

// ─── Geometry helpers ─────────────────────────────────────────────────────────

interface LocalVertex {
  id: string;
  x: number; // east (meters from centroid)
  z: number; // south (meters from centroid)
}

interface LocalVertex3D extends LocalVertex {
  y: number; // elevation
}

/**
 * Convert lat/lng vertices to local X/Z coordinates in meters,
 * centered on the centroid of all vertices.
 */
function toLocalCoords(vertices: RoofVertex[]): { locals: LocalVertex[]; centroidLat: number; centroidLng: number } {
  if (vertices.length === 0) return { locals: [], centroidLat: 0, centroidLng: 0 };

  const centroidLat = vertices.reduce((s, v) => s + v.lat, 0) / vertices.length;
  const centroidLng = vertices.reduce((s, v) => s + v.lng, 0) / vertices.length;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((centroidLat * Math.PI) / 180);

  const locals = vertices.map((v) => ({
    id: v.id,
    x: (v.lng - centroidLng) * metersPerDegLng * SCALE,
    z: -(v.lat - centroidLat) * METERS_PER_DEG_LAT * SCALE, // negate so north is -Z
  }));

  return { locals, centroidLat, centroidLng };
}

/**
 * For a facet, compute a Y (height) value for each vertex based on pitch.
 *
 * Strategy:
 * 1. Find eave edges on this facet (or lowest edges)
 * 2. Compute the "base line" from the eave vertices
 * 3. For each vertex, Y = distance_from_base * tan(pitch_angle)
 *
 * Simpler heuristic used here:
 * - Find the facet's centroid direction to overall roof center (reversed = outward facing)
 * - The eave side faces outward; vertices further from the eave get height from pitch
 */
function computeFacetHeights(
  facet: RoofFacet,
  vertexMap: Map<string, LocalVertex>,
  edges: RoofEdge[],
): LocalVertex3D[] {
  const facetVerts = facet.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean) as LocalVertex[];
  if (facetVerts.length === 0) return [];

  const pitchAngle = Math.atan(facet.pitch / 12);

  // Find eave edges belonging to this facet
  const facetEdgeSet = new Set(facet.edgeIds);
  const eaveEdges = edges.filter(
    (e) => facetEdgeSet.has(e.id) && (e.type === 'eave' || e.type === 'rake'),
  );

  // Collect eave vertex IDs
  const eaveVertexIds = new Set<string>();
  for (const e of eaveEdges) {
    eaveVertexIds.add(e.startVertexId);
    eaveVertexIds.add(e.endVertexId);
  }

  // If we found eave vertices, use them as the base (y=0); otherwise fall back to
  // the vertices farthest from the roof centroid
  let baseVertices: LocalVertex[];
  if (eaveVertexIds.size >= 2) {
    baseVertices = facetVerts.filter((v) => eaveVertexIds.has(v.id));
  } else {
    // Fallback: use the two vertices farthest from overall centroid
    const sorted = [...facetVerts].sort((a, b) => {
      const dA = a.x * a.x + a.z * a.z;
      const dB = b.x * b.x + b.z * b.z;
      return dB - dA;
    });
    baseVertices = sorted.slice(0, Math.max(2, Math.floor(sorted.length / 2)));
  }

  if (baseVertices.length === 0) {
    return facetVerts.map((v) => ({ ...v, y: 0 }));
  }

  // Compute base line centroid
  const baseCx = baseVertices.reduce((s, v) => s + v.x, 0) / baseVertices.length;
  const baseCz = baseVertices.reduce((s, v) => s + v.z, 0) / baseVertices.length;

  // Compute a perpendicular direction from the base line pointing "inward"
  // For the base direction, use the line between the first and last base vertices
  let dirX: number;
  let dirZ: number;

  if (baseVertices.length >= 2) {
    const dx = baseVertices[baseVertices.length - 1].x - baseVertices[0].x;
    const dz = baseVertices[baseVertices.length - 1].z - baseVertices[0].z;
    // Perpendicular (rotate 90 degrees)
    dirX = -dz;
    dirZ = dx;
  } else {
    // Single base vertex: point toward facet centroid
    const cx = facetVerts.reduce((s, v) => s + v.x, 0) / facetVerts.length;
    const cz = facetVerts.reduce((s, v) => s + v.z, 0) / facetVerts.length;
    dirX = cx - baseCx;
    dirZ = cz - baseCz;
  }

  const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
  dirX /= dirLen;
  dirZ /= dirLen;

  // Make sure the direction points toward the non-base vertices (inward/upward)
  const nonBaseVerts = facetVerts.filter((v) => !baseVertices.includes(v));
  if (nonBaseVerts.length > 0) {
    const nbCx = nonBaseVerts.reduce((s, v) => s + v.x, 0) / nonBaseVerts.length;
    const nbCz = nonBaseVerts.reduce((s, v) => s + v.z, 0) / nonBaseVerts.length;
    const toNonBase = (nbCx - baseCx) * dirX + (nbCz - baseCz) * dirZ;
    if (toNonBase < 0) {
      dirX = -dirX;
      dirZ = -dirZ;
    }
  }

  // Project each vertex onto the direction vector to get distance from base
  return facetVerts.map((v) => {
    const relX = v.x - baseCx;
    const relZ = v.z - baseCz;
    const dist = relX * dirX + relZ * dirZ;
    const height = Math.max(0, dist) * Math.tan(pitchAngle);
    return { ...v, y: height };
  });
}

/**
 * Triangulate a simple polygon defined by ordered vertices.
 * Uses a basic ear-clipping approach projected onto the XZ plane.
 */
function triangulatePolygon(vertices: LocalVertex3D[]): number[] {
  if (vertices.length < 3) return [];
  if (vertices.length === 3) return [0, 1, 2];

  // Simple fan triangulation (works for convex and mostly-convex polygons)
  const indices: number[] = [];
  for (let i = 1; i < vertices.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
  return indices;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FacetMeshProps {
  vertices3D: LocalVertex3D[];
  color: string;
  isSelected: boolean;
  onClick: () => void;
  label: string;
}

function FacetMesh({ vertices3D, color, isSelected, onClick, label }: FacetMeshProps) {
  if (vertices3D.length < 3) return null;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(vertices3D.length * 3);
    for (let i = 0; i < vertices3D.length; i++) {
      positions[i * 3] = vertices3D[i].x;
      positions[i * 3 + 1] = vertices3D[i].y;
      positions[i * 3 + 2] = vertices3D[i].z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const indices = triangulatePolygon(vertices3D);
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [vertices3D]);

  // Compute centroid for the label
  const centroid = useMemo(() => {
    const cx = vertices3D.reduce((s, v) => s + v.x, 0) / vertices3D.length;
    const cy = vertices3D.reduce((s, v) => s + v.y, 0) / vertices3D.length;
    const cz = vertices3D.reduce((s, v) => s + v.z, 0) / vertices3D.length;
    return new THREE.Vector3(cx, cy + 0.15, cz);
  }, [vertices3D]);

  const meshColor = isSelected ? FACET_SELECTED_COLOR : color;
  const opacity = isSelected ? FACET_SELECTED_OPACITY : FACET_OPACITY;

  return (
    <group>
      {/* Front face */}
      <mesh geometry={geometry} onClick={onClick}>
        <meshStandardMaterial
          color={meshColor}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Wireframe overlay */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={isSelected ? '#fbbf24' : '#1e3a5f'}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
      {/* Facet label */}
      <Text
        position={centroid}
        fontSize={0.4}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}

interface EdgeLineProps {
  start: LocalVertex3D;
  end: LocalVertex3D;
  edge: RoofEdge;
}

function EdgeLine({ start, end, edge }: EdgeLineProps) {
  const color = EDGE_COLORS[edge.type] || '#ffffff';

  const midpoint = useMemo(
    () =>
      new THREE.Vector3(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2 + 0.25,
        (start.z + end.z) / 2,
      ),
    [start, end],
  );

  const lengthLabel = `${edge.lengthFt.toFixed(1)}'`;

  return (
    <group>
      <Line
        points={[
          [start.x, start.y + 0.02, start.z],
          [end.x, end.y + 0.02, end.z],
        ]}
        color={color}
        lineWidth={2.5}
      />
      <Text
        position={midpoint}
        fontSize={0.25}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {lengthLabel}
      </Text>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

interface RoofSceneProps {
  measurement: RoofMeasurement;
  selectedFacetId: string | null;
  onSelectFacet: (id: string) => void;
}

function RoofScene({ measurement, selectedFacetId, onSelectFacet }: RoofSceneProps) {
  const { vertices, edges, facets } = measurement;

  const { vertex3DMap, facetVertices, sceneRadius } = useMemo(() => {
    const { locals } = toLocalCoords(vertices);

    // Build a map of vertex id -> local 2D position
    const lMap = new Map<string, LocalVertex>();
    for (const lv of locals) {
      lMap.set(lv.id, lv);
    }

    // Compute 3D vertices for each facet
    const fVerts = new Map<string, LocalVertex3D[]>();
    const v3DMap = new Map<string, LocalVertex3D>();

    for (const facet of facets) {
      const verts3D = computeFacetHeights(facet, lMap, edges);
      fVerts.set(facet.id, verts3D);
      for (const v of verts3D) {
        // If a vertex appears in multiple facets, keep the max height
        const existing = v3DMap.get(v.id);
        if (!existing || v.y > existing.y) {
          v3DMap.set(v.id, v);
        }
      }
    }

    // Assign y=0 for any vertices not in any facet
    for (const lv of locals) {
      if (!v3DMap.has(lv.id)) {
        v3DMap.set(lv.id, { ...lv, y: 0 });
      }
    }

    // Compute scene radius for camera positioning
    let maxDist = 1;
    for (const lv of locals) {
      const d = Math.sqrt(lv.x * lv.x + lv.z * lv.z);
      if (d > maxDist) maxDist = d;
    }

    return { vertex3DMap: v3DMap, facetVertices: fVerts, sceneRadius: maxDist };
  }, [vertices, edges, facets]);

  const cameraDistance = Math.max(sceneRadius * 2.5, 8);

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera
        makeDefault
        position={[cameraDistance * 0.6, cameraDistance * 0.8, cameraDistance * 0.6]}
        fov={50}
        near={0.1}
        far={cameraDistance * 10}
      />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={1}
        maxDistance={cameraDistance * 4}
      />

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.0} castShadow />
      <directionalLight position={[-5, 15, -10]} intensity={0.3} />

      {/* Ground grid */}
      <Grid
        position={[0, -0.01, 0]}
        args={[sceneRadius * 6, sceneRadius * 6]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={sceneRadius * 4}
        fadeStrength={1.5}
        infiniteGrid={false}
        side={THREE.DoubleSide}
      />

      {/* Facet meshes */}
      {facets.map((facet, i) => {
        const verts = facetVertices.get(facet.id);
        if (!verts || verts.length < 3) return null;

        return (
          <FacetMesh
            key={facet.id}
            vertices3D={verts}
            color={FACET_PALETTE[i % FACET_PALETTE.length]}
            isSelected={selectedFacetId === facet.id}
            onClick={() => onSelectFacet(facet.id)}
            label={facet.name}
          />
        );
      })}

      {/* Edge lines */}
      {edges.map((edge) => {
        const startV = vertex3DMap.get(edge.startVertexId);
        const endV = vertex3DMap.get(edge.endVertexId);
        if (!startV || !endV) return null;
        return <EdgeLine key={edge.id} start={startV} end={endV} edge={edge} />;
      })}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RoofViewer3DProps {
  measurement: RoofMeasurement;
  selectedFacetId?: string | null;
  onSelectFacet?: (id: string) => void;
}

export default function RoofViewer3D({
  measurement,
  selectedFacetId = null,
  onSelectFacet,
}: RoofViewer3DProps) {
  const [visible, setVisible] = useState(false);
  const [internalSelectedFacet, setInternalSelectedFacet] = useState<string | null>(null);

  const activeFacetId = selectedFacetId ?? internalSelectedFacet;

  const handleSelectFacet = useCallback(
    (id: string) => {
      if (onSelectFacet) {
        onSelectFacet(id);
      } else {
        setInternalSelectedFacet((prev) => (prev === id ? null : id));
      }
    },
    [onSelectFacet],
  );

  const hasFacets = measurement.facets.length > 0;

  return (
    <div className="w-full">
      {/* Toggle button */}
      <button
        onClick={() => setVisible((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
          visible
            ? 'bg-skyhawk-900/30 border-skyhawk-600 text-skyhawk-300'
            : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8A2 2 0 0 0 22 17.87v-3.24a2 2 0 0 0-.97-1.71L18 11.13V7.5a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8A2 2 0 0 0 8 7.5v3.63l-5.03 1.79Z" />
            <path d="m12 19-3.97-2.38" />
            <path d="m12 19 3.97-2.38" />
            <path d="M12 19v3.38" />
            <path d="m12 13-3.97 2.38" />
            <path d="m12 13 3.97 2.38" />
            <path d="M12 13V9.62" />
          </svg>
          3D Roof Model
        </span>
        <span>{visible ? '\u25B4' : '\u25BE'}</span>
      </button>

      {/* 3D Viewer */}
      {visible && (
        <div
          className="mt-2 rounded-lg overflow-hidden border border-gray-700/50 bg-gray-950"
          style={{ height: 300 }}
        >
          {!hasFacets ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              No facets available. Draw roof facets to see the 3D model.
            </div>
          ) : (
            <Canvas
              gl={{ antialias: true, alpha: false }}
              style={{ background: '#0f172a' }}
            >
              <RoofScene
                measurement={measurement}
                selectedFacetId={activeFacetId}
                onSelectFacet={handleSelectFacet}
              />
            </Canvas>
          )}
        </div>
      )}
    </div>
  );
}
