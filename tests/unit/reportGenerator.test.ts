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
});
