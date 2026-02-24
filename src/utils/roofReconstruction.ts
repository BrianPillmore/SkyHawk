import type { LatLng } from '../types';
import type { SolarRoofSegment, RoofType, ReconstructedRoof } from '../types/solar';
import { degreesToPitch, toRadians, getCentroid, latLngToLocalFt, haversineDistanceFt, clampPitch } from './geometry';
import { localFtToLatLng, bearing, findLinePolygonIntersections } from './geometryHelpers';

/**
 * Filter to dominant roof segments.
 * The Solar API often returns many small segments (edges, dormers, chimneys).
 * We keep segments that represent significant portions of the roof area.
 */
export function filterDominantSegments(segments: SolarRoofSegment[]): SolarRoofSegment[] {
  if (segments.length <= 4) return segments;

  const totalArea = segments.reduce((sum, s) => sum + s.stats.areaMeters2, 0);

  // Keep segments that are at least 5% of total roof area AND have reasonable pitch (< 70 degrees)
  const dominant = segments.filter(
    (s) => s.stats.areaMeters2 >= totalArea * 0.05 && s.pitchDegrees < 70
  );

  // If we filtered too aggressively, take the top 4 by area
  if (dominant.length === 0) {
    return [...segments].sort((a, b) => b.stats.areaMeters2 - a.stats.areaMeters2).slice(0, 4);
  }

  return dominant;
}

/**
 * Classify roof type from Solar API roof segments.
 * Filters to dominant segments first to avoid misclassifying complex roofs
 * that have many small segments from dormers, chimneys, etc.
 */
export function classifyRoofType(segments: SolarRoofSegment[]): RoofType {
  if (segments.length === 0) return 'flat';

  // Filter to dominant segments for classification
  const dominant = filterDominantSegments(segments);

  // Check if all dominant segments are essentially flat (pitch < 5 degrees)
  const allFlat = dominant.every((s) => s.pitchDegrees < 5);
  if (allFlat) return 'flat';

  // Filter out flat segments for slope-based classification
  const slopedSegments = dominant.filter((s) => s.pitchDegrees >= 5);

  if (slopedSegments.length === 0) return 'flat';
  if (slopedSegments.length === 1) return 'shed';

  if (slopedSegments.length === 2) {
    // Check if opposing azimuths (~180 deg apart) -> gable
    const azDiff = Math.abs(slopedSegments[0].azimuthDegrees - slopedSegments[1].azimuthDegrees);
    const normalizedDiff = Math.min(azDiff, 360 - azDiff);
    if (normalizedDiff > 150 && normalizedDiff < 210) return 'gable';
  }

  if (slopedSegments.length === 4) {
    // Sort azimuths and check for ~90 degree spacing -> hip
    const azimuths = slopedSegments.map((s) => s.azimuthDegrees).sort((a, b) => a - b);
    const diffs = [];
    for (let i = 0; i < azimuths.length; i++) {
      const next = azimuths[(i + 1) % azimuths.length];
      const curr = azimuths[i];
      diffs.push(((next - curr + 360) % 360));
    }
    const allNear90 = diffs.every((d) => d > 60 && d < 120);
    if (allNear90) return 'hip';
  }

  // Check for cross-gable: 2 pairs of opposing azimuths
  if (slopedSegments.length >= 3 && slopedSegments.length <= 4) {
    const pairs = findOpposingPairs(slopedSegments);
    if (pairs >= 2) return 'cross-gable';
  }

  // For 2 sloped segments that aren't opposing, still classify as gable
  if (slopedSegments.length === 2) return 'gable';

  return 'complex';
}

function findOpposingPairs(segments: SolarRoofSegment[]): number {
  let pairs = 0;
  const used = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < segments.length; j++) {
      if (used.has(j)) continue;
      const diff = Math.abs(segments[i].azimuthDegrees - segments[j].azimuthDegrees);
      const normalized = Math.min(diff, 360 - diff);
      if (normalized > 150 && normalized < 210) {
        pairs++;
        used.add(i);
        used.add(j);
        break;
      }
    }
  }
  return pairs;
}

/**
 * Reconstruct a gable roof from outline + 2 segments.
 * The ridge runs perpendicular to the segment azimuths, along the longer axis.
 */
export function reconstructGableRoof(
  outline: LatLng[],
  segments: SolarRoofSegment[]
): ReconstructedRoof {
  const centroid = getCentroid(outline);

  // Ridge direction: perpendicular to the average azimuth of the two segments
  const avgAzimuth = (segments[0].azimuthDegrees + segments[1].azimuthDegrees) / 2;
  const ridgeBearingDeg = (avgAzimuth + 90) % 360;

  // Find where the ridge line intersects the building outline
  const intersections = findLinePolygonIntersections(centroid, toRadians(ridgeBearingDeg), outline);

  if (intersections.length < 2) {
    // Fallback: use outline as-is with a simple reconstruction
    return reconstructSimpleRoof(outline, segments);
  }

  // Ridge endpoints
  const ridgeStart = intersections[0];
  const ridgeEnd = intersections[intersections.length - 1];

  // Build vertices: outline vertices + ridge endpoints
  const vertices: LatLng[] = [...outline, ridgeStart, ridgeEnd];
  const ridgeStartIdx = outline.length;
  const ridgeEndIdx = outline.length + 1;

  // Classify outline edges and build facets
  const edges: ReconstructedRoof['edges'] = [];
  const facets: ReconstructedRoof['facets'] = [];

  // Ridge edge
  edges.push({ startIndex: ridgeStartIdx, endIndex: ridgeEndIdx, type: 'ridge' });

  // Split outline vertices into two groups by which side of the ridge they're on
  const localPoints = outline.map((p) => latLngToLocalFt(p, centroid));
  const ridgeLocalStart = latLngToLocalFt(ridgeStart, centroid);
  const ridgeLocalEnd = latLngToLocalFt(ridgeEnd, centroid);

  const ridgeDx = ridgeLocalEnd.x - ridgeLocalStart.x;
  const ridgeDy = ridgeLocalEnd.y - ridgeLocalStart.y;

  const side1: number[] = [];
  const side2: number[] = [];

  for (let i = 0; i < localPoints.length; i++) {
    const cross =
      ridgeDx * (localPoints[i].y - ridgeLocalStart.y) -
      ridgeDy * (localPoints[i].x - ridgeLocalStart.x);
    if (cross >= 0) {
      side1.push(i);
    } else {
      side2.push(i);
    }
  }

  // Add outline edges (eave/rake classification)
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    // Edges parallel to ridge are eaves, perpendicular are rakes
    const edgeBearing = bearing(outline[i], outline[j]);
    const ridgeBearingRad = toRadians(ridgeBearingDeg);
    const angleDiff = Math.abs(edgeBearing - ridgeBearingRad);
    const normalizedAngle = Math.min(angleDiff, Math.PI * 2 - angleDiff);

    const type = normalizedAngle < Math.PI / 4 || normalizedAngle > (3 * Math.PI) / 4 ? 'rake' : 'eave';
    edges.push({ startIndex: i, endIndex: j, type });
  }

  // Create two facets
  const pitch0 = clampPitch(degreesToPitch(segments[0].pitchDegrees));
  const pitch1 = clampPitch(degreesToPitch(segments[1].pitchDegrees));

  if (side1.length >= 2) {
    facets.push({
      vertexIndices: [...side1, ridgeStartIdx, ridgeEndIdx],
      pitch: Math.round(pitch0 * 10) / 10,
      name: 'Facet 1',
    });
  }
  if (side2.length >= 2) {
    facets.push({
      vertexIndices: [...side2, ridgeStartIdx, ridgeEndIdx],
      pitch: Math.round(pitch1 * 10) / 10,
      name: 'Facet 2',
    });
  }

  return {
    vertices,
    edges,
    facets,
    roofType: 'gable',
    confidence: 'high',
  };
}

/**
 * Reconstruct a hip roof from outline + 4 segments.
 */
export function reconstructHipRoof(
  outline: LatLng[],
  segments: SolarRoofSegment[]
): ReconstructedRoof {
  const centroid = getCentroid(outline);

  // Sort segments by area (largest first = main slopes)
  const sorted = [...segments].sort(
    (a, b) => b.stats.areaMeters2 - a.stats.areaMeters2
  );

  // Main segments determine ridge direction
  const main1 = sorted[0];
  const main2 = sorted[1];
  const avgAzimuth = (main1.azimuthDegrees + main2.azimuthDegrees) / 2;
  const ridgeBearingDeg = (avgAzimuth + 90) % 360;
  const ridgeBearingRad = toRadians(ridgeBearingDeg);

  // Find outline bounding box in local coordinates
  const localOutline = outline.map((p) => latLngToLocalFt(p, centroid));
  const minX = Math.min(...localOutline.map((p) => p.x));
  const maxX = Math.max(...localOutline.map((p) => p.x));
  const minY = Math.min(...localOutline.map((p) => p.y));
  const maxY = Math.max(...localOutline.map((p) => p.y));

  const buildingWidth = maxX - minX;
  const buildingHeight = maxY - minY;

  // Ridge length is typically building_length - building_width for a hip roof
  const longerDim = Math.max(buildingWidth, buildingHeight);
  const shorterDim = Math.min(buildingWidth, buildingHeight);
  const ridgeHalfLen = Math.max((longerDim - shorterDim) / 2, longerDim * 0.1);

  // Ridge endpoints in local coords, then convert to LatLng
  const cosR = Math.cos(ridgeBearingRad);
  const sinR = Math.sin(ridgeBearingRad);
  const ridgeStartLocal = { x: -ridgeHalfLen * sinR, y: ridgeHalfLen * cosR };
  const ridgeEndLocal = { x: ridgeHalfLen * sinR, y: -ridgeHalfLen * cosR };

  const ridgeStart = localFtToLatLng(ridgeStartLocal.x, ridgeStartLocal.y, centroid);
  const ridgeEnd = localFtToLatLng(ridgeEndLocal.x, ridgeEndLocal.y, centroid);

  // Build vertex list
  const vertices: LatLng[] = [...outline, ridgeStart, ridgeEnd];
  const ridgeStartIdx = outline.length;
  const ridgeEndIdx = outline.length + 1;

  const edges: ReconstructedRoof['edges'] = [];

  // Ridge edge
  edges.push({ startIndex: ridgeStartIdx, endIndex: ridgeEndIdx, type: 'ridge' });

  // Find the nearest outline corners to each ridge endpoint -> hip lines
  const ridgeStartLocal2 = latLngToLocalFt(ridgeStart, centroid);
  const ridgeEndLocal2 = latLngToLocalFt(ridgeEnd, centroid);

  const nearestToStart = findNearestCorners(localOutline, ridgeStartLocal2, 2);
  const nearestToEnd = findNearestCorners(localOutline, ridgeEndLocal2, 2);

  for (const idx of nearestToStart) {
    edges.push({ startIndex: ridgeStartIdx, endIndex: idx, type: 'hip' });
  }
  for (const idx of nearestToEnd) {
    edges.push({ startIndex: ridgeEndIdx, endIndex: idx, type: 'hip' });
  }

  // Outline edges are eaves
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    edges.push({ startIndex: i, endIndex: j, type: 'eave' });
  }

  // Create 4 facets (approximate)
  const facets: ReconstructedRoof['facets'] = [];
  const avgPitch = segments.reduce((s, seg) => s + seg.pitchDegrees, 0) / segments.length;
  const pitch = clampPitch(Math.round(degreesToPitch(avgPitch) * 10) / 10);

  // Split outline into 4 groups based on quadrant relative to ridge
  const allOutlineIndices = outline.map((_, i) => i);

  // Group vertices into 4 facets based on their position
  const groups = splitOutlineForHip(allOutlineIndices, nearestToStart, nearestToEnd);
  groups.forEach((group, i) => {
    if (group.length >= 2) {
      facets.push({
        vertexIndices: [...group, ridgeStartIdx, ridgeEndIdx],
        pitch,
        name: `Facet ${i + 1}`,
      });
    }
  });

  // If we couldn't create 4 facets, create at least 1 with all vertices
  if (facets.length === 0) {
    facets.push({
      vertexIndices: allOutlineIndices,
      pitch,
      name: 'Facet 1',
    });
  }

  return {
    vertices,
    edges,
    facets,
    roofType: 'hip',
    confidence: 'high',
  };
}

function findNearestCorners(
  localPoints: { x: number; y: number }[],
  target: { x: number; y: number },
  count: number
): number[] {
  const distances = localPoints.map((p, i) => ({
    idx: i,
    dist: Math.hypot(p.x - target.x, p.y - target.y),
  }));
  distances.sort((a, b) => a.dist - b.dist);
  return distances.slice(0, count).map((d) => d.idx);
}

function splitOutlineForHip(
  indices: number[],
  startCorners: number[],
  endCorners: number[]
): number[][] {
  // Simple split: divide outline indices into segments between hip corners
  const splitPoints = [...startCorners, ...endCorners].sort((a, b) => a - b);
  if (splitPoints.length < 2) return [indices];

  const groups: number[][] = [];
  for (let s = 0; s < splitPoints.length; s++) {
    const group: number[] = [];
    const start = splitPoints[s];
    const end = splitPoints[(s + 1) % splitPoints.length];

    if (end > start) {
      for (let i = start; i <= end; i++) group.push(indices[i]);
    } else {
      for (let i = start; i < indices.length; i++) group.push(indices[i]);
      for (let i = 0; i <= end; i++) group.push(indices[i]);
    }
    groups.push(group);
  }

  return groups;
}

/**
 * Reconstruct a simple (flat/shed) roof: single facet with outline as boundary.
 */
export function reconstructSimpleRoof(
  outline: LatLng[],
  segments: SolarRoofSegment[]
): ReconstructedRoof {
  const vertices = [...outline];
  const edges: ReconstructedRoof['edges'] = [];

  // All outline edges are eaves
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    edges.push({ startIndex: i, endIndex: j, type: 'eave' });
  }

  const pitchDeg = segments.length > 0
    ? segments.reduce((s, seg) => s + seg.pitchDegrees, 0) / segments.length
    : 0;

  return {
    vertices,
    edges,
    facets: [{
      vertexIndices: outline.map((_, i) => i),
      pitch: clampPitch(Math.round(degreesToPitch(pitchDeg) * 10) / 10),
      name: 'Facet 1',
    }],
    roofType: segments.length <= 1 && pitchDeg >= 5 ? 'shed' : 'flat',
    confidence: 'medium',
  };
}

/**
 * Detect whether segment centers are clustered (too close together for
 * distance-based Voronoi to produce multiple facets).
 * Returns true when the maximum inter-center distance is less than 25%
 * of the building outline's bounding diagonal.
 */
export function areSegmentsClustered(
  outline: LatLng[],
  segCenters: LatLng[],
): boolean {
  if (segCenters.length <= 1) return true;

  // Building bounding diagonal
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const v of outline) {
    if (v.lat < minLat) minLat = v.lat;
    if (v.lat > maxLat) maxLat = v.lat;
    if (v.lng < minLng) minLng = v.lng;
    if (v.lng > maxLng) maxLng = v.lng;
  }
  const diagFt = haversineDistanceFt(
    { lat: minLat, lng: minLng },
    { lat: maxLat, lng: maxLng },
  );
  if (diagFt === 0) return true;

  // Maximum distance between any two segment centers
  let maxCenterDist = 0;
  for (let i = 0; i < segCenters.length; i++) {
    for (let j = i + 1; j < segCenters.length; j++) {
      const d = haversineDistanceFt(segCenters[i], segCenters[j]);
      if (d > maxCenterDist) maxCenterDist = d;
    }
  }

  return maxCenterDist < diagFt * 0.25;
}

/**
 * Azimuth-based vertex assignment for when segment centers are clustered.
 * Each outline vertex is assigned to the segment whose *downslope azimuth*
 * direction most closely matches the bearing from the roof centroid to the vertex.
 *
 * The azimuth of a roof segment points in the direction water would flow
 * (downslope). Vertices on that side of the building "belong" to that segment.
 */
export function assignVerticesByAzimuth(
  outline: LatLng[],
  segments: SolarRoofSegment[],
  centroid: LatLng,
): number[][] {
  const segGroups: number[][] = segments.map(() => []);

  for (let i = 0; i < outline.length; i++) {
    // Bearing from centroid to this vertex (radians, 0 = north, clockwise)
    const bearingRad = bearing(centroid, outline[i]);
    const bearingDeg = ((bearingRad * 180 / Math.PI) + 360) % 360;

    let bestSeg = 0;
    let bestAngleDiff = Infinity;

    for (let s = 0; s < segments.length; s++) {
      // Segment azimuth is the downslope direction
      const azDeg = segments[s].azimuthDegrees;
      const diff = Math.abs(bearingDeg - azDeg);
      const normalizedDiff = Math.min(diff, 360 - diff);
      if (normalizedDiff < bestAngleDiff) {
        bestAngleDiff = normalizedDiff;
        bestSeg = s;
      }
    }
    segGroups[bestSeg].push(i);
  }

  return segGroups;
}

/**
 * Reconstruct a complex roof by creating one facet per Solar API segment.
 * Uses a hybrid partitioning strategy:
 * - When segment centers are well-spread: Voronoi (nearest-center) assignment
 * - When segment centers are clustered: azimuth-based assignment
 * Creates ridge/hip/valley edges between adjacent segments based on azimuth analysis.
 */
export function reconstructComplexRoof(
  outline: LatLng[],
  segments: SolarRoofSegment[]
): ReconstructedRoof {
  // Fewer than 2 segments → fall back to simple
  if (segments.length <= 1) {
    return reconstructSimpleRoof(outline, segments);
  }

  const centroid = getCentroid(outline);
  const vertices: LatLng[] = [...outline];
  const edges: ReconstructedRoof['edges'] = [];
  const facets: ReconstructedRoof['facets'] = [];

  // Convert segment centers to LatLng and add as interior vertices
  const segCenterIndices: number[] = [];
  const segCenters: LatLng[] = segments.map((s) => ({
    lat: s.center.latitude,
    lng: s.center.longitude,
  }));

  for (const c of segCenters) {
    segCenterIndices.push(vertices.length);
    vertices.push(c);
  }

  // Choose partitioning strategy based on whether segment centers are clustered
  const clustered = areSegmentsClustered(outline, segCenters);
  let segGroups: number[][];

  if (clustered) {
    // Azimuth-based: assign vertices to the segment whose downslope direction
    // best matches the bearing from centroid to vertex
    segGroups = assignVerticesByAzimuth(outline, segments, centroid);
  } else {
    // Distance-based Voronoi: assign each outline vertex to nearest segment center
    segGroups = segments.map(() => []);
    for (let i = 0; i < outline.length; i++) {
      let bestSeg = 0;
      let bestDist = Infinity;
      for (let s = 0; s < segCenters.length; s++) {
        const d = haversineDistanceFt(outline[i], segCenters[s]);
        if (d < bestDist) {
          bestDist = d;
          bestSeg = s;
        }
      }
      segGroups[bestSeg].push(i);
    }
  }

  // If Voronoi/azimuth still produced only 1 non-empty group, try azimuth as backup
  const nonEmptyGroups = segGroups.filter(g => g.length >= 2).length;
  if (nonEmptyGroups <= 1 && !clustered) {
    segGroups = assignVerticesByAzimuth(outline, segments, centroid);
  }

  // Classify outline edges: eave or rake based on bearing vs nearest segment azimuth
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const mid = { lat: (outline[i].lat + outline[j].lat) / 2, lng: (outline[i].lng + outline[j].lng) / 2 };
    // Find nearest segment to this edge midpoint (use azimuth matching when clustered)
    let bestSeg = 0;
    if (clustered) {
      const bearingRad = bearing(centroid, mid);
      const bearingDeg = ((bearingRad * 180 / Math.PI) + 360) % 360;
      let bestDiff = Infinity;
      for (let s = 0; s < segments.length; s++) {
        const diff = Math.abs(bearingDeg - segments[s].azimuthDegrees);
        const normDiff = Math.min(diff, 360 - diff);
        if (normDiff < bestDiff) { bestDiff = normDiff; bestSeg = s; }
      }
    } else {
      let bestDist = Infinity;
      for (let s = 0; s < segCenters.length; s++) {
        const d = haversineDistanceFt(mid, segCenters[s]);
        if (d < bestDist) { bestDist = d; bestSeg = s; }
      }
    }
    const segAz = toRadians(segments[bestSeg].azimuthDegrees);
    const edgeBearing = bearing(outline[i], outline[j]);
    // Edge perpendicular to segment azimuth → rake, parallel → eave
    const angleDiff = Math.abs(edgeBearing - segAz);
    const normAngle = Math.min(angleDiff, Math.PI * 2 - angleDiff);
    const type = (normAngle < Math.PI / 4 || normAngle > (3 * Math.PI) / 4) ? 'eave' : 'rake';
    edges.push({ startIndex: i, endIndex: j, type });
  }

  // Create one facet per segment that has assigned outline vertices
  for (let s = 0; s < segments.length; s++) {
    const group = segGroups[s];
    if (group.length < 2) continue;
    const pitch = clampPitch(Math.round(degreesToPitch(segments[s].pitchDegrees) * 10) / 10);
    facets.push({
      vertexIndices: [...group, segCenterIndices[s]],
      pitch,
      name: `Facet ${facets.length + 1}`,
    });
  }

  // Determine adjacency between segments and add ridge/hip/valley edges
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (!areSegmentGroupsAdjacent(segGroups[i], segGroups[j], outline.length)) continue;

      const azDiff = Math.abs(segments[i].azimuthDegrees - segments[j].azimuthDegrees);
      const normDiff = Math.min(azDiff, 360 - azDiff);

      let edgeType: 'ridge' | 'hip' | 'valley';
      if (normDiff > 150) {
        // Opposing faces → ridge
        edgeType = 'ridge';
      } else if (normDiff > 60 && normDiff < 120) {
        // ~90° → hip
        edgeType = 'hip';
      } else {
        // Other → valley (cross-gable transitions, dormers)
        edgeType = 'valley';
      }
      edges.push({ startIndex: segCenterIndices[i], endIndex: segCenterIndices[j], type: edgeType });
    }
  }

  // Fallback: if still only 0-1 facets, create facets from Solar API areas directly
  if (facets.length <= 1 && segments.length >= 2) {
    return reconstructFromSolarApiAreas(outline, segments);
  }

  return {
    vertices,
    edges,
    facets,
    roofType: 'complex',
    confidence: facets.length >= segments.length ? 'medium' : 'low',
  };
}

/**
 * Fallback reconstruction that uses Solar API segment areas directly.
 * When geometric partitioning fails (clustered centers, all vertices assigned
 * to one segment), this creates facets with areas proportional to the
 * Solar API's reported areaMeters2 values by evenly splitting outline vertices.
 */
export function reconstructFromSolarApiAreas(
  outline: LatLng[],
  segments: SolarRoofSegment[]
): ReconstructedRoof {
  const centroid = getCentroid(outline);
  const vertices: LatLng[] = [...outline];
  const edges: ReconstructedRoof['edges'] = [];
  const facets: ReconstructedRoof['facets'] = [];

  // Add segment centers as interior vertices
  const segCenterIndices: number[] = [];
  for (const s of segments) {
    segCenterIndices.push(vertices.length);
    vertices.push({ lat: s.center.latitude, lng: s.center.longitude });
  }

  // Sort outline vertices by angle from centroid for ordered traversal
  const outlineWithAngles = outline.map((v, i) => {
    const b = bearing(centroid, v);
    const deg = ((b * 180 / Math.PI) + 360) % 360;
    return { idx: i, angleDeg: deg };
  });
  outlineWithAngles.sort((a, b) => a.angleDeg - b.angleDeg);
  const sortedIndices = outlineWithAngles.map(o => o.idx);

  // Sort segments by azimuth for consistent assignment
  const segOrder = segments.map((s, i) => ({ idx: i, az: s.azimuthDegrees }));
  segOrder.sort((a, b) => a.az - b.az);

  // Distribute sorted outline vertices to segments proportional to area.
  // Each segment needs at least 2 vertices. If we don't have enough vertices
  // to give 2 to every segment, limit the number of segments we can support.
  const totalArea = segments.reduce((sum, s) => sum + s.stats.areaMeters2, 0);
  const segGroups: number[][] = segments.map(() => []);
  const maxSegments = Math.min(segOrder.length, Math.floor(sortedIndices.length / 2));
  const activeSegOrder = segOrder.slice(0, maxSegments);

  // First pass: compute proportional counts with minimum 2
  const counts: number[] = activeSegOrder.map((s, si) => {
    if (si === activeSegOrder.length - 1) return 0; // placeholder for last
    const proportion = segments[s.idx].stats.areaMeters2 / totalArea;
    return Math.max(2, Math.round(sortedIndices.length * proportion));
  });

  // Ensure total doesn't exceed available vertices; last segment gets remainder
  const assignedSoFar = counts.slice(0, -1).reduce((a, b) => a + b, 0);
  counts[counts.length - 1] = Math.max(2, sortedIndices.length - assignedSoFar);

  // If we overallocated, trim from largest groups
  let totalCounts = counts.reduce((a, b) => a + b, 0);
  while (totalCounts > sortedIndices.length) {
    const maxIdx = counts.indexOf(Math.max(...counts));
    if (counts[maxIdx] <= 2) break;
    counts[maxIdx]--;
    totalCounts--;
  }

  let vertexOffset = 0;
  for (let si = 0; si < activeSegOrder.length; si++) {
    const segIdx = activeSegOrder[si].idx;
    const end = Math.min(vertexOffset + counts[si], sortedIndices.length);
    for (let v = vertexOffset; v < end; v++) {
      segGroups[segIdx].push(sortedIndices[v]);
    }
    vertexOffset = end;
  }

  // Outline edges
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    edges.push({ startIndex: i, endIndex: j, type: 'eave' });
  }

  // Create facets
  for (let s = 0; s < segments.length; s++) {
    const group = segGroups[s];
    if (group.length < 2) continue;
    const pitch = clampPitch(Math.round(degreesToPitch(segments[s].pitchDegrees) * 10) / 10);
    const areaM2 = segments[s].stats.areaMeters2;
    const areaSqFt = areaM2 * 10.7639;
    facets.push({
      vertexIndices: [...group, segCenterIndices[s]],
      pitch,
      name: `Facet ${facets.length + 1}`,
      trueArea3DSqFt: areaSqFt,
    });
  }

  // Internal edges between adjacent facets
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const azDiff = Math.abs(segments[i].azimuthDegrees - segments[j].azimuthDegrees);
      const normDiff = Math.min(azDiff, 360 - azDiff);

      let edgeType: 'ridge' | 'hip' | 'valley';
      if (normDiff > 150) edgeType = 'ridge';
      else if (normDiff > 60 && normDiff < 120) edgeType = 'hip';
      else edgeType = 'valley';
      edges.push({ startIndex: segCenterIndices[i], endIndex: segCenterIndices[j], type: edgeType });
    }
  }

  if (facets.length === 0) {
    const avgPitchDeg = segments.reduce((s, seg) => s + seg.pitchDegrees, 0) / segments.length;
    facets.push({
      vertexIndices: outline.map((_, i) => i),
      pitch: Math.round(degreesToPitch(avgPitchDeg) * 10) / 10,
      name: 'Facet 1',
    });
  }

  return {
    vertices,
    edges,
    facets,
    roofType: 'complex',
    confidence: facets.length > 1 ? 'medium' : 'low',
    dataSource: 'hybrid',
  };
}

/**
 * Check if two groups of outline vertex indices are adjacent
 * (share a consecutive pair along the outline polygon).
 */
function areSegmentGroupsAdjacent(groupA: number[], groupB: number[], outlineLen: number): boolean {
  const setB = new Set(groupB);
  for (const idx of groupA) {
    const next = (idx + 1) % outlineLen;
    const prev = (idx - 1 + outlineLen) % outlineLen;
    if (setB.has(next) || setB.has(prev)) return true;
  }
  return false;
}

/**
 * Main reconstruction entry point.
 * Delegates to the appropriate reconstruction function based on roof type.
 * Filters segments to dominant ones before classification and reconstruction.
 */
export function reconstructRoof(
  outline: LatLng[],
  segments: SolarRoofSegment[]
): ReconstructedRoof {
  const roofType = classifyRoofType(segments);
  const dominant = filterDominantSegments(segments);
  // For reconstruction, use sloped dominant segments where applicable
  const sloped = dominant.filter((s) => s.pitchDegrees >= 5);

  switch (roofType) {
    case 'flat':
    case 'shed':
      return reconstructSimpleRoof(outline, dominant);
    case 'gable':
      return reconstructGableRoof(outline, sloped.length >= 2 ? sloped : dominant);
    case 'hip':
      return reconstructHipRoof(outline, sloped.length >= 4 ? sloped : dominant);
    case 'cross-gable':
    case 'complex':
    default:
      return reconstructComplexRoof(outline, dominant);
  }
}
