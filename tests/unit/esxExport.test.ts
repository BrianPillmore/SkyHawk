/**
 * Unit tests for Xactimate ESX export
 * Run with: npx vitest run tests/unit/esxExport.test.ts
 */

import { describe, it, expect } from 'vitest';
import { buildESX } from '../../src/utils/esxExport';
import type { Property, RoofMeasurement } from '../../src/types';

function createProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop1',
    address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    lat: 39.7817,
    lng: -89.6501,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    measurements: [],
    damageAnnotations: [],
    snapshots: [],
    claims: [],
    notes: '',
    ...overrides,
  };
}

function createMeasurement(overrides: Partial<RoofMeasurement> = {}): RoofMeasurement {
  return {
    id: 'meas-abc12345',
    propertyId: 'prop1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    vertices: [
      { id: 'v1', lat: 39.0, lng: -104.0 },
      { id: 'v2', lat: 39.001, lng: -104.0 },
      { id: 'v3', lat: 39.001, lng: -103.999 },
    ],
    edges: [
      { id: 'e1', startVertexId: 'v1', endVertexId: 'v2', type: 'ridge', lengthFt: 30 },
      { id: 'e2', startVertexId: 'v2', endVertexId: 'v3', type: 'eave', lengthFt: 25 },
    ],
    facets: [
      {
        id: 'f1',
        name: 'Facet 1',
        vertexIds: ['v1', 'v2', 'v3'],
        pitch: 6,
        areaSqFt: 500,
        trueAreaSqFt: 559,
        edgeIds: ['e1', 'e2'],
      },
    ],
    totalAreaSqFt: 500,
    totalTrueAreaSqFt: 559,
    totalSquares: 5.59,
    predominantPitch: 6,
    totalRidgeLf: 30,
    totalHipLf: 0,
    totalValleyLf: 0,
    totalRakeLf: 0,
    totalEaveLf: 25,
    totalFlashingLf: 0,
    totalDripEdgeLf: 25,
    suggestedWastePercent: 10,
    ...overrides,
  };
}

describe('buildESX', () => {
  it('should produce valid XML with header', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(esx).toContain('<ESX version="3.0" generator="SkyHawk"');
    expect(esx).toContain('</ESX>');
  });

  it('should include property address info', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('<PropertyAddress>123 Main St</PropertyAddress>');
    expect(esx).toContain('<City>Springfield</City>');
    expect(esx).toContain('<State>IL</State>');
    expect(esx).toContain('<ZipCode>62701</ZipCode>');
  });

  it('should include coordinates', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('<Latitude>39.781700</Latitude>');
    expect(esx).toContain('<Longitude>-89.650100</Longitude>');
  });

  it('should use custom claim number when provided', () => {
    const esx = buildESX(createProperty(), createMeasurement(), 'CLM-2024-001');
    expect(esx).toContain('<ClaimNumber>CLM-2024-001</ClaimNumber>');
  });

  it('should generate claim number from measurement ID when not provided', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('<ClaimNumber>SKY-MEAS-ABC');
  });

  it('should include insured name', () => {
    const esx = buildESX(createProperty(), createMeasurement(), undefined, 'John Smith');
    expect(esx).toContain('<InsuredName>John Smith</InsuredName>');
  });

  it('should include roof summary data', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('<TotalArea unit="sqft">559.0</TotalArea>');
    expect(esx).toContain('<ProjectedArea unit="sqft">500.0</ProjectedArea>');
    expect(esx).toContain('<TotalSquares>5.59</TotalSquares>');
    expect(esx).toContain('<PredominantPitch>6/12</PredominantPitch>');
    expect(esx).toContain('<NumberOfFacets>1</NumberOfFacets>');
    expect(esx).toContain('<WastePercent>10</WastePercent>');
  });

  it('should include line measurements', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('<Ridge unit="lf">30.0</Ridge>');
    expect(esx).toContain('<Eave unit="lf">25.0</Eave>');
    expect(esx).toContain('<Hip unit="lf">0.0</Hip>');
  });

  it('should include facet details', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('<Name>Facet 1</Name>');
    expect(esx).toContain('<Pitch>6/12</Pitch>');
    expect(esx).toContain('<FlatArea unit="sqft">500.0</FlatArea>');
    expect(esx).toContain('<TrueArea unit="sqft">559.0</TrueArea>');
  });

  it('should include edges', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('type="ridge"');
    expect(esx).toContain('<Label>Ridge</Label>');
    expect(esx).toContain('<Length unit="lf">30.0</Length>');
    expect(esx).toContain('type="eave"');
    expect(esx).toContain('<Label>Eave</Label>');
  });

  it('should include material estimates when squares > 0', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).toContain('<MaterialEstimates');
    expect(esx).toContain('<ShingleBundles>');
    expect(esx).toContain('<UnderlaymentRolls>');
    expect(esx).toContain('<CaulkTubes>');
  });

  it('should skip material estimates when squares = 0', () => {
    const esx = buildESX(createProperty(), createMeasurement({ totalSquares: 0 }));
    expect(esx).not.toContain('<MaterialEstimates');
  });

  it('should include damage annotations when present', () => {
    const property = createProperty({
      damageAnnotations: [
        {
          id: 'd1', lat: 39.78, lng: -89.65,
          type: 'hail', severity: 'moderate',
          note: 'Visible dents', createdAt: '2024-06-15T10:00:00Z',
        },
      ],
    });
    const esx = buildESX(property, createMeasurement());
    expect(esx).toContain('<DamageAnnotations>');
    expect(esx).toContain('type="hail"');
    expect(esx).toContain('severity="moderate"');
    expect(esx).toContain('<Note>Visible dents</Note>');
  });

  it('should skip damage annotations when none', () => {
    const esx = buildESX(createProperty(), createMeasurement());
    expect(esx).not.toContain('<DamageAnnotations>');
  });

  it('should escape XML special characters', () => {
    const property = createProperty({ address: '123 Main & Elm <Suite> "A"' });
    const esx = buildESX(property, createMeasurement());
    expect(esx).toContain('&amp;');
    expect(esx).toContain('&lt;Suite&gt;');
    expect(esx).toContain('&quot;A&quot;');
  });

  it('should handle measurement with no facets', () => {
    const esx = buildESX(
      createProperty(),
      createMeasurement({ facets: [], edges: [], vertices: [] })
    );
    expect(esx).toContain('<Facets>');
    expect(esx).toContain('</Facets>');
    expect(esx).not.toContain('<Facet id=');
  });

  it('should handle flat roof (pitch 0)', () => {
    const esx = buildESX(
      createProperty(),
      createMeasurement({ predominantPitch: 0 })
    );
    expect(esx).toContain('<PredominantPitch>Flat</PredominantPitch>');
  });
});
