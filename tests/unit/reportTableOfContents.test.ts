/**
 * Tests for the Report Table of Contents generator.
 * Validates TOC generation, filtering, ordering, and rendering.
 *
 * Run: npx vitest run tests/unit/reportTableOfContents.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import {
  generateTOC,
  getDefaultTOCSections,
  renderTOCPage,
} from '../../src/utils/reportTableOfContents';
import type { TOCEntry } from '../../src/utils/reportTableOfContents';

// ─── Mock jsPDF for rendering tests ──────────────────────────────────

function createMockDoc() {
  const calls: { method: string; args: unknown[] }[] = [];

  return {
    calls,
    setFontSize: vi.fn((...args: unknown[]) => calls.push({ method: 'setFontSize', args })),
    setTextColor: vi.fn((...args: unknown[]) => calls.push({ method: 'setTextColor', args })),
    setFont: vi.fn((...args: unknown[]) => calls.push({ method: 'setFont', args })),
    setDrawColor: vi.fn((...args: unknown[]) => calls.push({ method: 'setDrawColor', args })),
    setLineWidth: vi.fn((...args: unknown[]) => calls.push({ method: 'setLineWidth', args })),
    text: vi.fn((...args: unknown[]) => calls.push({ method: 'text', args })),
    line: vi.fn((...args: unknown[]) => calls.push({ method: 'line', args })),
    getTextWidth: vi.fn(() => 40), // fixed width for testing
  };
}

// ─── generateTOC ──────────────────────────────────────────────────────

describe('generateTOC', () => {
  it('should return entries sorted by page number', () => {
    const input: TOCEntry[] = [
      { title: 'Appendix', pageNumber: 10, indent: 0 },
      { title: 'Property Overview', pageNumber: 3, indent: 0 },
      { title: 'Facet Details', pageNumber: 6, indent: 0 },
    ];
    const result = generateTOC(input);
    expect(result[0].title).toBe('Property Overview');
    expect(result[1].title).toBe('Facet Details');
    expect(result[2].title).toBe('Appendix');
  });

  it('should filter out entries with pageNumber <= 0', () => {
    const input: TOCEntry[] = [
      { title: 'Active Section', pageNumber: 3, indent: 0 },
      { title: 'Disabled Section', pageNumber: 0, indent: 0 },
      { title: 'Negative Page', pageNumber: -1, indent: 0 },
    ];
    const result = generateTOC(input);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Active Section');
  });

  it('should handle empty input', () => {
    const result = generateTOC([]);
    expect(result).toHaveLength(0);
  });

  it('should preserve indent values', () => {
    const input: TOCEntry[] = [
      { title: 'Section', pageNumber: 3, indent: 0 },
      { title: 'Subsection A', pageNumber: 3, indent: 1 },
      { title: 'Subsection B', pageNumber: 4, indent: 1 },
    ];
    const result = generateTOC(input);
    expect(result[0].indent).toBe(0);
    expect(result[1].indent).toBe(1);
    expect(result[2].indent).toBe(1);
  });

  it('should handle all entries on the same page', () => {
    const input: TOCEntry[] = [
      { title: 'Section A', pageNumber: 5, indent: 0 },
      { title: 'Section B', pageNumber: 5, indent: 0 },
      { title: 'Section C', pageNumber: 5, indent: 0 },
    ];
    const result = generateTOC(input);
    expect(result).toHaveLength(3);
    expect(result.every((e) => e.pageNumber === 5)).toBe(true);
  });
});

// ─── getDefaultTOCSections ────────────────────────────────────────────

describe('getDefaultTOCSections', () => {
  it('should return standard EagleView sections', () => {
    const sections = getDefaultTOCSections();
    expect(sections.length).toBeGreaterThanOrEqual(9);

    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Property Overview');
    expect(titles).toContain('Roof Measurement Summary');
    expect(titles).toContain('Wireframe Diagrams');
    expect(titles).toContain('Facet Details');
    expect(titles).toContain('Material Estimate');
    expect(titles).toContain('Appendix');
  });

  it('should have subsections indented under Wireframe Diagrams', () => {
    const sections = getDefaultTOCSections();
    const wireframeIdx = sections.findIndex((s) => s.title === 'Wireframe Diagrams');
    expect(wireframeIdx).toBeGreaterThanOrEqual(0);

    // Next entries should be indented subsections
    const subsections = sections.slice(wireframeIdx + 1).filter((s) => s.indent === 1);
    expect(subsections.length).toBeGreaterThanOrEqual(3);
    expect(subsections.map((s) => s.title)).toEqual(
      expect.arrayContaining(['Length Diagram', 'Area Diagram', 'Pitch Diagram'])
    );
  });

  it('should have valid page numbers for all entries', () => {
    const sections = getDefaultTOCSections();
    for (const section of sections) {
      expect(section.pageNumber).toBeGreaterThan(0);
    }
  });

  it('should have page numbers in non-decreasing order', () => {
    const sections = getDefaultTOCSections();
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].pageNumber).toBeGreaterThanOrEqual(sections[i - 1].pageNumber);
    }
  });
});

// ─── Page numbering continuity ────────────────────────────────────────

describe('Page numbering continuity', () => {
  it('should have continuous page numbers in generated TOC', () => {
    const input: TOCEntry[] = [
      { title: 'Overview', pageNumber: 3, indent: 0 },
      { title: 'Summary', pageNumber: 4, indent: 0 },
      { title: 'Details', pageNumber: 5, indent: 0 },
      { title: 'Appendix', pageNumber: 6, indent: 0 },
    ];
    const result = generateTOC(input);
    for (let i = 1; i < result.length; i++) {
      const gap = result[i].pageNumber - result[i - 1].pageNumber;
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(5); // no huge gaps
    }
  });

  it('should handle TOC with many sections', () => {
    const input: TOCEntry[] = Array.from({ length: 20 }, (_, i) => ({
      title: `Section ${i + 1}`,
      pageNumber: 3 + i,
      indent: i % 3 === 0 ? 0 : 1,
    }));
    const result = generateTOC(input);
    expect(result).toHaveLength(20);
    expect(result[0].pageNumber).toBe(3);
    expect(result[19].pageNumber).toBe(22);
  });
});

// ─── renderTOCPage ────────────────────────────────────────────────────

describe('renderTOCPage', () => {
  it('should call doc.text for the TOC title', () => {
    const mockDoc = createMockDoc();
    const entries: TOCEntry[] = [
      { title: 'Property Overview', pageNumber: 3, indent: 0 },
    ];

    renderTOCPage(mockDoc as any, entries, 215.9, 279.4);

    // Should have rendered "TABLE OF CONTENTS" title
    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const tocTitleCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string).includes('TABLE OF CONTENTS')
    );
    expect(tocTitleCall).toBeDefined();
  });

  it('should render section entries with correct text', () => {
    const mockDoc = createMockDoc();
    const entries: TOCEntry[] = [
      { title: 'Property Overview', pageNumber: 3, indent: 0 },
      { title: 'Roof Measurement Summary', pageNumber: 4, indent: 0 },
    ];

    renderTOCPage(mockDoc as any, entries, 215.9, 279.4);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const renderedTexts = textCalls
      .map((c) => c.args[0])
      .filter((t) => typeof t === 'string') as string[];

    expect(renderedTexts).toContain('Property Overview');
    expect(renderedTexts).toContain('Roof Measurement Summary');
  });

  it('should render page numbers', () => {
    const mockDoc = createMockDoc();
    const entries: TOCEntry[] = [
      { title: 'Test Section', pageNumber: 7, indent: 0 },
    ];

    renderTOCPage(mockDoc as any, entries, 215.9, 279.4);

    const textCalls = mockDoc.calls.filter((c) => c.method === 'text');
    const renderedTexts = textCalls
      .map((c) => c.args[0])
      .filter((t) => typeof t === 'string') as string[];

    expect(renderedTexts).toContain('7');
  });

  it('should use bold font for section headers (indent 0)', () => {
    const mockDoc = createMockDoc();
    const entries: TOCEntry[] = [
      { title: 'Main Section', pageNumber: 3, indent: 0 },
    ];

    renderTOCPage(mockDoc as any, entries, 215.9, 279.4);

    const fontCalls = mockDoc.calls.filter(
      (c) => c.method === 'setFont' && c.args[1] === 'bold'
    );
    // Should have at least 2 bold calls: TOC title + section header
    expect(fontCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('should use normal font for subsections (indent 1)', () => {
    const mockDoc = createMockDoc();
    const entries: TOCEntry[] = [
      { title: 'Subsection', pageNumber: 3, indent: 1 },
    ];

    renderTOCPage(mockDoc as any, entries, 215.9, 279.4);

    // The subsection should trigger a 'normal' font call
    const fontCalls = mockDoc.calls.filter(
      (c) => c.method === 'setFont' && c.args[1] === 'normal'
    );
    expect(fontCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should draw a horizontal line under the title', () => {
    const mockDoc = createMockDoc();
    const entries: TOCEntry[] = [
      { title: 'Section', pageNumber: 3, indent: 0 },
    ];

    renderTOCPage(mockDoc as any, entries, 215.9, 279.4);

    const lineCalls = mockDoc.calls.filter((c) => c.method === 'line');
    expect(lineCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty entries without crashing', () => {
    const mockDoc = createMockDoc();
    expect(() => {
      renderTOCPage(mockDoc as any, [], 215.9, 279.4);
    }).not.toThrow();
  });
});
