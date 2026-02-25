import jsPDF from 'jspdf';
import type { Property, RoofMeasurement, RoofConditionAssessment, DamageSeverity } from '../types';
import { DAMAGE_TYPE_LABELS, CLAIM_STATUS_LABELS, ROOF_MATERIAL_LABELS } from '../types';
import { formatArea, formatLength, formatPitch, formatNumber, calculateWasteTable, pitchToDegrees } from './geometry';
import { estimateMaterials, estimateMaterialCosts, formatCurrency } from './materials';
import { analyzeSolarPotential, analyzeSolarPotentialFromApi, DEFAULT_SOLAR_CONFIG } from './solarCalculations';
import type { SolarSystemSummary } from './solarCalculations';
import type { SolarBuildingInsights } from '../types/solar';
import { computePanelLayout, renderPanelLayoutDiagram } from './solarPanelLayout';
import { computeAccuracyScore } from './accuracyScore';
import { calculateEnvironmentalImpact } from './environmentalImpact';
import { generateTOC, renderTOCPage } from './reportTableOfContents';
import type { TOCEntry } from './reportTableOfContents';
import { renderSummaryPage, applyPageDecoration } from './reportPageTemplates';
import type { ReportSummaryData } from './reportPageTemplates';

interface ReportOptions {
  companyName: string;
  notes: string;
  mapScreenshot?: string; // base64 data URL from html2canvas
  includeDamage?: boolean;
  includeClaims?: boolean;
  includeMultiStructure?: boolean;
  includeSolar?: boolean;
  latitude?: number;
  solarInsights?: SolarBuildingInsights | null;
  includeLengthDiagram?: boolean;
  includeAreaDiagram?: boolean;
  includePitchDiagram?: boolean;
  includeObliqueViews?: boolean;
  lengthDiagramImage?: string; // base64 data URL
  areaDiagramImage?: string;   // base64 data URL
  pitchDiagramImage?: string;  // base64 data URL
  obliqueViews?: { north?: string; south?: string; east?: string; west?: string }; // base64 data URLs
  includeSolarPanelLayout?: boolean;
  roofCondition?: RoofConditionAssessment | null;
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
  const primaryColor: [number, number, number] = [37, 120, 235]; // gotruf-600
  const darkText: [number, number, number] = [30, 30, 30];
  const grayText: [number, number, number] = [120, 120, 120];
  const lightBg: [number, number, number] = [245, 245, 245];

  const DAMAGE_SEVERITY_COLORS_RGB: Record<DamageSeverity, [number, number, number]> = {
    minor: [245, 158, 11],
    moderate: [249, 115, 22],
    severe: [239, 68, 68],
  };

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

  addText('GOTRUF', margin, 15, 22, [255, 255, 255], 'bold');
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
  y += 4;

  // ============ CONFIDENCE BADGE WITH ACCURACY SCORE ============
  const accuracy = computeAccuracyScore(measurement, options.solarInsights);
  const dataSourceLabel = measurement.dataSource === 'lidar-mask' ? 'LIDAR + Solar API'
    : measurement.dataSource === 'hybrid' ? 'Solar API + AI Vision'
    : measurement.dataSource === 'ai-vision' ? 'AI Vision'
    : 'Manual Measurement';
  const isMediumQuality = measurement.imageryQuality === 'MEDIUM';

  const badgeHeight = isMediumQuality ? 22 : 17;
  const isHighAccuracy = accuracy.overallScore >= 80;
  const badgeColor: [number, number, number] = isMediumQuality ? [254, 243, 199]
    : isHighAccuracy ? [220, 252, 231] : [219, 234, 254];
  const badgeAccentColor: [number, number, number] = isMediumQuality ? [234, 179, 8]
    : isHighAccuracy ? [22, 163, 74] : [37, 120, 235];
  doc.setFillColor(...badgeColor);
  doc.rect(margin, y, contentWidth, badgeHeight, 'F');
  doc.setFillColor(...badgeAccentColor);
  doc.rect(margin, y, 4, badgeHeight, 'F');

  // Accuracy score and grade on the right
  const scoreText = `${accuracy.grade} — ${accuracy.overallScore}/100`;
  const scoreWidth = doc.getTextWidth(scoreText) + 4;
  addText(`SkyHawk Verified — ${accuracy.label}`, margin + 8, y + 5, 8, primaryColor, 'bold');
  addText(scoreText, pageWidth - margin - scoreWidth, y + 5, 8, badgeAccentColor, 'bold');
  addText(`Source: ${dataSourceLabel}`, margin + 8, y + 10, 7, grayText);
  if (accuracy.areaDeltaPercent !== undefined) {
    addText(`Solar API cross-check: ${accuracy.areaDeltaPercent.toFixed(1)}% deviation`, margin + 8, y + 15, 6.5, grayText);
  }
  if (isMediumQuality) {
    const warningColor: [number, number, number] = [161, 98, 7];
    addText('Imagery quality: MEDIUM — measurements may have reduced accuracy', margin + 8, y + (accuracy.areaDeltaPercent !== undefined ? 20 : 15), 6.5, warningColor);
  }
  y += badgeHeight + 4;

  // ============ MAP SCREENSHOT (HERO IMAGE) ============
  if (options.mapScreenshot) {
    checkPage(110);
    y = addText('AERIAL VIEW', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 3;

    try {
      const imgWidth = contentWidth;
      const imgHeight = imgWidth * 0.6; // 5:3 aspect ratio
      doc.addImage(options.mapScreenshot, 'PNG', margin, y, imgWidth, imgHeight);
      y += imgHeight + 3;
      y = addText('Satellite imagery with roof measurement overlay', margin, y, 7, grayText);
      y += 6;
    } catch {
      // If image fails to embed, skip silently
      y += 2;
    }
  }

  // ============ TABLE OF CONTENTS (Page 2) ============
  doc.addPage();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Build TOC entries — page numbers are approximate and assigned after layout.
  // We use a simple incrementing page counter for the TOC. Page 1 = hero,
  // page 2 = TOC, page 3+ = content. We'll correct page numbers at the end
  // using the applyPageDecoration pass.
  const tocSections: TOCEntry[] = [];
  let tocPageNum = 3; // Content starts at page 3
  tocSections.push({ title: 'Property Overview', pageNumber: tocPageNum, indent: 0 });
  if (options.roofCondition) {
    tocSections.push({ title: 'Property Intelligence', pageNumber: tocPageNum, indent: 0 });
  }
  tocSections.push({ title: 'Roof Measurement Summary', pageNumber: tocPageNum, indent: 0 });
  tocPageNum++;
  if (options.includeLengthDiagram || options.includeAreaDiagram || options.includePitchDiagram) {
    tocSections.push({ title: 'Wireframe Diagrams', pageNumber: tocPageNum, indent: 0 });
    if (options.includeLengthDiagram) {
      tocSections.push({ title: 'Length Diagram', pageNumber: tocPageNum, indent: 1 });
      tocPageNum++;
    }
    if (options.includeAreaDiagram) {
      tocSections.push({ title: 'Area Diagram', pageNumber: tocPageNum, indent: 1 });
      tocPageNum++;
    }
    if (options.includePitchDiagram) {
      tocSections.push({ title: 'Pitch Diagram', pageNumber: tocPageNum, indent: 1 });
      tocPageNum++;
    }
  }
  tocSections.push({ title: 'Facet Details', pageNumber: tocPageNum, indent: 0 });
  tocPageNum++;
  if (options.includeObliqueViews && options.obliqueViews) {
    tocSections.push({ title: 'Oblique Imagery', pageNumber: tocPageNum, indent: 0 });
    tocPageNum++;
  }
  if (options.includeSolar) {
    tocSections.push({ title: 'Solar Analysis', pageNumber: tocPageNum, indent: 0 });
    tocPageNum++;
  }
  const damageAnnotationsForToc = property.damageAnnotations ?? [];
  if (options.includeDamage !== false && damageAnnotationsForToc.length > 0) {
    tocSections.push({ title: 'Damage Assessment', pageNumber: tocPageNum, indent: 0 });
    tocPageNum++;
  }
  tocSections.push({ title: 'Material Estimate & Cost', pageNumber: tocPageNum, indent: 0 });
  tocPageNum++;
  tocSections.push({ title: 'Appendix: Methodology & Data Sources', pageNumber: tocPageNum, indent: 0 });

  const tocEntries = generateTOC(tocSections);
  renderTOCPage(doc, tocEntries, pageWidth, pageHeight);

  // ============ KEY METRICS SUMMARY (Page 3) ============
  doc.addPage();
  const keyMetrics: ReportSummaryData = {
    totalAreaSquares: measurement.totalSquares,
    predominantPitch: measurement.predominantPitch,
    numberOfFacets: measurement.facets.length,
    totalRidgeHipLf: measurement.totalRidgeLf + measurement.totalHipLf,
    totalValleyLf: measurement.totalValleyLf,
    totalRakeEaveLf: measurement.totalRakeLf + measurement.totalEaveLf,
  };
  y = renderSummaryPage(doc, keyMetrics);

  // ============ FULL PROPERTY OVERVIEW ============
  checkPage(50);
  y = addText('FULL PROPERTY OVERVIEW', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 4;

  const totalStructures = (property.measurements ?? []).length;
  const totalDamageMarkers = (property.damageAnnotations ?? []).length;
  const activeClaims = (property.claims ?? []).filter(c => c.status !== 'closed').length;
  const propertyCreated = new Date(property.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const overviewData = [
    ['Total Structures', String(totalStructures)],
    ['Total Damage Markers', String(totalDamageMarkers)],
    ['Active Claims', String(activeClaims)],
    ['Property Created', propertyCreated],
  ];

  for (let i = 0; i < overviewData.length; i++) {
    const rowY = y + i * 7;
    if (i % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
    }
    addText(overviewData[i][0], margin + 3, rowY, 9, grayText);
    addText(overviewData[i][1], pageWidth - margin - 3 - doc.getTextWidth(overviewData[i][1]), rowY, 9, darkText, 'bold');
  }
  y += overviewData.length * 7 + 6;

  // ============ PROPERTY INTELLIGENCE (Roof Condition) ============
  if (options.roofCondition) {
    const rc = options.roofCondition;
    checkPage(50);
    y = addText('PROPERTY INTELLIGENCE', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 4;

    const conditionColor: [number, number, number] =
      rc.category === 'excellent' || rc.category === 'good' ? [22, 163, 74]
      : rc.category === 'fair' ? [234, 179, 8]
      : [220, 38, 38];

    const conditionData: string[][] = [
      ['Roof Condition', `${rc.category.charAt(0).toUpperCase() + rc.category.slice(1)} (${rc.overallScore}/100)`],
      ['Roof Material', ROOF_MATERIAL_LABELS[rc.materialType] || rc.materialType],
      ['Estimated Roof Age', `${rc.estimatedAgeYears} years`],
      ['Estimated Remaining Life', `${rc.estimatedRemainingLifeYears} years`],
    ];

    for (let i = 0; i < conditionData.length; i++) {
      const rowY = y + i * 7;
      if (i % 2 === 0) {
        doc.setFillColor(...lightBg);
        doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
      }
      addText(conditionData[i][0], margin + 3, rowY, 9, grayText);
      const valueColor = i === 0 ? conditionColor : darkText;
      addText(conditionData[i][1], pageWidth - margin - 3 - doc.getTextWidth(conditionData[i][1]), rowY, 9, valueColor, i === 0 ? 'bold' : 'normal');
    }
    y += conditionData.length * 7 + 4;

    // Key findings
    if (rc.findings.length > 0) {
      addText('Key Findings:', margin + 3, y, 8, darkText, 'bold');
      y += 5;
      for (const finding of rc.findings.slice(0, 4)) {
        checkPage(8);
        addText(`  • ${finding}`, margin + 5, y, 7.5, grayText);
        y += 5;
      }
    }
    y += 4;
  }

  // ============ ROOF SUMMARY ============
  checkPage(60);
  y = addText('ROOF MEASUREMENT SUMMARY', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 4;

  // Summary table
  const summaryRows: string[][] = [
    ['Total Roof Area (True)', formatArea(measurement.totalTrueAreaSqFt)],
    ['Total Projected Area', formatArea(measurement.totalAreaSqFt)],
    ['Total Squares', formatNumber(measurement.totalSquares, 1)],
    ['Predominant Pitch', formatPitch(measurement.predominantPitch)],
    ['Number of Facets', String(measurement.facets.length)],
    ['Structure Complexity', measurement.structureComplexity || 'Simple'],
    ['Estimated Attic Area', measurement.estimatedAtticSqFt ? formatArea(measurement.estimatedAtticSqFt) : 'N/A'],
    ['Suggested Waste Factor', `${measurement.suggestedWastePercent}%`],
  ];
  // Add building height and imagery quality rows when available
  if (measurement.buildingHeightFt) {
    summaryRows.push(['Building Height', `${measurement.buildingHeightFt.toFixed(0)} ft (${measurement.stories ?? '?'} ${(measurement.stories ?? 0) === 1 ? 'story' : 'stories'})`]);
  }
  if (measurement.imageryQuality) {
    summaryRows.push(['Imagery Quality', measurement.imageryQuality]);
  }
  if (measurement.solarApiAreaSqFt) {
    summaryRows.push(['Solar API Cross-Check Area', formatArea(measurement.solarApiAreaSqFt)]);
  }

  const summaryData = summaryRows;

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

  // ============ AREAS PER PITCH ============
  const pitchBreakdown = measurement.pitchBreakdown ?? [];
  if (pitchBreakdown.length > 0) {
    checkPage(40);
    y = addText('AREAS PER PITCH', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 4;

    // Pitch table header
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    addText('Roof Pitch', margin + 3, y, 8, [255, 255, 255], 'bold');
    addText('Area (sq ft)', margin + contentWidth * 0.45, y, 8, [255, 255, 255], 'bold');
    addText('% of Roof', margin + contentWidth * 0.78, y, 8, [255, 255, 255], 'bold');
    y += 7;

    for (let i = 0; i < pitchBreakdown.length; i++) {
      checkPage(10);
      const entry = pitchBreakdown[i];
      const rowY = y + i * 7;
      const isPredominant = entry.pitch === measurement.predominantPitch;
      if (isPredominant) {
        doc.setFillColor(219, 234, 254);
        doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
      } else if (i % 2 === 0) {
        doc.setFillColor(...lightBg);
        doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
      }
      addText(formatPitch(entry.pitch), margin + 3, rowY, 9, isPredominant ? primaryColor : darkText, isPredominant ? 'bold' : 'normal');
      addText(formatNumber(entry.areaSqFt, 1), margin + contentWidth * 0.45, rowY, 9, darkText);
      addText(`${entry.percentOfRoof}%`, margin + contentWidth * 0.78, rowY, 9, darkText, 'bold');
    }
    y += pitchBreakdown.length * 7 + 6;
  }

  // ============ LINE MEASUREMENTS ============
  checkPage(60);
  y = addText('LINE MEASUREMENTS', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 4;

  const lineData: [string, string, number][] = [
    ['Ridges', formatLength(measurement.totalRidgeLf), measurement.ridgeCount],
    ['Hips', formatLength(measurement.totalHipLf), measurement.hipCount],
    ['Valleys', formatLength(measurement.totalValleyLf), measurement.valleyCount],
    ['Rakes', formatLength(measurement.totalRakeLf), measurement.rakeCount],
    ['Eaves/Starter', formatLength(measurement.totalEaveLf), measurement.eaveCount],
    ['Drip Edge (Eaves + Rakes)', formatLength(measurement.totalDripEdgeLf), measurement.rakeCount + measurement.eaveCount],
    ['Flashing', formatLength(measurement.totalFlashingLf), measurement.flashingCount],
    ['Step Flashing', formatLength(measurement.totalStepFlashingLf ?? 0), measurement.stepFlashingCount],
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
  addText('Pitch', margin + contentWidth * 0.28, y, 8, [255, 255, 255], 'bold');
  addText('Angle', margin + contentWidth * 0.40, y, 8, [255, 255, 255], 'bold');
  addText('Flat Area', margin + contentWidth * 0.52, y, 8, [255, 255, 255], 'bold');
  addText('True Area', margin + contentWidth * 0.70, y, 8, [255, 255, 255], 'bold');
  addText('Squares', margin + contentWidth * 0.88, y, 8, [255, 255, 255], 'bold');
  y += 7;

  let totalFlatArea = 0;
  let totalTrueArea = 0;
  let totalFacetSquares = 0;

  for (let i = 0; i < measurement.facets.length; i++) {
    checkPage(10);
    const facet = measurement.facets[i];
    const rowY = y + i * 7;
    if (i % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
    }
    // Show numbered facet name (e.g. "#1 South" or "Facet 1")
    const displayName = facet.name.startsWith('#') ? facet.name : `#${i + 1} ${facet.name}`;
    const facetSquares = facet.trueAreaSqFt / 100;
    addText(displayName, margin + 3, rowY, 9, darkText);
    addText(formatPitch(facet.pitch), margin + contentWidth * 0.28, rowY, 9, darkText);
    addText(`${pitchToDegrees(facet.pitch).toFixed(1)}°`, margin + contentWidth * 0.40, rowY, 9, grayText);
    addText(formatArea(facet.areaSqFt), margin + contentWidth * 0.52, rowY, 9, grayText);
    addText(formatArea(facet.trueAreaSqFt), margin + contentWidth * 0.70, rowY, 9, darkText, 'bold');
    addText(formatNumber(facetSquares, 1), margin + contentWidth * 0.88, rowY, 9, darkText);
    totalFlatArea += facet.areaSqFt;
    totalTrueArea += facet.trueAreaSqFt;
    totalFacetSquares += facetSquares;
  }
  y += measurement.facets.length * 7;

  // Totals row
  if (measurement.facets.length > 0) {
    checkPage(10);
    doc.setFillColor(219, 234, 254); // light blue highlight
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    addText('TOTAL', margin + 3, y, 9, primaryColor, 'bold');
    addText(formatArea(totalFlatArea), margin + contentWidth * 0.52, y, 9, primaryColor, 'bold');
    addText(formatArea(totalTrueArea), margin + contentWidth * 0.70, y, 9, primaryColor, 'bold');
    addText(formatNumber(totalFacetSquares, 1), margin + contentWidth * 0.88, y, 9, primaryColor, 'bold');
    y += 7;
  }
  y += 6;

  // ============ WASTE FACTOR TABLE ============
  checkPage(60);
  y = addText('WASTE FACTOR CALCULATION TABLE', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 2;
  y = addText('This waste calculation table is for asphalt shingle roofing applications. The suggested waste factor is intended', margin, y, 7, grayText);
  y += 3;
  y = addText('to serve as a guide. Actual waste may differ based on installation techniques, crew experience, and material type.', margin, y, 7, grayText);
  y += 5;

  const wasteTable = calculateWasteTable(measurement.totalTrueAreaSqFt, measurement.suggestedWastePercent);

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
    addText(formatNumber(row.totalSquaresWithWaste, 2), margin + contentWidth * 0.75, rowY, 9, darkText, 'bold');
  }
  y += wasteTable.length * 7 + 6;

  // ============ MATERIAL ESTIMATES ============
  if (measurement.totalSquares > 0) {
    checkPage(80);
    y = addText('MATERIAL ESTIMATES', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 2;
    y = addText(
      `Based on ${measurement.suggestedWastePercent}% waste factor. Quantities are approximate and may vary by material type and installation method.`,
      margin, y, 7, grayText
    );
    y += 5;

    const materials = estimateMaterials(measurement);
    const materialRows: [string, string, string][] = [
      ['Shingle Bundles', String(materials.shingleBundles), '3 bundles per square'],
      ['Hip & Ridge Shingles', `${materials.hipRidgeBundles} bundles`, '1 bundle per 35 lf'],
      ['Underlayment', `${materials.underlaymentRolls} rolls`, '~4 squares per roll'],
      ['Ice & Water Shield', `${materials.iceWaterRolls} rolls`, 'At eave edges'],
      ['Starter Strip', `${materials.starterStripLf} lf`, 'Eave + rake perimeter'],
      ['Ridge Cap', `${materials.ridgeCapLf} lf`, 'Ridge + hip lines'],
      ['Valley Metal', `${materials.valleyMetalLf} lf`, 'Valley edges (W-valley)'],
      ['Drip Edge', `${materials.dripEdgeLf} lf`, 'Eave + rake edges'],
      ['Step Flashing', `${materials.stepFlashingPcs} pcs`, 'Wall junctions'],
      ['Roof-to-Wall Flashing', `${materials.roofToWallFlashingPcs} pcs`, '10 ft L-metal pieces'],
      ['Pipe Boots', `${materials.pipeBoots} pcs`, 'Est. 1 per 1,000 sq ft'],
      ['Coil Nails', `${materials.coilNailBoxes} boxes`, '7,200 nails/box'],
      ['Hand Nails', `${materials.nailsLbs} lbs`, '~1.75 lbs per square'],
      ['Caulk', `${materials.caulkTubes} tubes`, '1 per 25 lf flashing'],
      ['Ridge Vent', `${materials.ridgeVentLf} lf`, 'Full ridge length'],
      ['Sheathing (OSB)', `${materials.sheathingSheets} sheets`, '4x8 ft (tear-off)'],
    ];

    // Filter out zero-quantity rows
    const activeRows = materialRows.filter((r) => !r[1].startsWith('0'));

    // Table header
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    addText('Material', margin + 3, y, 8, [255, 255, 255], 'bold');
    addText('Quantity', margin + contentWidth * 0.45, y, 8, [255, 255, 255], 'bold');
    addText('Basis', margin + contentWidth * 0.7, y, 8, [255, 255, 255], 'bold');
    y += 7;

    for (let i = 0; i < activeRows.length; i++) {
      checkPage(10);
      const rowY = y + i * 7;
      if (i % 2 === 0) {
        doc.setFillColor(...lightBg);
        doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
      }
      addText(activeRows[i][0], margin + 3, rowY, 9, darkText);
      addText(activeRows[i][1], margin + contentWidth * 0.45, rowY, 9, darkText, 'bold');
      addText(activeRows[i][2], margin + contentWidth * 0.7, rowY, 9, grayText);
    }
    y += activeRows.length * 7 + 6;

    // ============ COST ESTIMATE ============
    checkPage(60);
    const costEstimate = estimateMaterialCosts(materials, measurement.totalSquares);
    y = addText('ESTIMATED PROJECT COST', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 2;
    y = addText(
      'National average pricing (2025-2026). Actual costs vary by region, material grade, and contractor.',
      margin, y, 7, grayText
    );
    y += 5;

    // Cost summary table
    const costRows: string[][] = [
      ['Materials (Shingles, Underlayment, Accessories)', formatCurrency(costEstimate.totalMaterialCost)],
      ['Estimated Labor (60/40 labor-to-material ratio)', formatCurrency(costEstimate.estimatedLaborCost)],
    ];

    for (let ci = 0; ci < costRows.length; ci++) {
      const rowY = y + ci * 7;
      if (ci % 2 === 0) {
        doc.setFillColor(...lightBg);
        doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
      }
      addText(costRows[ci][0], margin + 3, rowY, 9, grayText);
      addText(costRows[ci][1], pageWidth - margin - 3 - doc.getTextWidth(costRows[ci][1]), rowY, 9, darkText, 'bold');
    }
    y += costRows.length * 7;

    // Total row
    checkPage(10);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    addText('TOTAL ESTIMATED COST', margin + 3, y, 9, primaryColor, 'bold');
    const totalCostStr = formatCurrency(costEstimate.totalProjectCost);
    addText(totalCostStr, pageWidth - margin - 3 - doc.getTextWidth(totalCostStr), y, 9, primaryColor, 'bold');
    y += 7;

    // Cost per square
    const cpsStr = `${formatCurrency(costEstimate.costPerSquare)} per square`;
    addText(cpsStr, pageWidth - margin - 3 - doc.getTextWidth(cpsStr), y, 7.5, grayText);
    y += 8;
  }

  // ============ DAMAGE ASSESSMENT ============
  const damageAnnotations = property.damageAnnotations ?? [];
  if (options.includeDamage !== false && damageAnnotations.length > 0) {
    checkPage(60);
    y = addText('DAMAGE ASSESSMENT', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 4;

    // Table header
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    addText('Type', margin + 3, y, 8, [255, 255, 255], 'bold');
    addText('Severity', margin + contentWidth * 0.35, y, 8, [255, 255, 255], 'bold');
    addText('Location', margin + contentWidth * 0.55, y, 8, [255, 255, 255], 'bold');
    addText('Date', margin + contentWidth * 0.8, y, 8, [255, 255, 255], 'bold');
    y += 7;

    for (let i = 0; i < damageAnnotations.length; i++) {
      checkPage(10);
      const dmg = damageAnnotations[i];
      const rowY = y + i * 7;
      if (i % 2 === 0) {
        doc.setFillColor(...lightBg);
        doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
      }
      addText(DAMAGE_TYPE_LABELS[dmg.type] || dmg.type, margin + 3, rowY, 9, darkText);

      const sevColor = DAMAGE_SEVERITY_COLORS_RGB[dmg.severity] || darkText;
      addText(dmg.severity.charAt(0).toUpperCase() + dmg.severity.slice(1), margin + contentWidth * 0.35, rowY, 9, sevColor, 'bold');

      const locationStr = `${dmg.lat.toFixed(4)}, ${dmg.lng.toFixed(4)}`;
      addText(locationStr, margin + contentWidth * 0.55, rowY, 9, grayText);

      const dmgDate = new Date(dmg.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      addText(dmgDate, margin + contentWidth * 0.8, rowY, 9, grayText);
    }
    y += damageAnnotations.length * 7 + 4;

    // Summary
    checkPage(15);
    const severityCounts = { minor: 0, moderate: 0, severe: 0 };
    for (const dmg of damageAnnotations) {
      severityCounts[dmg.severity] = (severityCounts[dmg.severity] || 0) + 1;
    }
    const summaryParts: string[] = [];
    if (severityCounts.minor > 0) summaryParts.push(`${severityCounts.minor} minor`);
    if (severityCounts.moderate > 0) summaryParts.push(`${severityCounts.moderate} moderate`);
    if (severityCounts.severe > 0) summaryParts.push(`${severityCounts.severe} severe`);
    const summaryText = `Total: ${damageAnnotations.length} damage markers (${summaryParts.join(', ')})`;
    y = addText(summaryText, margin + 3, y, 8, grayText);
    y += 8;
  }

  // ============ CLAIMS INFORMATION ============
  const claims = property.claims ?? [];
  if (options.includeClaims !== false && claims.length > 0) {
    checkPage(60);
    y = addText('CLAIMS INFORMATION', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 4;

    // Table header
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    addText('Claim #', margin + 3, y, 8, [255, 255, 255], 'bold');
    addText('Insured', margin + contentWidth * 0.3, y, 8, [255, 255, 255], 'bold');
    addText('Date of Loss', margin + contentWidth * 0.55, y, 8, [255, 255, 255], 'bold');
    addText('Status', margin + contentWidth * 0.8, y, 8, [255, 255, 255], 'bold');
    y += 7;

    for (let i = 0; i < claims.length; i++) {
      checkPage(10);
      const claim = claims[i];
      const rowY = y + i * 7;
      if (i % 2 === 0) {
        doc.setFillColor(...lightBg);
        doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
      }
      addText(claim.claimNumber, margin + 3, rowY, 9, darkText);
      addText(claim.insuredName, margin + contentWidth * 0.3, rowY, 9, darkText);

      const lossDate = new Date(claim.dateOfLoss).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      addText(lossDate, margin + contentWidth * 0.55, rowY, 9, grayText);

      const statusLabel = CLAIM_STATUS_LABELS[claim.status] || claim.status;
      addText(statusLabel, margin + contentWidth * 0.8, rowY, 9, darkText, 'bold');
    }
    y += claims.length * 7 + 6;
  }

  // ============ MULTI-STRUCTURE SUMMARY ============
  const measurements = property.measurements ?? [];
  if (options.includeMultiStructure !== false && measurements.length > 1) {
    checkPage(60);
    y = addText('MULTI-STRUCTURE SUMMARY', margin, y, 12, primaryColor, 'bold');
    y += 2;
    y = addLine(y);
    y += 4;

    // Table header
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    addText('Structure', margin + 3, y, 8, [255, 255, 255], 'bold');
    addText('Facets', margin + contentWidth * 0.35, y, 8, [255, 255, 255], 'bold');
    addText('Area', margin + contentWidth * 0.55, y, 8, [255, 255, 255], 'bold');
    addText('Squares', margin + contentWidth * 0.8, y, 8, [255, 255, 255], 'bold');
    y += 7;

    let totalFacets = 0;
    let totalArea = 0;
    let totalSquares = 0;

    for (let i = 0; i < measurements.length; i++) {
      checkPage(10);
      const m = measurements[i];
      const rowY = y + i * 7;
      if (i % 2 === 0) {
        doc.setFillColor(...lightBg);
        doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
      }
      const structureName = `Structure ${i + 1}`;
      addText(structureName, margin + 3, rowY, 9, darkText);
      addText(String(m.facets.length), margin + contentWidth * 0.35, rowY, 9, grayText);
      addText(formatArea(m.totalTrueAreaSqFt), margin + contentWidth * 0.55, rowY, 9, grayText);
      addText(formatNumber(m.totalSquares, 1), margin + contentWidth * 0.8, rowY, 9, darkText, 'bold');

      totalFacets += m.facets.length;
      totalArea += m.totalTrueAreaSqFt;
      totalSquares += m.totalSquares;
    }
    y += measurements.length * 7;

    // Total row
    checkPage(10);
    doc.setFillColor(219, 234, 254); // light blue highlight
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    addText('TOTAL', margin + 3, y, 9, primaryColor, 'bold');
    addText(String(totalFacets), margin + contentWidth * 0.35, y, 9, primaryColor, 'bold');
    addText(formatArea(totalArea), margin + contentWidth * 0.55, y, 9, primaryColor, 'bold');
    addText(formatNumber(totalSquares, 1), margin + contentWidth * 0.8, y, 9, primaryColor, 'bold');
    y += 12;
  }

  // ============ SOLAR ANALYSIS ============
  if (options.includeSolar && options.latitude !== undefined && measurement.facets.length > 0) {
    const solar: SolarSystemSummary = options.solarInsights?.solarPotential?.solarPanelConfigs?.length
      ? analyzeSolarPotentialFromApi(options.solarInsights, measurement, DEFAULT_SOLAR_CONFIG)
      : analyzeSolarPotential(measurement, DEFAULT_SOLAR_CONFIG, options.latitude);

    if (solar.totalPanels > 0) {
      checkPage(80);
      y = addText('SOLAR POTENTIAL ANALYSIS', margin, y, 12, primaryColor, 'bold');
      y += 2;
      y = addLine(y);
      y += 4;

      // System summary table
      const solarSummary = [
        ['Total Panels', String(solar.totalPanels)],
        ['System Capacity', `${solar.totalCapacityKw} kW`],
        ['Annual Production', `${solar.annualProductionKwh.toLocaleString()} kWh`],
        ['System Cost', `$${solar.systemCost.toLocaleString()}`],
        ['Federal Tax Credit (30%)', `-$${solar.federalTaxCredit.toLocaleString()}`],
        ['Net Cost', `$${solar.netCost.toLocaleString()}`],
        ['Annual Savings', `$${solar.annualSavings.toLocaleString()}`],
        ['Payback Period', `${solar.paybackYears} years`],
        ['25-Year Net Savings', `$${solar.twentyFiveYearSavings.toLocaleString()}`],
      ];

      for (let i = 0; i < solarSummary.length; i++) {
        checkPage(10);
        const rowY = y + i * 7;
        if (i % 2 === 0) {
          doc.setFillColor(...lightBg);
          doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
        }
        addText(solarSummary[i][0], margin + 3, rowY, 9, grayText);
        addText(solarSummary[i][1], pageWidth - margin - 3 - doc.getTextWidth(solarSummary[i][1]), rowY, 9, darkText, 'bold');
      }
      y += solarSummary.length * 7 + 6;

      // Environmental impact — enhanced with API-based calculations
      checkPage(55);
      y = addText('Environmental Impact', margin, y, 10, primaryColor, 'bold');
      y += 4;

      const envImpact = options.solarInsights
        ? calculateEnvironmentalImpact(options.solarInsights, solar.totalCapacityKw)
        : null;

      const envData = envImpact ? [
        ['Annual CO2 Offset', `${envImpact.annualCO2OffsetTons.toLocaleString()} metric tons`],
        ['Lifetime CO2 Offset (25 yr)', `${envImpact.lifetimeCO2OffsetTons.toLocaleString()} metric tons`],
        ['Trees Equivalent (Annual)', `${envImpact.treeEquivalent.toLocaleString()} trees`],
        ['Miles Not Driven Equivalent', `${envImpact.milesNotDriven.toLocaleString()} miles`],
        ['Homes Powered Equivalent', formatNumber(envImpact.homesPowered, 2)],
        ['Grid Carbon Intensity', `${envImpact.carbonFactorKgPerMwh} kg CO2/MWh`],
      ] : [
        ['CO2 Offset', `${solar.carbonOffsetLbs.toLocaleString()} lbs`],
        ['Trees Equivalent', `${solar.treesEquivalent} trees`],
      ];

      for (let i = 0; i < envData.length; i++) {
        const rowY = y + i * 7;
        if (i % 2 === 0) {
          doc.setFillColor(...lightBg);
          doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
        }
        addText(envData[i][0], margin + 3, rowY, 9, grayText);
        addText(envData[i][1], pageWidth - margin - 3 - doc.getTextWidth(envData[i][1]), rowY, 9, darkText, 'bold');
      }
      y += envData.length * 7 + 6;

      // Solar ROI Summary box
      checkPage(30);
      const greenBg: [number, number, number] = [220, 252, 231];
      const greenAccent: [number, number, number] = [22, 163, 74];
      doc.setFillColor(...greenBg);
      doc.rect(margin, y, contentWidth, 22, 'F');
      doc.setFillColor(...greenAccent);
      doc.rect(margin, y, 4, 22, 'F');
      addText('SOLAR ROI SUMMARY', margin + 8, y + 5, 8, greenAccent, 'bold');
      const roiLine = `${solar.paybackYears}-year payback | ${formatCurrency(solar.annualSavings)}/yr savings | ${formatCurrency(solar.twentyFiveYearSavings)} lifetime savings`;
      addText(roiLine, margin + 8, y + 12, 7.5, darkText);
      const roiNetLine = `Net cost after 30% ITC: ${formatCurrency(solar.netCost)} | System: ${solar.totalCapacityKw} kW (${solar.totalPanels} panels)`;
      addText(roiNetLine, margin + 8, y + 18, 7, grayText);
      y += 28;

      // Per-facet solar breakdown
      if (solar.facetAnalyses.length > 0) {
        checkPage(40);
        y = addText('Solar Analysis by Facet', margin, y, 10, primaryColor, 'bold');
        y += 4;

        // Table header
        doc.setFillColor(...primaryColor);
        doc.rect(margin, y - 4, contentWidth, 7, 'F');
        addText('Facet', margin + 3, y, 8, [255, 255, 255], 'bold');
        addText('Panels', margin + contentWidth * 0.35, y, 8, [255, 255, 255], 'bold');
        addText('Capacity', margin + contentWidth * 0.5, y, 8, [255, 255, 255], 'bold');
        addText('Production', margin + contentWidth * 0.68, y, 8, [255, 255, 255], 'bold');
        addText('Rating', margin + contentWidth * 0.87, y, 8, [255, 255, 255], 'bold');
        y += 7;

        const ratingColors: Record<string, [number, number, number]> = {
          excellent: [22, 163, 74],
          good: [37, 120, 235],
          fair: [245, 158, 11],
          poor: [239, 68, 68],
        };

        for (let i = 0; i < solar.facetAnalyses.length; i++) {
          checkPage(10);
          const fa = solar.facetAnalyses[i];
          const rowY = y + i * 7;
          if (i % 2 === 0) {
            doc.setFillColor(...lightBg);
            doc.rect(margin, rowY - 4, contentWidth, 7, 'F');
          }
          addText(fa.facetName, margin + 3, rowY, 9, darkText);
          addText(String(fa.panelCount), margin + contentWidth * 0.35, rowY, 9, grayText);
          addText(`${fa.panelCapacityKw} kW`, margin + contentWidth * 0.5, rowY, 9, grayText);
          addText(`${fa.annualProductionKwh.toLocaleString()} kWh`, margin + contentWidth * 0.68, rowY, 9, darkText, 'bold');
          const rColor = ratingColors[fa.rating] || darkText;
          addText(fa.rating.charAt(0).toUpperCase() + fa.rating.slice(1), margin + contentWidth * 0.87, rowY, 9, rColor, 'bold');
        }
        y += solar.facetAnalyses.length * 7 + 4;
      }

      // Monthly production chart (text-based)
      checkPage(30);
      y = addText('Estimated Monthly Production (kWh)', margin, y, 10, primaryColor, 'bold');
      y += 4;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const maxMonthly = Math.max(...solar.monthlyProductionKwh);

      for (let i = 0; i < 12; i++) {
        checkPage(8);
        const rowY = y + i * 6;
        addText(monthNames[i], margin + 3, rowY, 8, grayText);
        // Bar chart
        const barWidth = maxMonthly > 0 ? (solar.monthlyProductionKwh[i] / maxMonthly) * (contentWidth * 0.5) : 0;
        doc.setFillColor(37, 120, 235);
        doc.rect(margin + 25, rowY - 3.5, barWidth, 4, 'F');
        addText(String(solar.monthlyProductionKwh[i]), margin + 30 + contentWidth * 0.5, rowY, 8, grayText);
      }
      y += 12 * 6 + 6;

      y = addText(
        'Solar estimates based on roof orientation, pitch, and latitude. Actual production may vary based on local conditions, shading, and equipment.',
        margin, y, 7, grayText
      );
      y += 6;

      // Solar panel layout diagram (from API panel placement data)
      if (options.includeSolarPanelLayout && options.solarInsights?.solarPotential?.solarPanels?.length) {
        const panels = computePanelLayout(options.solarInsights);
        if (panels.length > 0) {
          const panelDiagramImage = renderPanelLayoutDiagram(panels);
          if (panelDiagramImage) {
            doc.addPage();
            y = margin;

            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(margin, y, contentWidth, 8, 'F');
            addText('SOLAR PANEL LAYOUT', margin + 3, y + 2, 12, [255, 255, 255], 'bold');
            y += 12;
            y = addText(
              `${panels.length} panels placed by Google Solar API — color-coded by energy output`,
              margin, y, 8, grayText
            );
            y += 4;

            const imgWidth = contentWidth;
            const imgHeight = imgWidth * (600 / 800);
            doc.addImage(panelDiagramImage, 'PNG', margin, y, imgWidth, imgHeight);
            y += imgHeight + 6;
          }
        }
      }
    }
  }

  // ============ WIREFRAME DIAGRAMS ============
  const diagramImages = [
    { image: options.lengthDiagramImage, title: 'LENGTH DIAGRAM', subtitle: 'Edge measurements in feet, colored by edge type', enabled: options.includeLengthDiagram },
    { image: options.areaDiagramImage, title: 'AREA DIAGRAM', subtitle: 'Facet areas in square feet with numbered labels', enabled: options.includeAreaDiagram },
    { image: options.pitchDiagramImage, title: 'PITCH DIAGRAM', subtitle: 'Facet pitches color-coded by steepness', enabled: options.includePitchDiagram },
  ];

  for (const diagram of diagramImages) {
    if (diagram.enabled && diagram.image) {
      doc.addPage();
      y = margin;

      y = addText(diagram.title, margin, y, 14, primaryColor, 'bold');
      y += 2;
      y = addLine(y);
      y += 2;
      y = addText(diagram.subtitle, margin, y, 8, grayText);
      y += 4;

      try {
        const imgWidth = contentWidth;
        const imgHeight = imgWidth * 0.75; // 4:3 aspect ratio for diagrams
        doc.addImage(diagram.image, 'PNG', margin, y, imgWidth, imgHeight);
        y += imgHeight + 4;
      } catch {
        y = addText('Diagram could not be rendered.', margin, y, 9, grayText);
        y += 6;
      }
    }
  }

  // ============ OBLIQUE VIEWS ============
  if (options.includeObliqueViews && options.obliqueViews) {
    const views = options.obliqueViews;
    const hasAnyView = views.north || views.south || views.east || views.west;

    if (hasAnyView) {
      doc.addPage();
      y = margin;

      y = addText('OBLIQUE VIEWS', margin, y, 14, primaryColor, 'bold');
      y += 2;
      y = addLine(y);
      y += 2;
      y = addText('Satellite views from four cardinal directions', margin, y, 8, grayText);
      y += 4;

      const gridWidth = (contentWidth - 4) / 2;  // 2 columns with 4mm gap
      const gridHeight = gridWidth * 0.75;
      const directions: { key: keyof typeof views; label: string }[] = [
        { key: 'north', label: 'North' },
        { key: 'east', label: 'East' },
        { key: 'south', label: 'South' },
        { key: 'west', label: 'West' },
      ];

      for (let i = 0; i < directions.length; i++) {
        const dir = directions[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const xPos = margin + col * (gridWidth + 4);
        const yPos = y + row * (gridHeight + 12);

        addText(dir.label, xPos + gridWidth / 2 - 5, yPos, 9, darkText, 'bold');

        if (views[dir.key]) {
          try {
            doc.addImage(views[dir.key]!, 'PNG', xPos, yPos + 4, gridWidth, gridHeight);
          } catch {
            doc.setFillColor(...lightBg);
            doc.rect(xPos, yPos + 4, gridWidth, gridHeight, 'F');
            addText('Image unavailable', xPos + 10, yPos + gridHeight / 2 + 4, 8, grayText);
          }
        } else {
          doc.setFillColor(...lightBg);
          doc.rect(xPos, yPos + 4, gridWidth, gridHeight, 'F');
          addText('Not available', xPos + 15, yPos + gridHeight / 2 + 4, 8, grayText);
        }
      }
      y += 2 * (gridHeight + 12) + 4;
    }
  }

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

  // ============ APPENDIX: METHODOLOGY & DATA SOURCES ============
  doc.addPage();
  y = margin;
  y = addText('APPENDIX: METHODOLOGY & DATA SOURCES', margin, y, 12, primaryColor, 'bold');
  y += 2;
  y = addLine(y);
  y += 6;

  // Accuracy Score Section
  y = addText('Measurement Accuracy', margin, y, 10, darkText, 'bold');
  y += 5;

  const methodologyLines = [
    `Accuracy Score: ${accuracy.grade} (${accuracy.overallScore}/100) — ${accuracy.label}`,
    '',
    'Score Factors:',
    `  Data Source (30%): ${accuracy.factors.dataSource.label} — ${accuracy.factors.dataSource.score}/${accuracy.factors.dataSource.weight}`,
    `  Imagery Quality (20%): ${accuracy.factors.imageryQuality.label} — ${accuracy.factors.imageryQuality.score}/${accuracy.factors.imageryQuality.weight}`,
    `  Facet Detection (15%): ${accuracy.factors.facetCount.label} — ${accuracy.factors.facetCount.score}/${accuracy.factors.facetCount.weight}`,
    `  Area Cross-Validation (25%): ${accuracy.factors.areaValidation.label} — ${accuracy.factors.areaValidation.score}/${accuracy.factors.areaValidation.weight}`,
    `  Pitch Consistency (10%): ${accuracy.factors.pitchConsistency.label} — ${accuracy.factors.pitchConsistency.score}/${accuracy.factors.pitchConsistency.weight}`,
  ];

  for (const line of methodologyLines) {
    if (line === '') { y += 2; continue; }
    addText(line, margin + 3, y, 7.5, grayText);
    y += 4.5;
  }
  y += 6;

  // Data Sources
  y = addText('Data Sources', margin, y, 10, darkText, 'bold');
  y += 5;

  const dataSources = [
    'Satellite Imagery: Google Maps Platform (high-resolution satellite tiles)',
    'Roof Geometry: Google Solar API buildingInsights endpoint (roof segment pitch, azimuth, area)',
    'Elevation Data: Google Solar API dataLayers endpoint (Digital Surface Model GeoTIFF)',
    'Building Outline: LIDAR mask extraction via contour analysis on DSM/mask GeoTIFFs',
    'AI Edge Detection: Anthropic Claude Vision API (ridge, hip, valley, rake, eave classification)',
    'Solar Production: Google Solar API yearlyEnergyDcKwh (weather-validated irradiance model)',
    'Financial Data: Google Solar API financialAnalyses (federal, state, utility incentives)',
  ];
  for (const src of dataSources) {
    addText(`\u2022 ${src}`, margin + 3, y, 7.5, grayText);
    y += 5;
  }
  y += 6;

  // Methodology
  y = addText('Measurement Methodology', margin, y, 10, darkText, 'bold');
  y += 5;

  const methodology = [
    '1. Building outline extraction from LIDAR mask (contour tracing on Google Solar API roof mask GeoTIFF)',
    '2. Roof segment matching using Solar API roofSegmentStats (pitch, azimuth, area per segment)',
    '3. 3D pitch verification from Digital Surface Model elevation sampling (plane-fit R\u00B2 analysis)',
    '4. Facet partitioning via hybrid strategy: azimuth-based assignment when segment centers are',
    '   clustered, Voronoi distance-based when spread. Falls back to Solar API areas directly.',
    '5. True surface area computed from pitch-adjusted flat area or DSM 3D triangulation',
    '6. Waste factor derived from structure complexity analysis (facet count, hip/valley ratio, edge patterns)',
    '7. Material quantities estimated using industry-standard ratios (3 bundles/square, etc.)',
    '',
    'Disclaimer: Measurements are derived from satellite imagery, LIDAR data, and AI analysis.',
    'Actual conditions may vary. This report is intended as an estimate and should be verified',
    'by on-site inspection for critical applications such as insurance claims or construction bids.',
  ];
  for (const line of methodology) {
    if (line === '') { y += 2; continue; }
    addText(line, margin + 3, y, 7.5, grayText);
    y += 4.5;
  }

  // ============ FOOTER & PAGE DECORATION ============
  // Apply consistent headers, footers, and page numbers to all pages (skip hero page 1)
  applyPageDecoration(doc, fullAddress, reportDate, options.companyName, 2);

  // Also add the legacy footer on page 1 (hero page)
  const pageCount = doc.getNumberOfPages();
  doc.setPage(1);
  {
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(245, 245, 245);
    doc.rect(0, ph - 18, pageWidth, 18, 'F');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by SkyHawk Aerial Property Intelligence | ${reportDate} | Page 1 of ${pageCount}`,
      pageWidth / 2,
      ph - 11,
      { align: 'center' }
    );
    doc.text(
      'Measurements powered by Google Solar API + AI Vision | Imagery \u00A9 Google',
      pageWidth / 2,
      ph - 6,
      { align: 'center' }
    );
    doc.text('CONFIDENTIAL', margin, ph - 11);
  }

  // Save
  const filename = `SkyHawk-Roof-Report-${property.address.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
