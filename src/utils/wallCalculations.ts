/**
 * Wall, window, and door measurement utilities.
 */

export interface WallSegment {
  id: string;
  name: string;
  lengthFt: number;
  heightFt: number;
  grossAreaSqFt: number;
  openings: WallOpening[];
  netAreaSqFt: number;
}

export interface WallOpening {
  id: string;
  type: 'window' | 'door' | 'garage-door';
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
}

export interface WallMeasurementSummary {
  totalWallSegments: number;
  totalGrossAreaSqFt: number;
  totalOpeningsAreaSqFt: number;
  totalNetAreaSqFt: number;
  totalWindowCount: number;
  totalDoorCount: number;
  totalGarageDoorCount: number;
  sidingSquares: number;
}

// Standard opening sizes
export const STANDARD_OPENINGS: Record<string, { widthFt: number; heightFt: number }> = {
  'window-small': { widthFt: 2.5, heightFt: 3 },
  'window-standard': { widthFt: 3, heightFt: 4 },
  'window-large': { widthFt: 4, heightFt: 5 },
  'window-picture': { widthFt: 6, heightFt: 4 },
  'door-standard': { widthFt: 3, heightFt: 6.67 },
  'door-double': { widthFt: 6, heightFt: 6.67 },
  'door-sliding': { widthFt: 6, heightFt: 6.67 },
  'garage-single': { widthFt: 9, heightFt: 7 },
  'garage-double': { widthFt: 16, heightFt: 7 },
};

export function calculateWallArea(lengthFt: number, heightFt: number): number {
  return Math.max(0, lengthFt * heightFt);
}

export function calculateOpeningArea(widthFt: number, heightFt: number): number {
  return Math.max(0, widthFt * heightFt);
}

export function calculateNetWallArea(grossArea: number, openings: WallOpening[]): number {
  const totalOpeningsArea = openings.reduce((sum, o) => sum + o.areaSqFt, 0);
  return Math.max(0, grossArea - totalOpeningsArea);
}

export function calculateWallSegment(
  id: string,
  name: string,
  lengthFt: number,
  heightFt: number,
  openings: WallOpening[],
): WallSegment {
  const grossAreaSqFt = calculateWallArea(lengthFt, heightFt);
  const netAreaSqFt = calculateNetWallArea(grossAreaSqFt, openings);
  return { id, name, lengthFt, heightFt, grossAreaSqFt, openings, netAreaSqFt };
}

export function calculateWallSummary(segments: WallSegment[]): WallMeasurementSummary {
  const totalGrossAreaSqFt = segments.reduce((sum, s) => sum + s.grossAreaSqFt, 0);
  const totalOpeningsAreaSqFt = segments.reduce(
    (sum, s) => sum + s.openings.reduce((oSum, o) => oSum + o.areaSqFt, 0), 0
  );
  const totalNetAreaSqFt = segments.reduce((sum, s) => sum + s.netAreaSqFt, 0);

  let totalWindowCount = 0;
  let totalDoorCount = 0;
  let totalGarageDoorCount = 0;

  for (const s of segments) {
    for (const o of s.openings) {
      if (o.type === 'window') totalWindowCount++;
      else if (o.type === 'door') totalDoorCount++;
      else if (o.type === 'garage-door') totalGarageDoorCount++;
    }
  }

  return {
    totalWallSegments: segments.length,
    totalGrossAreaSqFt: Math.round(totalGrossAreaSqFt),
    totalOpeningsAreaSqFt: Math.round(totalOpeningsAreaSqFt),
    totalNetAreaSqFt: Math.round(totalNetAreaSqFt),
    totalWindowCount,
    totalDoorCount,
    totalGarageDoorCount,
    sidingSquares: Math.round((totalNetAreaSqFt / 100) * 10) / 10,
  };
}

export function estimateSidingMaterials(summary: WallMeasurementSummary) {
  const area = summary.totalNetAreaSqFt;
  const wasteMultiplier = 1.10; // 10% waste for siding

  return {
    vinylSidingSquares: Math.ceil((area * wasteMultiplier) / 100),
    hardiePlankSquares: Math.ceil((area * wasteMultiplier) / 100),
    jChannelLf: Math.round(summary.totalWindowCount * 12 + summary.totalDoorCount * 20),
    cornerPostLf: 0, // depends on building corners, placeholder
    starterStripLf: 0, // depends on base perimeter, placeholder
    trimCoilRolls: Math.ceil((summary.totalWindowCount + summary.totalDoorCount) / 4),
  };
}
