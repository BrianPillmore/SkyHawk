import jsPDF from 'jspdf';
import type { Property, RoofMeasurement } from '../types';
import { formatArea, formatLength, formatPitch, formatNumber, calculateWasteTable, pitchToDegrees } from './geometry';

interface ReportOptions {
  companyName: string;
  notes: string;
}

export async function generateReport(
  property: Property,
  measurement: RoofMeasurement,
  options: ReportOptions
): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [37, 120, 235]; // skyhawk-600
  const darkText: [number, number, number] = [30, 30, 30];
  const grayText: [number, number, number] = [120, 120, 120];
  const lightBg: [number, number, number] = [245, 245, 245];

  // Helper functions
  function addText(text: string, x: number, yPos: number, size: number, color: [number, number, number] = darkText, style: string = 'normal') {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont('helvetica', style);
    doc.text(text, x, yPos);
    return yPos + size * 0.5;
  }

  function addLine(y: number) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    return y + 3;
  }

  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // ============ HEADER ============
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  addText('SKYHAWK', margin, 15, 22, [255, 255, 255], 'bold');
  addText('ROOF MEASUREMENT REPORT', margin, 25, 10, [200, 220, 255], 'normal');
  addText(options.companyName, pageWidth - margin, 15, 9, [200, 220, 255], 'normal');
  doc.setFont('helvetica', 'normal');
  // Right-align the company name
  const companyWidth = doc.getTextWidth(options.companyName);
  doc.setTextColor(200, 220, 255);
  doc.text(options.companyName, pageWidth - margin - companyWidth + companyWidth, 15);

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  addText(`Report Date: ${reportDate}`, pageWidth - margin - doc.getTextWidth(`Report Date: ${reportDate}`), 25, 8, [200, 220, 255]);

  y = 45;

  // ============ PROPERTY INFO ============
  y = addText('PROPERTY INFORMATION', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 2;

  const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip}`;
  y = addText(fullAddress, margin, y, 10, darkText, 'bold');
  y += 2;
  y = addText(`Coordinates: ${property.lat.toFixed(6)}, ${property.lng.toFixed(6)}`, margin, y, 8, grayText);
  y += 8;

  // ============ ROOF SUMMARY ============
  checkPage(60);
  y = addText('ROOF MEASUREMENT SUMMARY', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 4;

  // Summary table
  const summaryData = [
    ['Total Roof Area (True)', formatArea(measurement.totalTrueAreaSqFt)],
    ['Total Projected Area', formatArea(measurement.totalAreaSqFt)],
    ['Total Squares', formatNumber(measurement.totalSquares, 1)],
    ['Predominant Pitch', formatPitch(measurement.predominantPitch)],
    ['Number of Facets', String(measurement.facets.length)],
    ['Suggested Waste Factor', `${measurement.suggestedWastePercent}%`],
  ];

  for (let i = 0; i < summaryData.length; i++) {
    const rowY = y + i * 7;
    if (i % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
    }
    addText(summaryData[i][0], margin + 3, rowY, 9, grayText);
    addText(summaryData[i][1], pageWidth - margin - 3 - doc.getTextWidth(summaryData[i][1]), rowY, 9, darkText, 'bold');
  }
  y += summaryData.length * 7 + 6;

  // ============ LINE MEASUREMENTS ============
  checkPage(60);
  y = addText('LINE MEASUREMENTS', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 4;

  const lineData: [string, string, number][] = [
    ['Ridges', formatLength(measurement.totalRidgeLf), measurement.edges.filter(e => e.type === 'ridge').length],
    ['Hips', formatLength(measurement.totalHipLf), measurement.edges.filter(e => e.type === 'hip').length],
    ['Valleys', formatLength(measurement.totalValleyLf), measurement.edges.filter(e => e.type === 'valley').length],
    ['Rakes/Gables', formatLength(measurement.totalRakeLf), measurement.edges.filter(e => e.type === 'rake').length],
    ['Eaves', formatLength(measurement.totalEaveLf), measurement.edges.filter(e => e.type === 'eave').length],
    ['Flashing', formatLength(measurement.totalFlashingLf), measurement.edges.filter(e => e.type === 'flashing' || e.type === 'step-flashing').length],
    ['Drip Edge (Total)', formatLength(measurement.totalDripEdgeLf), 0],
  ];

  // Table header
  doc.setFillColor(...primaryColor);
  doc.rect(margin, y - 4, contentWidth, 7, 'F');
  addText('Type', margin + 3, y, 8, [255, 255, 255], 'bold');
  addText('Count', margin + contentWidth * 0.5, y, 8, [255, 255, 255], 'bold');
  addText('Total Length', margin + contentWidth * 0.75, y, 8, [255, 255, 255], 'bold');
  y += 7;

  for (let i = 0; i < lineData.length; i++) {
    const rowY = y + i * 7;
    if (i % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
    }
    addText(lineData[i][0], margin + 3, rowY, 9, darkText);
    if (lineData[i][2] > 0) {
      addText(String(lineData[i][2]), margin + contentWidth * 0.5, rowY, 9, grayText);
    }
    addText(lineData[i][1], margin + contentWidth * 0.75, rowY, 9, darkText, 'bold');
  }
  y += lineData.length * 7 + 6;

  // ============ FACET DETAILS ============
  checkPage(40);
  y = addText('FACET DETAILS', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 4;

  // Facet table header
  doc.setFillColor(...primaryColor);
  doc.rect(margin, y - 4, contentWidth, 7, 'F');
  addText('Facet', margin + 3, y, 8, [255, 255, 255], 'bold');
  addText('Pitch', margin + contentWidth * 0.35, y, 8, [255, 255, 255], 'bold');
  addText('Angle', margin + contentWidth * 0.5, y, 8, [255, 255, 255], 'bold');
  addText('Flat Area', margin + contentWidth * 0.63, y, 8, [255, 255, 255], 'bold');
  addText('True Area', margin + contentWidth * 0.82, y, 8, [255, 255, 255], 'bold');
  y += 7;

  for (let i = 0; i < measurement.facets.length; i++) {
    checkPage(10);
    const facet = measurement.facets[i];
    const rowY = y + i * 7;
    if (i % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
    }
    addText(facet.name, margin + 3, rowY, 9, darkText);
    addText(formatPitch(facet.pitch), margin + contentWidth * 0.35, rowY, 9, darkText);
    addText(`${pitchToDegrees(facet.pitch).toFixed(1)}°`, margin + contentWidth * 0.5, rowY, 9, grayText);
    addText(formatArea(facet.areaSqFt), margin + contentWidth * 0.63, rowY, 9, grayText);
    addText(formatArea(facet.trueAreaSqFt), margin + contentWidth * 0.82, rowY, 9, darkText, 'bold');
  }
  y += measurement.facets.length * 7 + 6;

  // ============ WASTE FACTOR TABLE ============
  checkPage(60);
  y = addText('WASTE FACTOR CALCULATION TABLE', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 2;
  y = addText('The suggested waste factor is intended to serve as a guide. Actual waste may differ based on', margin, y, 7, grayText);
  y += 3;
  y = addText('installation techniques, crew experience, material type, and potential site salvage.', margin, y, 7, grayText);
  y += 5;

  const wasteTable = calculateWasteTable(measurement.totalTrueAreaSqFt);

  // Waste table header
  doc.setFillColor(...primaryColor);
  doc.rect(margin, y - 4, contentWidth, 7, 'F');
  addText('Waste %', margin + 3, y, 8, [255, 255, 255], 'bold');
  addText('Total Area (sq ft)', margin + contentWidth * 0.4, y, 8, [255, 255, 255], 'bold');
  addText('Squares', margin + contentWidth * 0.75, y, 8, [255, 255, 255], 'bold');
  y += 7;

  for (let i = 0; i < wasteTable.length; i++) {
    const row = wasteTable[i];
    const rowY = y + i * 7;
    const isSuggested = row.wastePercent === measurement.suggestedWastePercent;

    if (isSuggested) {
      doc.setFillColor(219, 234, 254); // light blue highlight
    } else if (i % 2 === 0) {
      doc.setFillColor(...lightBg);
    }
    if (isSuggested || i % 2 === 0) {
      doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
    }

    const label = isSuggested ? `${row.wastePercent}% (suggested)` : `${row.wastePercent}%`;
    addText(label, margin + 3, rowY, 9, isSuggested ? primaryColor : darkText, isSuggested ? 'bold' : 'normal');
    addText(formatArea(row.totalAreaWithWaste), margin + contentWidth * 0.4, rowY, 9, darkText);
    addText(formatNumber(row.totalSquaresWithWaste, 1), margin + contentWidth * 0.75, rowY, 9, darkText, 'bold');
  }
  y += wasteTable.length * 7 + 6;

  // ============ NOTES ============
  if (options.notes) {
    checkPage(30);
    y = addText('NOTES', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 4;
    const lines = doc.splitTextToSize(options.notes, contentWidth - 6);
    doc.setFontSize(9);
    doc.setTextColor(...darkText);
    doc.text(lines, margin + 3, y);
    y += lines.length * 4 + 6;
  }

  // ============ FOOTER ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(245, 245, 245);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by SkyHawk Aerial Property Intelligence | ${reportDate} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
    doc.text('CONFIDENTIAL', margin, pageHeight - 7);
  }

  // Save
  const filename = `SkyHawk-Roof-Report-${property.address.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
