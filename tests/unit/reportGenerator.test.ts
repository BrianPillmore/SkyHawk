/**
 * Unit tests for PDF report generation
 * Tests the generateReport function with a mocked jsPDF instance.
 * Run with: npx vitest run tests/unit/reportGenerator.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Property, RoofMeasurement } from '../../src/types';

// ─── Mock jsPDF ──────────────────────────────────────────────────────
const mockSave = vi.fn();
const mockText = vi.fn();
const mockAddImage = vi.fn();
const mockAddPage = vi.fn();
const mockRect = vi.fn();
const mockLine = vi.fn();
const mockSetPage = vi.fn();
const mockSplitTextToSize = vi.fn().mockReturnValue(['line1']);

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 216, getHeight: () => 279 } },
    text: mockText,
    save: mockSave,
    addImage: mockAddImage,
    addPage: mockAddPage,
    rect: mockRect,
    line: mockLine,
    setPage: mockSetPage,
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    getTextWidth: vi.fn().mockReturnValue(50),
    getNumberOfPages: vi.fn().mockReturnValue(1),
    splitTextToSize: mockSplitTextToSize,
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────

function createProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    address: '123 Main St',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
    lat: 39.7392,
    lng: -104.9903,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
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
    id: 'meas-1',
    propertyId: 'prop-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    vertices: [],
    edges: [],
    facets: [],
    totalAreaSqFt: 2000,
    totalTrueAreaSqFt: 2200,
    totalSquares: 22,
    predominantPitch: 6,
    totalRidgeLf: 40,
    totalHipLf: 20,
    totalValleyLf: 10,
    totalRakeLf: 30,
    totalEaveLf: 60,
    totalFlashingLf: 50,
    totalDripEdgeLf: 90,
    suggestedWastePercent: 10,
    ...overrides,
  };
}

// ─── Import after mocks are set up ──────────────────────────────────
import { generateReport } from '../../src/utils/reportGenerator';

// ─── Tests ──────────────────────────────────────────────────────────

describe('generateReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset splitTextToSize to a sane default before each test
    mockSplitTextToSize.mockReturnValue(['line1']);
  });

  // ── Basic creation ───────────────────────────────────────────────

  it('should create a PDF without throwing', async () => {
    const property = createProperty();
    const measurement = createMeasurement();

    await expect(
      generateReport(property, measurement, {
        companyName: 'Acme Roofing',
        notes: '',
      })
    ).resolves.not.toThrow();
  });

  // ── Property address ─────────────────────────────────────────────

  it('should include the property address in the report text', async () => {
    const property = createProperty({ address: '456 Elm Ave' });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
    });

    // doc.text is called many times; at least one call must contain the address
    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasAddress = textCalls.some(
      (text: string | string[]) =>
        (typeof text === 'string' && text.includes('456 Elm Ave')) ||
        (Array.isArray(text) && text.some((line) => line.includes('456 Elm Ave')))
    );
    expect(hasAddress).toBe(true);
  });

  // ── Map screenshot handling ──────────────────────────────────────

  it('should NOT call addImage when mapScreenshot is not provided', async () => {
    const property = createProperty();
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
    });

    expect(mockAddImage).not.toHaveBeenCalled();
  });

  it('should call addImage when mapScreenshot is provided', async () => {
    const property = createProperty();
    const measurement = createMeasurement();
    const fakeScreenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
      mapScreenshot: fakeScreenshot,
    });

    expect(mockAddImage).toHaveBeenCalled();
    // The first argument to addImage should be the screenshot data URL
    expect(mockAddImage.mock.calls[0][0]).toBe(fakeScreenshot);
  });

  // ── Notes handling ───────────────────────────────────────────────

  it('should NOT call splitTextToSize when notes are empty', async () => {
    const property = createProperty();
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
    });

    // splitTextToSize is used exclusively in the NOTES section.
    // With empty notes the notes section is skipped entirely.
    expect(mockSplitTextToSize).not.toHaveBeenCalled();
  });

  it('should call splitTextToSize when notes are provided', async () => {
    const property = createProperty();
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: 'Replace all damaged shingles on the north-facing slope.',
    });

    expect(mockSplitTextToSize).toHaveBeenCalled();
    expect(mockSplitTextToSize.mock.calls[0][0]).toBe(
      'Replace all damaged shingles on the north-facing slope.'
    );
  });

  // ── Filename ─────────────────────────────────────────────────────

  it('should save with a filename containing the property address', async () => {
    const property = createProperty({ address: '789 Oak Blvd' });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    const filename: string = mockSave.mock.calls[0][0];
    // Address spaces are replaced with dashes
    expect(filename).toContain('789-Oak-Blvd');
    expect(filename).toMatch(/^SkyHawk-Roof-Report-/);
    expect(filename).toMatch(/\.pdf$/);
  });

  // ── Zero facets ──────────────────────────────────────────────────

  it('should handle a measurement with zero facets without throwing', async () => {
    const property = createProperty();
    const measurement = createMeasurement({ facets: [] });

    await expect(
      generateReport(property, measurement, {
        companyName: 'Acme Roofing',
        notes: '',
      })
    ).resolves.not.toThrow();
  });

  // ── Zero squares (no material section) ───────────────────────────

  it('should skip the material estimates section when totalSquares is 0', async () => {
    const property = createProperty();
    const measurement = createMeasurement({
      totalSquares: 0,
      totalAreaSqFt: 0,
      totalTrueAreaSqFt: 0,
    });

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
    });

    // When totalSquares is 0 the material section is skipped.
    // The MATERIAL ESTIMATES heading should NOT appear in any text call.
    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasMaterialHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'MATERIAL ESTIMATES'
    );
    expect(hasMaterialHeading).toBe(false);
  });

  it('should include the material estimates section when totalSquares > 0', async () => {
    const property = createProperty();
    const measurement = createMeasurement({ totalSquares: 22 });

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasMaterialHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'MATERIAL ESTIMATES'
    );
    expect(hasMaterialHeading).toBe(true);
  });

  // ── Footer / page numbering ──────────────────────────────────────

  it('should set page for footer rendering', async () => {
    const property = createProperty();
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
    });

    // The footer loop calls setPage for each page (at least page 1)
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  // ── Company name ─────────────────────────────────────────────────

  it('should include the company name in the header', async () => {
    const property = createProperty();
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Summit Roofing LLC',
      notes: '',
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasCompanyName = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text.includes('Summit Roofing LLC')
    );
    expect(hasCompanyName).toBe(true);
  });

  // ── Damage assessment section ───────────────────────────────────

  it('should include DAMAGE ASSESSMENT heading when property has damageAnnotations and includeDamage is true', async () => {
    const property = createProperty({
      damageAnnotations: [
        {
          id: 'dmg-1',
          lat: 39.7392,
          lng: -104.9903,
          type: 'hail',
          severity: 'moderate',
          note: 'Visible dents on north slope',
          createdAt: '2025-06-15T10:00:00Z',
        },
      ],
    });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
      includeDamage: true,
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasDamageHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'DAMAGE ASSESSMENT'
    );
    expect(hasDamageHeading).toBe(true);
  });

  it('should NOT include DAMAGE ASSESSMENT heading when includeDamage is false', async () => {
    const property = createProperty({
      damageAnnotations: [
        {
          id: 'dmg-1',
          lat: 39.7392,
          lng: -104.9903,
          type: 'wind',
          severity: 'severe',
          note: 'Lifted shingles on west gable',
          createdAt: '2025-06-15T10:00:00Z',
        },
      ],
    });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
      includeDamage: false,
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasDamageHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'DAMAGE ASSESSMENT'
    );
    expect(hasDamageHeading).toBe(false);
  });

  // ── Claims information section ──────────────────────────────────

  it('should include CLAIMS INFORMATION heading when property has claims and includeClaims is true', async () => {
    const property = createProperty({
      claims: [
        {
          id: 'claim-1',
          propertyId: 'prop-1',
          claimNumber: 'CLM-2025-0042',
          insuredName: 'Jane Doe',
          dateOfLoss: '2025-05-20T00:00:00Z',
          status: 'inspected',
          notes: 'Hail damage claim',
          createdAt: '2025-05-21T00:00:00Z',
          updatedAt: '2025-05-22T00:00:00Z',
        },
      ],
    });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
      includeClaims: true,
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasClaimsHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'CLAIMS INFORMATION'
    );
    expect(hasClaimsHeading).toBe(true);
  });

  it('should NOT include CLAIMS INFORMATION heading when includeClaims is false', async () => {
    const property = createProperty({
      claims: [
        {
          id: 'claim-1',
          propertyId: 'prop-1',
          claimNumber: 'CLM-2025-0042',
          insuredName: 'Jane Doe',
          dateOfLoss: '2025-05-20T00:00:00Z',
          status: 'inspected',
          notes: 'Hail damage claim',
          createdAt: '2025-05-21T00:00:00Z',
          updatedAt: '2025-05-22T00:00:00Z',
        },
      ],
    });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
      includeClaims: false,
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasClaimsHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'CLAIMS INFORMATION'
    );
    expect(hasClaimsHeading).toBe(false);
  });

  // ── Multi-structure summary section ─────────────────────────────

  it('should include MULTI-STRUCTURE SUMMARY heading when property has multiple measurements and includeMultiStructure is true', async () => {
    const property = createProperty({
      measurements: [
        createMeasurement({ id: 'meas-1', totalSquares: 22, totalTrueAreaSqFt: 2200 }),
        createMeasurement({ id: 'meas-2', totalSquares: 10, totalTrueAreaSqFt: 1000 }),
      ],
    });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
      includeMultiStructure: true,
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasMultiStructureHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'MULTI-STRUCTURE SUMMARY'
    );
    expect(hasMultiStructureHeading).toBe(true);
  });

  it('should NOT include MULTI-STRUCTURE SUMMARY heading when includeMultiStructure is false', async () => {
    const property = createProperty({
      measurements: [
        createMeasurement({ id: 'meas-1', totalSquares: 22, totalTrueAreaSqFt: 2200 }),
        createMeasurement({ id: 'meas-2', totalSquares: 10, totalTrueAreaSqFt: 1000 }),
      ],
    });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
      includeMultiStructure: false,
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasMultiStructureHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'MULTI-STRUCTURE SUMMARY'
    );
    expect(hasMultiStructureHeading).toBe(false);
  });

  it('should NOT include MULTI-STRUCTURE SUMMARY heading when there is only one measurement', async () => {
    const property = createProperty({
      measurements: [
        createMeasurement({ id: 'meas-1', totalSquares: 22, totalTrueAreaSqFt: 2200 }),
      ],
    });
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
      includeMultiStructure: true,
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasMultiStructureHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'MULTI-STRUCTURE SUMMARY'
    );
    expect(hasMultiStructureHeading).toBe(false);
  });

  // ── Full property overview section ──────────────────────────────

  it('should include FULL PROPERTY OVERVIEW heading when generating a report', async () => {
    const property = createProperty();
    const measurement = createMeasurement();

    await generateReport(property, measurement, {
      companyName: 'Acme Roofing',
      notes: '',
    });

    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const hasOverviewHeading = textCalls.some(
      (text: string | string[]) =>
        typeof text === 'string' && text === 'FULL PROPERTY OVERVIEW'
    );
    expect(hasOverviewHeading).toBe(true);
  });

  // ── Report with all sections ────────────────────────────────────

  it('should generate without error when property has damage, claims, and multiple measurements', async () => {
    const property = createProperty({
      damageAnnotations: [
        {
          id: 'dmg-1',
          lat: 39.7392,
          lng: -104.9903,
          type: 'hail',
          severity: 'minor',
          note: 'Small dents on south slope',
          createdAt: '2025-06-10T08:00:00Z',
        },
        {
          id: 'dmg-2',
          lat: 39.7393,
          lng: -104.9904,
          type: 'wind',
          severity: 'severe',
          note: 'Lifted shingles near ridge',
          createdAt: '2025-06-11T09:00:00Z',
        },
        {
          id: 'dmg-3',
          lat: 39.7394,
          lng: -104.9905,
          type: 'missing-shingle',
          severity: 'moderate',
          note: 'Two shingles missing on east face',
          createdAt: '2025-06-12T14:00:00Z',
        },
      ],
      claims: [
        {
          id: 'claim-1',
          propertyId: 'prop-1',
          claimNumber: 'CLM-2025-0100',
          insuredName: 'John Smith',
          dateOfLoss: '2025-06-09T00:00:00Z',
          status: 'submitted',
          notes: 'Storm damage claim',
          createdAt: '2025-06-10T00:00:00Z',
          updatedAt: '2025-06-15T00:00:00Z',
        },
        {
          id: 'claim-2',
          propertyId: 'prop-1',
          claimNumber: 'CLM-2025-0101',
          insuredName: 'John Smith',
          dateOfLoss: '2025-06-09T00:00:00Z',
          status: 'approved',
          notes: 'Supplemental claim',
          createdAt: '2025-06-12T00:00:00Z',
          updatedAt: '2025-06-18T00:00:00Z',
        },
      ],
      measurements: [
        createMeasurement({ id: 'meas-1', totalSquares: 22, totalTrueAreaSqFt: 2200 }),
        createMeasurement({ id: 'meas-2', totalSquares: 8, totalTrueAreaSqFt: 800 }),
        createMeasurement({ id: 'meas-3', totalSquares: 5, totalTrueAreaSqFt: 500 }),
      ],
    });
    const measurement = createMeasurement();

    await expect(
      generateReport(property, measurement, {
        companyName: 'Premier Roofing & Restoration',
        notes: 'Full property inspection completed after June 2025 hailstorm.',
        includeDamage: true,
        includeClaims: true,
        includeMultiStructure: true,
      })
    ).resolves.not.toThrow();

    // Verify all major section headings are present
    const textCalls = mockText.mock.calls.map((call) => call[0]);
    const findHeading = (heading: string) =>
      textCalls.some(
        (text: string | string[]) =>
          typeof text === 'string' && text === heading
      );

    expect(findHeading('FULL PROPERTY OVERVIEW')).toBe(true);
    expect(findHeading('DAMAGE ASSESSMENT')).toBe(true);
    expect(findHeading('CLAIMS INFORMATION')).toBe(true);
    expect(findHeading('MULTI-STRUCTURE SUMMARY')).toBe(true);
    expect(findHeading('ROOF MEASUREMENT SUMMARY')).toBe(true);
  });
});
