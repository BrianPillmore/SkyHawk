/**
 * Tests for the Report Page Templates.
 * Validates page number formatting, header/footer rendering,
 * summary page data, and material estimate rendering.
 *
 * Run: npx vitest run tests/unit/reportPageTemplates.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import {
  addPageHeader,
  addPageFooter,
  addPageNumber,
  renderSummaryPage,
  renderFacetDetailPage,
  renderMaterialEstimatePage,
  formatPageNumber,
  applyPageDecoration,
  PAGE_MARGIN,
  FONT_SIZES,
  COLORS,
} from '../../src/utils/reportPageTemplates';
import type { ReportSummaryData, FacetDetail } from '../../src/utils/reportPageTemplates';
import type { MaterialEstimate } from '../../src/utils/materials';

// ─── Mock jsPDF ───────────────────────────────────────────────────────

function createMockDoc(numPages: number = 1) {
  const calls: { method: string; args: unknown[] }[] = [];
  let currentPage = 1;

  return {
    calls,
    internal: {
      pageSize: {
        getWidth: () => 215.9, // letter width in mm
        getHeight: () => 279.4, // letter height in mm
      },
    },
    setFontSize: vi.fn((...args: unknown[]) => calls.push({ method: 'setFontSize', args })),
    setTextColor: vi.fn((...args: unknown[]) => calls.push({ method: 'setTextColor', args })),
    setFont: vi.fn((...args: unknown[]) => calls.push({ method: 'setFont', args })),
    setFillColor: vi.fn((...args: unknown[]) => calls.push({ method: 'setFillColor', args })),
    setDrawColor: vi.fn((...args: unknown[]) => calls.push({ method: 'setDrawColor', args })),
    setLineWidth: vi.fn((...args: unknown[]) => calls.push({ method: 'setLineWidth', args })),
    text: vi.fn((...args: unknown[]) => calls.push({ method: 'text', args })),
    line: vi.fn((...args: unknown[]) => calls.push({ method: 'line', args })),
    rect: vi.fn((...args: unknown[]) => calls.push({ method: 'rect', args })),
    roundedRect: vi.fn((...args: unknown[]) => calls.push({ method: 'roundedRect', args })),
    addPage: vi.fn(() => {
      currentPage++;
      calls.push({ method: 'addPage', args: [] });
    }),
    setPage: vi.fn((page: number) => {
      currentPage = page;
      calls.push({ method: 'setPage', args: [page] });
    }),
    getNumberOfPages: vi.fn(() => numPages),
    getTextWidth: vi.fn((text: string) => text.length * 2), // rough approximation
  };
}

// ─── formatPageNumber ─────────────────────────────────────────────────

describe('formatPageNumber', () => {
  it('should format single digit pages', () => {
    expect(formatPageNumber(1, 5)).toBe('Page 1 of 5');
  });

  it('should format double digit pages', () => {
    expect(formatPageNumber(12, 25)).toBe('Page 12 of 25');
  });

  it('should format when current equals total', () => {
    expect(formatPageNumber(10, 10)).toBe('Page 10 of 10');
  });

  it('should format page 1 of 1', () => {
    expect(formatPageNumber(1, 1)).toBe('Page 1 of 1');
  });
});

// ─── addPageHeader ────────────────────────────────────────────────────

describe('addPageHeader', () => {
  it('should render a header bar', () => {
    const mockDoc = createMockDoc();
    addPageHeader(mockDoc as any, '123 Main St, City, ST 12345', 'January 1, 2026');

    // Should draw a filled rectangle for the header bar
    const rectCalls = mockDoc.calls.filter((c) => c.method === 'rect');
    expect(rectCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should include the property address', () => {
    const mockDoc = createMockDoc();
    const address = '123 Main St, City, ST 12345';
    addPageHeader(mockDoc as any, address, 'January 1, 2026');

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const addressCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string) === address
    );
    expect(addressCall).toBeDefined();
  });

  it('should include the report date', () => {
    const mockDoc = createMockDoc();
    const date = 'February 24, 2026';
    addPageHeader(mockDoc as any, '123 Main St', date);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const dateCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string) === date
    );
    expect(dateCall).toBeDefined();
  });

  it('should use white text on primary color background', () => {
    const mockDoc = createMockDoc();
    addPageHeader(mockDoc as any, 'Address', 'Date');

    // Should set fill color to primary
    const fillCalls = mockDoc.calls.filter((c) => c.method === 'setFillColor');
    expect(fillCalls.length).toBeGreaterThanOrEqual(1);

    // Should set text color to white
    const colorCalls = mockDoc.calls.filter(
      (c) => c.method === 'setTextColor' && c.args[0] === 255 && c.args[1] === 255 && c.args[2] === 255
    );
    expect(colorCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── addPageFooter ────────────────────────────────────────────────────

describe('addPageFooter', () => {
  it('should render a footer background', () => {
    const mockDoc = createMockDoc();
    addPageFooter(mockDoc as any, 'Test Company');

    const rectCalls = mockDoc.calls.filter((c) => c.method === 'rect');
    expect(rectCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should include the company name in footer text', () => {
    const mockDoc = createMockDoc();
    addPageFooter(mockDoc as any, 'Acme Roofing');

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const companyCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string).includes('Acme Roofing')
    );
    expect(companyCall).toBeDefined();
  });

  it('should include SkyHawk branding', () => {
    const mockDoc = createMockDoc();
    addPageFooter(mockDoc as any, 'Test Co');

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const brandingCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string).includes('SkyHawk')
    );
    expect(brandingCall).toBeDefined();
  });
});

// ─── addPageNumber ────────────────────────────────────────────────────

describe('addPageNumber', () => {
  it('should render "Page X of Y" text', () => {
    const mockDoc = createMockDoc();
    addPageNumber(mockDoc as any, 3, 10);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const pageNumCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string) === 'Page 3 of 10'
    );
    expect(pageNumCall).toBeDefined();
  });

  it('should position text near bottom right', () => {
    const mockDoc = createMockDoc();
    addPageNumber(mockDoc as any, 1, 5);

    const textCalls = mockDoc.calls.filter(
      (c) => c.method === 'text' && typeof c.args[0] === 'string' && (c.args[0] as string).includes('Page')
    );
    expect(textCalls.length).toBe(1);
    // Y position should be near bottom of page (279.4 - 8 = ~271)
    const yPos = textCalls[0].args[2] as number;
    expect(yPos).toBeGreaterThan(260);
  });
});

// ─── renderSummaryPage ────────────────────────────────────────────────

describe('renderSummaryPage', () => {
  const sampleData: ReportSummaryData = {
    totalAreaSquares: 45.5,
    predominantPitch: 8,
    numberOfFacets: 15,
    totalRidgeHipLf: 300,
    totalValleyLf: 150,
    totalRakeEaveLf: 400,
  };

  it('should return a Y position greater than initial', () => {
    const mockDoc = createMockDoc();
    const resultY = renderSummaryPage(mockDoc as any, sampleData);
    expect(resultY).toBeGreaterThan(PAGE_MARGIN + 14);
  });

  it('should render the KEY METRICS SUMMARY title', () => {
    const mockDoc = createMockDoc();
    renderSummaryPage(mockDoc as any, sampleData);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const titleCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string).includes('KEY METRICS SUMMARY')
    );
    expect(titleCall).toBeDefined();
  });

  it('should render all 6 metric cards', () => {
    const mockDoc = createMockDoc();
    renderSummaryPage(mockDoc as any, sampleData);

    // Each metric card has a roundedRect background
    const roundedRectCalls = mockDoc.calls.filter((c) => c.method === 'roundedRect');
    expect(roundedRectCalls.length).toBe(6);
  });

  it('should render metric labels', () => {
    const mockDoc = createMockDoc();
    renderSummaryPage(mockDoc as any, sampleData);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const renderedTexts = textCalls
      .map((c) => c.args[0])
      .filter((t) => typeof t === 'string') as string[];

    expect(renderedTexts).toContain('Total Area');
    expect(renderedTexts).toContain('Predominant Pitch');
    expect(renderedTexts).toContain('Number of Facets');
    expect(renderedTexts).toContain('Total Ridge/Hip');
    expect(renderedTexts).toContain('Total Valley');
    expect(renderedTexts).toContain('Total Rake/Eave');
  });

  it('should render metric values', () => {
    const mockDoc = createMockDoc();
    renderSummaryPage(mockDoc as any, sampleData);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const renderedTexts = textCalls
      .map((c) => c.args[0])
      .filter((t) => typeof t === 'string') as string[];

    // Check that values are rendered (format depends on formatNumber/formatPitch)
    expect(renderedTexts.some((t) => t.includes('45.5'))).toBe(true);
    expect(renderedTexts.some((t) => t.includes('8/12'))).toBe(true);
    expect(renderedTexts.some((t) => t.includes('15'))).toBe(true);
  });

  it('should draw accent bars on metric cards', () => {
    const mockDoc = createMockDoc();
    renderSummaryPage(mockDoc as any, sampleData);

    // Each card has an accent bar (small rect) — 6 cards * 1 accent bar = 6
    // Plus 6 background rects = 12 total rects (accent bars are narrow: width 3)
    const rectCalls = mockDoc.calls.filter(
      (c) => c.method === 'rect' && c.args[2] === 3 // width = 3mm (accent bar)
    );
    expect(rectCalls.length).toBe(6);
  });
});

// ─── renderFacetDetailPage ────────────────────────────────────────────

describe('renderFacetDetailPage', () => {
  const sampleFacets: FacetDetail[] = [
    { name: '#1 South', pitch: 8, areaSqFt: 800, trueAreaSqFt: 960 },
    { name: '#2 North', pitch: 8, areaSqFt: 750, trueAreaSqFt: 900 },
    { name: '#3 East', pitch: 6, areaSqFt: 400, trueAreaSqFt: 448 },
  ];

  it('should render the FACET DETAILS title', () => {
    const mockDoc = createMockDoc();
    renderFacetDetailPage(mockDoc as any, sampleFacets, 5);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const titleCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string).includes('FACET DETAILS')
    );
    expect(titleCall).toBeDefined();
  });

  it('should render all facet rows', () => {
    const mockDoc = createMockDoc();
    renderFacetDetailPage(mockDoc as any, sampleFacets, 5);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const renderedTexts = textCalls
      .map((c) => c.args[0])
      .filter((t) => typeof t === 'string') as string[];

    expect(renderedTexts).toContain('#1 South');
    expect(renderedTexts).toContain('#2 North');
    expect(renderedTexts).toContain('#3 East');
  });

  it('should render a TOTAL row', () => {
    const mockDoc = createMockDoc();
    renderFacetDetailPage(mockDoc as any, sampleFacets, 5);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const totalCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string) === 'TOTAL'
    );
    expect(totalCall).toBeDefined();
  });

  it('should handle empty facets without crashing', () => {
    const mockDoc = createMockDoc();
    expect(() => {
      renderFacetDetailPage(mockDoc as any, [], 5);
    }).not.toThrow();
  });

  it('should return the start page number', () => {
    const mockDoc = createMockDoc();
    const resultPage = renderFacetDetailPage(mockDoc as any, sampleFacets, 5);
    expect(resultPage).toBeGreaterThanOrEqual(5);
  });
});

// ─── renderMaterialEstimatePage ───────────────────────────────────────

describe('renderMaterialEstimatePage', () => {
  const sampleMaterials: MaterialEstimate = {
    shingleBundles: 150,
    underlaymentRolls: 13,
    iceWaterRolls: 6,
    starterStripLf: 500,
    ridgeCapLf: 300,
    dripEdgeLf: 500,
    stepFlashingPcs: 40,
    pipeBoots: 5,
    nailsLbs: 88,
    caulkTubes: 3,
    ridgeVentLf: 100,
  };

  it('should render the MATERIAL ESTIMATE title', () => {
    const mockDoc = createMockDoc();
    renderMaterialEstimatePage(mockDoc as any, sampleMaterials, 8);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const titleCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string).includes('MATERIAL ESTIMATE')
    );
    expect(titleCall).toBeDefined();
  });

  it('should render material quantities', () => {
    const mockDoc = createMockDoc();
    renderMaterialEstimatePage(mockDoc as any, sampleMaterials, 8);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const renderedTexts = textCalls
      .map((c) => c.args[0])
      .filter((t) => typeof t === 'string') as string[];

    expect(renderedTexts).toContain('Shingle Bundles');
    expect(renderedTexts).toContain('150');
    expect(renderedTexts).toContain('Underlayment');
    expect(renderedTexts).toContain('Ridge Cap');
  });

  it('should filter out zero-quantity rows', () => {
    const zeroMaterials: MaterialEstimate = {
      ...sampleMaterials,
      stepFlashingPcs: 0,
      caulkTubes: 0,
    };
    const mockDoc = createMockDoc();
    renderMaterialEstimatePage(mockDoc as any, zeroMaterials, 8);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const renderedTexts = textCalls
      .map((c) => c.args[0])
      .filter((t) => typeof t === 'string') as string[];

    // Zero quantities should not appear as "0 pcs" or "0 tubes"
    expect(renderedTexts).not.toContain('0 pcs');
    expect(renderedTexts).not.toContain('0 tubes');
  });

  it('should return the start page number', () => {
    const mockDoc = createMockDoc();
    const resultPage = renderMaterialEstimatePage(mockDoc as any, sampleMaterials, 8);
    expect(resultPage).toBeGreaterThanOrEqual(8);
  });
});

// ─── applyPageDecoration ──────────────────────────────────────────────

describe('applyPageDecoration', () => {
  it('should decorate all pages from startFromPage', () => {
    const mockDoc = createMockDoc(5);
    applyPageDecoration(mockDoc as any, '123 Main St', 'Jan 1, 2026', 'Test Co', 2);

    // Should call setPage for pages 2, 3, 4, 5
    const setPageCalls = mockDoc.calls.filter((c) => c.method === 'setPage');
    expect(setPageCalls.length).toBe(4);
    expect(setPageCalls.map((c) => c.args[0])).toEqual([2, 3, 4, 5]);
  });

  it('should not decorate pages before startFromPage', () => {
    const mockDoc = createMockDoc(5);
    applyPageDecoration(mockDoc as any, '123 Main St', 'Jan 1, 2026', 'Test Co', 3);

    const setPageCalls = mockDoc.calls.filter((c) => c.method === 'setPage');
    expect(setPageCalls.length).toBe(3); // pages 3, 4, 5
    expect(setPageCalls[0].args[0]).toBe(3);
  });

  it('should handle single page document', () => {
    const mockDoc = createMockDoc(1);
    expect(() => {
      applyPageDecoration(mockDoc as any, 'Address', 'Date', 'Company', 2);
    }).not.toThrow();
  });
});

// ─── Constants ─────────────────────────────────────────────────────────

describe('Constants', () => {
  it('should have PAGE_MARGIN as 0.75 inches in mm', () => {
    // 0.75 inches = 19.05 mm
    expect(PAGE_MARGIN).toBeCloseTo(19.05, 1);
  });

  it('should have correct font sizes', () => {
    expect(FONT_SIZES.title).toBe(16);
    expect(FONT_SIZES.body).toBe(12);
    expect(FONT_SIZES.caption).toBe(10);
    expect(FONT_SIZES.footer).toBe(7);
  });

  it('should have primary color as blue', () => {
    expect(COLORS.primary).toEqual([37, 120, 235]);
  });
});
