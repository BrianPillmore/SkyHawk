/**
 * HTML Report Exporter for SkyHawk.
 * Serializes measurement data and generates a self-contained interactive HTML report.
 */

import { generateHtmlTemplate } from './htmlReportTemplate';

// ─── Data Interface ────────────────────────────────────────────────────

export interface HtmlReportData {
  property: {
    address: string;
    lat: number;
    lng: number;
  };
  measurement: {
    vertices: { id: string; lat: number; lng: number }[];
    edges: {
      id: string;
      startVertexId: string;
      endVertexId: string;
      type: string;
      lengthFt: number;
    }[];
    facets: {
      id: string;
      name: string;
      pitch: number;
      areaSqFt: number;
      trueAreaSqFt: number;
      vertexIds: string[];
    }[];
    totalArea: number;
    totalTrueArea: number;
    suggestedWaste: number;
  };
  generatedAt: string;
  confidence?: string;
  dataSource?: string;
}

// ─── Export Functions ───────────────────────────────────────────────────

/**
 * Generate the complete HTML string for an interactive report.
 * Returns a self-contained HTML document as a string.
 */
export function exportHtmlReport(data: HtmlReportData): string {
  return generateHtmlTemplate(data);
}

/**
 * Trigger a browser download of the interactive HTML report.
 * Creates a Blob, generates a temporary download link, and clicks it.
 */
export function downloadHtmlReport(data: HtmlReportData, filename?: string): void {
  const html = exportHtmlReport(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const sanitizedAddress = data.property.address
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);
  const date = new Date().toISOString().slice(0, 10);
  const defaultFilename = `SkyHawk-Report-${sanitizedAddress}-${date}.html`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
