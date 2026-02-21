import type { EdgeType } from '../types';

export const EDGE_COLORS: Record<EdgeType, string> = {
  ridge: '#ef4444',
  hip: '#8b5cf6',
  valley: '#3b82f6',
  rake: '#10b981',
  eave: '#06b6d4',
  flashing: '#f97316',
  'step-flashing': '#ec4899',
};

export const EDGE_LABELS: Record<EdgeType, string> = {
  ridge: 'Ridge',
  hip: 'Hip',
  valley: 'Valley',
  rake: 'Rake',
  eave: 'Eave',
  flashing: 'Flashing',
  'step-flashing': 'Step Flashing',
};

export const FACET_COLORS = [
  'rgba(245, 158, 11, 0.25)',
  'rgba(59, 130, 246, 0.25)',
  'rgba(16, 185, 129, 0.25)',
  'rgba(139, 92, 246, 0.25)',
  'rgba(236, 72, 153, 0.25)',
  'rgba(249, 115, 22, 0.25)',
  'rgba(6, 182, 212, 0.25)',
  'rgba(132, 204, 22, 0.25)',
];

export const FACET_STROKE_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#84cc16',
];

export function getEdgeColor(type: EdgeType): string {
  return EDGE_COLORS[type] || '#ffffff';
}

export function getFacetColor(index: number): string {
  return FACET_COLORS[index % FACET_COLORS.length];
}

export function getFacetStrokeColor(index: number): string {
  return FACET_STROKE_COLORS[index % FACET_STROKE_COLORS.length];
}
