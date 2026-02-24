import type {
  CommercialRoofType,
  CommercialRoofSection,
  CommercialSectionSummary,
  CommercialPropertySummary,
  ParapetSegment,
  RooftopUnit,
} from '../types/commercial';
import { calculatePolygonAreaSqFt, haversineDistanceFt } from './geometry';

/**
 * Classify a roof section by its pitch (slope in x/12 format).
 *   - < 0.5/12 → flat
 *   - < 2/12   → low-slope
 *   - >= 2/12  → metal-standing-seam (commercial steep)
 */
export function classifyRoofSection(pitch: number): CommercialRoofType {
  if (pitch < 0.5) return 'flat';
  if (pitch < 2) return 'low-slope';
  return 'metal-standing-seam';
}

/**
 * Calculate the area of a commercial roof polygon defined by lat/lng vertices.
 * Uses the Haversine-based polygon area calculation from geometry utils.
 * Returns area in square feet.
 */
export function calculateCommercialArea(vertices: { lat: number; lng: number }[]): number {
  if (vertices.length < 3) return 0;
  return calculatePolygonAreaSqFt(vertices);
}

/**
 * Calculate the perimeter of a polygon defined by lat/lng vertices.
 * Returns perimeter in feet.
 */
export function calculatePerimeter(vertices: { lat: number; lng: number }[]): number {
  if (vertices.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    perimeter += haversineDistanceFt(vertices[i], vertices[next]);
  }
  return perimeter;
}

/**
 * Calculate total parapet and coping lengths from parapet segments.
 */
export function calculateParapetLength(segments: ParapetSegment[]): { totalLf: number; copingLf: number } {
  let totalLf = 0;
  let copingLf = 0;

  for (const seg of segments) {
    totalLf += seg.lengthFt;
    if (seg.copingType !== 'none') {
      copingLf += seg.lengthFt;
    }
  }

  return { totalLf, copingLf };
}

/**
 * Calculate total area taken by rooftop equipment and flashing perimeter.
 */
export function calculateRooftopPenetrations(units: RooftopUnit[]): {
  totalArea: number;
  flashingPerimeter: number;
} {
  let totalArea = 0;
  let flashingPerimeter = 0;

  for (const unit of units) {
    const area = unit.widthFt * unit.lengthFt;
    const perimeter = 2 * (unit.widthFt + unit.lengthFt);
    totalArea += area;
    flashingPerimeter += perimeter;
  }

  return { totalArea, flashingPerimeter };
}

/**
 * Generate a summary report for a single commercial roof section.
 */
export function generateSectionReport(section: CommercialRoofSection): CommercialSectionSummary {
  const currentYear = new Date().getFullYear();
  const ageYears = section.yearInstalled != null ? currentYear - section.yearInstalled : null;
  const perimeterLf = calculatePerimeter(section.vertices);

  return {
    sectionId: section.id,
    name: section.name,
    roofType: section.roofType,
    areaSqFt: section.areaSqFt,
    condition: section.condition,
    slopeInPerFt: section.slopePctPerFt,
    perimeterLf,
    ageYears,
  };
}

/**
 * Merge multiple commercial roof sections into an aggregate property summary.
 */
export function mergeCommercialSections(sections: CommercialRoofSection[]): CommercialPropertySummary {
  if (sections.length === 0) {
    return {
      totalAreaSqFt: 0,
      sectionCount: 0,
      sections: [],
      predominantRoofType: 'flat',
      overallCondition: 'good',
      totalPerimeterLf: 0,
    };
  }

  const sectionSummaries = sections.map(generateSectionReport);

  const totalAreaSqFt = sectionSummaries.reduce((sum, s) => sum + s.areaSqFt, 0);
  const totalPerimeterLf = sectionSummaries.reduce((sum, s) => sum + s.perimeterLf, 0);

  // Predominant roof type: the type covering the most area
  const typeAreas = new Map<CommercialRoofType, number>();
  for (const section of sections) {
    const current = typeAreas.get(section.roofType) || 0;
    typeAreas.set(section.roofType, current + section.areaSqFt);
  }
  let predominantRoofType: CommercialRoofType = 'flat';
  let maxArea = 0;
  for (const [type, area] of typeAreas) {
    if (area > maxArea) {
      maxArea = area;
      predominantRoofType = type;
    }
  }

  // Overall condition: worst condition among sections
  const conditionOrder: CommercialRoofSection['condition'][] = ['good', 'fair', 'poor', 'failed'];
  let worstConditionIndex = 0;
  for (const section of sections) {
    const idx = conditionOrder.indexOf(section.condition);
    if (idx > worstConditionIndex) {
      worstConditionIndex = idx;
    }
  }
  const overallCondition = conditionOrder[worstConditionIndex];

  return {
    totalAreaSqFt,
    sectionCount: sections.length,
    sections: sectionSummaries,
    predominantRoofType,
    overallCondition,
    totalPerimeterLf,
  };
}
