import type { Property } from '../types';

export type SortField = 'date' | 'address' | 'area' | 'squares' | 'facets';
export type SortDirection = 'asc' | 'desc';
export type PropertyFilter = 'all' | 'measured' | 'unmeasured';

export interface PropertySearchOptions {
  query: string;
  sortField: SortField;
  sortDirection: SortDirection;
  filter: PropertyFilter;
}

/**
 * Search properties by query string (matches address, city, state, zip).
 */
export function searchProperties(properties: Property[], query: string): Property[] {
  if (!query.trim()) return properties;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return properties.filter((p) => {
    const searchable = `${p.address} ${p.city} ${p.state} ${p.zip}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

/**
 * Filter properties by measurement status.
 */
export function filterProperties(properties: Property[], filter: PropertyFilter): Property[] {
  switch (filter) {
    case 'measured':
      return properties.filter((p) => p.measurements.length > 0);
    case 'unmeasured':
      return properties.filter((p) => p.measurements.length === 0);
    default:
      return properties;
  }
}

/**
 * Sort properties by the given field and direction.
 */
export function sortProperties(
  properties: Property[],
  field: SortField,
  direction: SortDirection,
): Property[] {
  const sorted = [...properties].sort((a, b) => {
    let cmp = 0;

    switch (field) {
      case 'date':
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'address':
        cmp = a.address.localeCompare(b.address);
        break;
      case 'area': {
        const aArea = getLatestArea(a);
        const bArea = getLatestArea(b);
        cmp = aArea - bArea;
        break;
      }
      case 'squares': {
        const aSq = getLatestSquares(a);
        const bSq = getLatestSquares(b);
        cmp = aSq - bSq;
        break;
      }
      case 'facets': {
        const aFacets = getLatestFacets(a);
        const bFacets = getLatestFacets(b);
        cmp = aFacets - bFacets;
        break;
      }
    }

    return direction === 'desc' ? -cmp : cmp;
  });

  return sorted;
}

/**
 * Apply search, filter, and sort in sequence.
 */
export function applyPropertySearch(
  properties: Property[],
  options: PropertySearchOptions,
): Property[] {
  let result = searchProperties(properties, options.query);
  result = filterProperties(result, options.filter);
  result = sortProperties(result, options.sortField, options.sortDirection);
  return result;
}

function getLatestArea(p: Property): number {
  const m = p.measurements[p.measurements.length - 1];
  return m?.totalTrueAreaSqFt || 0;
}

function getLatestSquares(p: Property): number {
  const m = p.measurements[p.measurements.length - 1];
  return m?.totalSquares || 0;
}

function getLatestFacets(p: Property): number {
  const m = p.measurements[p.measurements.length - 1];
  return m?.facets.length || 0;
}
