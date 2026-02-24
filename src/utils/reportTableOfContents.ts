import jsPDF from 'jspdf';

/**
 * Table of Contents generator for EagleView-style PDF reports.
 * Produces a professional TOC page with dotted leaders between
 * section titles and page numbers.
 */

export interface TOCEntry {
  title: string;
  pageNumber: number;
  indent: number; // 0 = section, 1 = subsection
}

/**
 * Standard EagleView report sections.
 * Returns a default TOC template with placeholder page numbers.
 * Call with actual page numbers after layout is computed.
 */
export function getDefaultTOCSections(): TOCEntry[] {
  return [
    { title: 'Property Overview', pageNumber: 3, indent: 0 },
    { title: 'Roof Measurement Summary', pageNumber: 4, indent: 0 },
    { title: 'Wireframe Diagrams', pageNumber: 5, indent: 0 },
    { title: 'Length Diagram', pageNumber: 5, indent: 1 },
    { title: 'Area Diagram', pageNumber: 6, indent: 1 },
    { title: 'Pitch Diagram', pageNumber: 7, indent: 1 },
    { title: 'Facet Details', pageNumber: 8, indent: 0 },
    { title: 'Oblique Imagery', pageNumber: 9, indent: 0 },
    { title: 'Solar Analysis', pageNumber: 10, indent: 0 },
    { title: 'Damage Assessment', pageNumber: 11, indent: 0 },
    { title: 'Material Estimate', pageNumber: 12, indent: 0 },
    { title: 'Appendix', pageNumber: 13, indent: 0 },
  ];
}

/**
 * Generate a TOC from the provided sections.
 * Filters out entries with pageNumber <= 0 (disabled sections)
 * and returns the final ordered list.
 */
export function generateTOC(sections: TOCEntry[]): TOCEntry[] {
  return sections
    .filter((entry) => entry.pageNumber > 0)
    .sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Build a dotted leader string that fills the gap between
 * a title and its page number.
 */
function buildDottedLeader(doc: jsPDF, titleWidth: number, pageNumWidth: number, availableWidth: number): string {
  const dotChar = '.';
  doc.setFont('helvetica', 'normal');
  const dotWidth = doc.getTextWidth(dotChar + ' ');
  const gapWidth = availableWidth - titleWidth - pageNumWidth - 10; // 10mm padding
  if (gapWidth <= 0) return '';
  const numDots = Math.floor(gapWidth / dotWidth);
  return (dotChar + ' ').repeat(Math.max(0, numDots));
}

// Colors matching reportGenerator.ts
const PRIMARY_COLOR: [number, number, number] = [37, 120, 235];
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const GRAY_TEXT: [number, number, number] = [120, 120, 120];

/**
 * Render a Table of Contents page onto the given jsPDF document.
 * Adds the TOC content at the current page. Does not call addPage().
 */
export function renderTOCPage(
  doc: jsPDF,
  entries: TOCEntry[],
  pageWidth: number,
  pageHeight: number
): void {
  const margin = 19.05; // 0.75 inches in mm
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Title
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text('TABLE OF CONTENTS', margin, y + 6);
  y += 14;

  // Horizontal rule under title
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  for (const entry of entries) {
    if (y + 8 > pageHeight - margin) break; // safety: don't overflow page

    const indentX = margin + entry.indent * 10;
    const fontSize = entry.indent === 0 ? 11 : 10;
    const fontStyle = entry.indent === 0 ? 'bold' : 'normal';
    const textColor: [number, number, number] = entry.indent === 0 ? DARK_TEXT : GRAY_TEXT;

    // Title text
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(...textColor);
    const titleWidth = doc.getTextWidth(entry.title);
    doc.text(entry.title, indentX, y);

    // Page number (right-aligned)
    const pageStr = String(entry.pageNumber);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const pageNumWidth = doc.getTextWidth(pageStr);
    const pageNumX = pageWidth - margin - pageNumWidth;
    doc.text(pageStr, pageNumX, y);

    // Dotted leader between title and page number
    doc.setTextColor(...GRAY_TEXT);
    doc.setFontSize(fontSize);
    const leader = buildDottedLeader(doc, titleWidth, pageNumWidth, contentWidth - entry.indent * 10);
    if (leader) {
      const leaderX = indentX + titleWidth + 3;
      doc.text(leader, leaderX, y);
    }

    y += entry.indent === 0 ? 8 : 6.5;
  }
}
