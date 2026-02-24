/**
 * @vitest-environment jsdom
 *
 * Unit tests for Interactive HTML Report Export.
 * Tests HTML generation, data serialization, template structure,
 * and the download mechanism.
 * Run with: npx vitest run tests/unit/htmlReportExporter.test.ts
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exportHtmlReport, downloadHtmlReport } from '../../src/utils/htmlReportExporter';
import type { HtmlReportData } from '../../src/utils/htmlReportExporter';

// ─── Test Helpers ───────────────────────────────────────────────────────

function createFullReportData(overrides: Partial<HtmlReportData> = {}): HtmlReportData {
  return {
    property: {
      address: '123 Main St, Denver, CO 80202',
      lat: 39.7392,
      lng: -104.9903,
    },
    measurement: {
      vertices: [
        { id: 'v1', lat: 39.7392, lng: -104.9903 },
        { id: 'v2', lat: 39.7393, lng: -104.9903 },
        { id: 'v3', lat: 39.7393, lng: -104.9901 },
        { id: 'v4', lat: 39.7392, lng: -104.9901 },
        { id: 'v5', lat: 39.73925, lng: -104.9902 },
      ],
      edges: [
        { id: 'e1', startVertexId: 'v1', endVertexId: 'v2', type: 'eave', lengthFt: 25.5 },
        { id: 'e2', startVertexId: 'v2', endVertexId: 'v3', type: 'rake', lengthFt: 18.3 },
        { id: 'e3', startVertexId: 'v3', endVertexId: 'v4', type: 'eave', lengthFt: 25.5 },
        { id: 'e4', startVertexId: 'v4', endVertexId: 'v1', type: 'rake', lengthFt: 18.3 },
        { id: 'e5', startVertexId: 'v2', endVertexId: 'v5', type: 'ridge', lengthFt: 12.0 },
        { id: 'e6', startVertexId: 'v5', endVertexId: 'v4', type: 'hip', lengthFt: 14.2 },
      ],
      facets: [
        {
          id: 'f1',
          name: 'South Face',
          pitch: 6,
          areaSqFt: 450,
          trueAreaSqFt: 475,
          vertexIds: ['v1', 'v2', 'v3', 'v4'],
        },
        {
          id: 'f2',
          name: 'North Face',
          pitch: 8,
          areaSqFt: 380,
          trueAreaSqFt: 410,
          vertexIds: ['v2', 'v3', 'v5'],
        },
      ],
      totalArea: 830,
      totalTrueArea: 885,
      suggestedWaste: 12,
    },
    generatedAt: '2025-06-15T10:30:00Z',
    confidence: 'High',
    dataSource: 'LIDAR + Solar API',
    ...overrides,
  };
}

function createMinimalReportData(): HtmlReportData {
  return {
    property: {
      address: '1 Test Rd',
      lat: 40.0,
      lng: -105.0,
    },
    measurement: {
      vertices: [
        { id: 'v1', lat: 40.0, lng: -105.0 },
        { id: 'v2', lat: 40.001, lng: -105.0 },
        { id: 'v3', lat: 40.001, lng: -104.999 },
      ],
      edges: [
        { id: 'e1', startVertexId: 'v1', endVertexId: 'v2', type: 'eave', lengthFt: 30 },
        { id: 'e2', startVertexId: 'v2', endVertexId: 'v3', type: 'rake', lengthFt: 20 },
        { id: 'e3', startVertexId: 'v3', endVertexId: 'v1', type: 'eave', lengthFt: 30 },
      ],
      facets: [
        {
          id: 'f1',
          name: 'Facet 1',
          pitch: 4,
          areaSqFt: 300,
          trueAreaSqFt: 310,
          vertexIds: ['v1', 'v2', 'v3'],
        },
      ],
      totalArea: 300,
      totalTrueArea: 310,
      suggestedWaste: 10,
    },
    generatedAt: '2025-06-15T10:00:00Z',
  };
}

function createEmptyReportData(): HtmlReportData {
  return {
    property: {
      address: '0 Empty Lane',
      lat: 35.0,
      lng: -100.0,
    },
    measurement: {
      vertices: [],
      edges: [],
      facets: [],
      totalArea: 0,
      totalTrueArea: 0,
      suggestedWaste: 0,
    },
    generatedAt: '2025-06-15T09:00:00Z',
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('exportHtmlReport', () => {
  it('produces a valid HTML document', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
  });

  it('contains the page title with property address', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('<title>SkyHawk Report - 123 Main St, Denver, CO 80202</title>');
  });

  it('includes all required sections', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('id="report-header"');
    expect(html).toContain('id="map-container"');
    expect(html).toContain('id="controls"');
    expect(html).toContain('id="facet-inspector"');
    expect(html).toContain('id="measurement-summary"');
    expect(html).toContain('id="facet-details-table"');
    expect(html).toContain('id="edge-summary"');
  });

  it('embeds CSS inline (no external stylesheets)', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
    // Should NOT have external stylesheet links
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
  });

  it('embeds JavaScript inline (no external scripts except Google Maps)', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('<script>');
    expect(html).toContain('</script>');
    // Should NOT have external script tags other than Google Maps callback
    expect(html).not.toMatch(/<script[^>]+src="(?!https:\/\/maps\.googleapis\.com)/);
  });

  it('embeds measurement data as REPORT_DATA JSON', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('const REPORT_DATA =');
    // Verify the JSON can be extracted and parsed
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    expect(match).not.toBeNull();
    if (match) {
      const parsed = JSON.parse(match[1]);
      expect(parsed.property.address).toBe('123 Main St, Denver, CO 80202');
      expect(parsed.property.lat).toBe(39.7392);
      expect(parsed.property.lng).toBe(-104.9903);
    }
  });

  it('serializes all vertices correctly', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed.measurement.vertices).toHaveLength(5);
    expect(parsed.measurement.vertices[0].id).toBe('v1');
    expect(parsed.measurement.vertices[0].lat).toBe(39.7392);
  });

  it('serializes all edges correctly', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    const parsed = JSON.parse(match![1]);
    expect(parsed.measurement.edges).toHaveLength(6);
    expect(parsed.measurement.edges[0].type).toBe('eave');
    expect(parsed.measurement.edges[4].type).toBe('ridge');
    expect(parsed.measurement.edges[5].type).toBe('hip');
  });

  it('serializes all facets correctly', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    const parsed = JSON.parse(match![1]);
    expect(parsed.measurement.facets).toHaveLength(2);
    expect(parsed.measurement.facets[0].name).toBe('South Face');
    expect(parsed.measurement.facets[0].pitch).toBe(6);
    expect(parsed.measurement.facets[0].areaSqFt).toBe(450);
    expect(parsed.measurement.facets[0].trueAreaSqFt).toBe(475);
    expect(parsed.measurement.facets[0].vertexIds).toEqual(['v1', 'v2', 'v3', 'v4']);
    expect(parsed.measurement.facets[1].name).toBe('North Face');
  });

  it('includes facet details in the HTML table', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('South Face');
    expect(html).toContain('North Face');
    expect(html).toContain('6/12');
    expect(html).toContain('8/12');
  });

  it('includes edge summary grouped by type', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('Ridge');
    expect(html).toContain('Hip');
    expect(html).toContain('Eave');
    expect(html).toContain('Rake');
  });

  it('includes measurement summary values', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('885 sq ft');
    expect(html).toContain('830 sq ft');
    expect(html).toContain('12%');
  });

  it('includes confidence and data source when provided', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('High Confidence');
    expect(html).toContain('LIDAR + Solar API');
  });

  it('includes Google Maps initialization code', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('function initMap()');
    expect(html).toContain('google.maps.Map');
    expect(html).toContain('google.maps.Polygon');
    expect(html).toContain('google.maps.Polyline');
  });

  it('includes API key prompt and URL param handling', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('api-key-input');
    expect(html).toContain('URLSearchParams');
    expect(html).toContain("params.get('key')");
    expect(html).toContain('maps.googleapis.com');
  });

  it('includes toggle control functions', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('function toggleWireframe()');
    expect(html).toContain('function toggleFacetLabels()');
    expect(html).toContain('function toggleEdgeLabels()');
    expect(html).toContain('function toggleMeasurements()');
    expect(html).toContain('function setMapType(');
  });

  it('includes click-to-inspect facet function', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('function selectFacet(');
    expect(html).toContain('inspector-name');
    expect(html).toContain('inspector-pitch');
    expect(html).toContain('inspector-true-area');
    expect(html).toContain('inspector-squares');
  });

  it('includes print-friendly styles', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('@media print');
  });

  it('includes responsive styles', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('@media (max-width: 768px)');
  });

  it('includes SkyHawk branding', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('SkyHawk');
    expect(html).toContain('Aerial Property Intelligence');
  });

  it('includes edge color mapping for wireframe rendering', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('const EDGE_COLORS =');
    expect(html).toContain('#ef4444'); // ridge color
    expect(html).toContain('#3b82f6'); // valley color
    expect(html).toContain('#10b981'); // rake color
  });
});

describe('exportHtmlReport — empty data handling', () => {
  it('handles empty measurement data gracefully', () => {
    const data = createEmptyReportData();
    const html = exportHtmlReport(data);

    // Should still produce valid HTML
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('id="measurement-summary"');
    expect(html).toContain('No facets measured');
    expect(html).toContain('No edges measured');
  });

  it('embeds empty arrays in REPORT_DATA for empty data', () => {
    const data = createEmptyReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed.measurement.vertices).toHaveLength(0);
    expect(parsed.measurement.edges).toHaveLength(0);
    expect(parsed.measurement.facets).toHaveLength(0);
    expect(parsed.measurement.totalArea).toBe(0);
  });

  it('shows 0 sq ft values for empty measurement', () => {
    const data = createEmptyReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('0 sq ft');
  });
});

describe('exportHtmlReport — minimal data (1 facet, 3 vertices)', () => {
  it('produces valid HTML with minimal data', () => {
    const data = createMinimalReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the single facet in the details table', () => {
    const data = createMinimalReportData();
    const html = exportHtmlReport(data);

    expect(html).toContain('Facet 1');
    expect(html).toContain('4/12');
  });

  it('serializes 3 vertices and 1 facet correctly', () => {
    const data = createMinimalReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    const parsed = JSON.parse(match![1]);
    expect(parsed.measurement.vertices).toHaveLength(3);
    expect(parsed.measurement.facets).toHaveLength(1);
    expect(parsed.measurement.edges).toHaveLength(3);
  });

  it('omits confidence and dataSource when not provided', () => {
    const data = createMinimalReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    const parsed = JSON.parse(match![1]);
    expect(parsed.confidence).toBeUndefined();
    expect(parsed.dataSource).toBeUndefined();
  });
});

describe('exportHtmlReport — special characters in address', () => {
  it('escapes HTML characters in property address', () => {
    const data = createFullReportData({
      property: {
        address: '123 <Main> & "Oak" St',
        lat: 39.0,
        lng: -105.0,
      },
    });
    const html = exportHtmlReport(data);

    // Address in title should be escaped
    expect(html).toContain('&lt;Main&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;Oak&quot;');
    // Should NOT contain unescaped < > in the title
    expect(html).not.toContain('<title>SkyHawk Report - 123 <Main>');
  });
});

describe('downloadHtmlReport', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let createdLink: HTMLAnchorElement | null;

  beforeEach(() => {
    clickSpy = vi.fn();
    createdLink = null;
    createObjectURLSpy = vi.fn().mockReturnValue('blob:test-url');
    revokeObjectURLSpy = vi.fn();

    // Mock URL.createObjectURL / revokeObjectURL
    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = revokeObjectURLSpy;

    // Intercept the <a> element creation to capture the link and spy on click
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const el = origCreateElement(tag, options);
      if (tag === 'a') {
        createdLink = el as HTMLAnchorElement;
        // Replace the click method with a spy
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Blob with HTML content type', () => {
    const data = createFullReportData();
    downloadHtmlReport(data);

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blob = createObjectURLSpy.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/html;charset=utf-8');
  });

  it('creates a download link and triggers click', () => {
    const data = createFullReportData();
    downloadHtmlReport(data);

    expect(createdLink).not.toBeNull();
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('uses default filename based on address and date', () => {
    const data = createFullReportData();
    downloadHtmlReport(data);

    expect(createdLink).not.toBeNull();
    expect(createdLink!.download).toMatch(/^SkyHawk-Report-123-Main-St-Denver-CO-80202-\d{4}-\d{2}-\d{2}\.html$/);
  });

  it('uses custom filename when provided', () => {
    const data = createFullReportData();
    downloadHtmlReport(data, 'my-custom-report.html');

    expect(createdLink).not.toBeNull();
    expect(createdLink!.download).toBe('my-custom-report.html');
  });

  it('sets href to the blob URL', () => {
    const data = createFullReportData();
    downloadHtmlReport(data);

    expect(createdLink).not.toBeNull();
    expect(createdLink!.href).toBe('blob:test-url');
  });

  it('cleans up by revoking object URL', async () => {
    vi.useFakeTimers();
    const data = createFullReportData();
    downloadHtmlReport(data);

    // Cleanup happens after setTimeout(100)
    await vi.advanceTimersByTimeAsync(200);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
    vi.useRealTimers();
  });
});

describe('exportHtmlReport — REPORT_DATA integrity', () => {
  it('preserves all numeric precision in serialized data', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    const parsed = JSON.parse(match![1]);

    expect(parsed.property.lat).toBe(39.7392);
    expect(parsed.property.lng).toBe(-104.9903);
    expect(parsed.measurement.edges[0].lengthFt).toBe(25.5);
    expect(parsed.measurement.facets[0].areaSqFt).toBe(450);
    expect(parsed.measurement.totalArea).toBe(830);
    expect(parsed.measurement.totalTrueArea).toBe(885);
    expect(parsed.measurement.suggestedWaste).toBe(12);
  });

  it('preserves all string values in serialized data', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    const parsed = JSON.parse(match![1]);

    expect(parsed.generatedAt).toBe('2025-06-15T10:30:00Z');
    expect(parsed.confidence).toBe('High');
    expect(parsed.dataSource).toBe('LIDAR + Solar API');
  });

  it('preserves vertex-to-facet id references', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    const parsed = JSON.parse(match![1]);

    // All vertex IDs referenced by facets should exist in vertices
    const vertexIds = new Set(parsed.measurement.vertices.map((v: { id: string }) => v.id));
    for (const facet of parsed.measurement.facets) {
      for (const vid of facet.vertexIds) {
        expect(vertexIds.has(vid)).toBe(true);
      }
    }
  });

  it('preserves vertex-to-edge id references', () => {
    const data = createFullReportData();
    const html = exportHtmlReport(data);
    const match = html.match(/const REPORT_DATA = ({.*?});/s);
    const parsed = JSON.parse(match![1]);

    const vertexIds = new Set(parsed.measurement.vertices.map((v: { id: string }) => v.id));
    for (const edge of parsed.measurement.edges) {
      expect(vertexIds.has(edge.startVertexId)).toBe(true);
      expect(vertexIds.has(edge.endVertexId)).toBe(true);
    }
  });
});
