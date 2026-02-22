import type { RoofMeasurement, Property } from '../types';
import { EDGE_LABELS } from './colors';
import { estimateMaterials } from './materials';
import { formatPitch } from './geometry';

/**
 * Build Xactimate-compatible ESX (XML) content from property and measurement data.
 * ESX (Estimating Solution Exchange) is the standard interchange format for
 * insurance claims software. This generates a simplified ESX XML that can be
 * imported into Xactimate and similar estimating platforms.
 */
export function buildESX(
  property: Property,
  measurement: RoofMeasurement,
  claimNumber?: string,
  insuredName?: string
): string {
  const now = new Date().toISOString();
  const materials = measurement.totalSquares > 0 ? estimateMaterials(measurement) : null;
  const damageAnnotations = property.damageAnnotations || [];

  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<ESX version="3.0" generator="SkyHawk" generatedAt="' + escXml(now) + '">');

  // ── Claim Info ──
  lines.push('  <ClaimInfo>');
  lines.push(`    <ClaimNumber>${escXml(claimNumber || 'SKY-' + measurement.id.slice(0, 8).toUpperCase())}</ClaimNumber>`);
  lines.push(`    <InsuredName>${escXml(insuredName || '')}</InsuredName>`);
  lines.push(`    <PropertyAddress>${escXml(property.address)}</PropertyAddress>`);
  lines.push(`    <City>${escXml(property.city)}</City>`);
  lines.push(`    <State>${escXml(property.state)}</State>`);
  lines.push(`    <ZipCode>${escXml(property.zip)}</ZipCode>`);
  lines.push(`    <Latitude>${property.lat.toFixed(6)}</Latitude>`);
  lines.push(`    <Longitude>${property.lng.toFixed(6)}</Longitude>`);
  lines.push(`    <DateOfLoss></DateOfLoss>`);
  lines.push(`    <DateInspected>${escXml(now.slice(0, 10))}</DateInspected>`);
  lines.push('  </ClaimInfo>');

  // ── Roof Summary ──
  lines.push('  <RoofSummary>');
  lines.push(`    <TotalArea unit="sqft">${measurement.totalTrueAreaSqFt.toFixed(1)}</TotalArea>`);
  lines.push(`    <ProjectedArea unit="sqft">${measurement.totalAreaSqFt.toFixed(1)}</ProjectedArea>`);
  lines.push(`    <TotalSquares>${measurement.totalSquares.toFixed(2)}</TotalSquares>`);
  lines.push(`    <PredominantPitch>${formatPitch(measurement.predominantPitch)}</PredominantPitch>`);
  lines.push(`    <NumberOfFacets>${measurement.facets.length}</NumberOfFacets>`);
  lines.push(`    <WastePercent>${measurement.suggestedWastePercent}</WastePercent>`);
  lines.push('  </RoofSummary>');

  // ── Line Measurements ──
  lines.push('  <LineMeasurements>');
  lines.push(`    <Ridge unit="lf">${measurement.totalRidgeLf.toFixed(1)}</Ridge>`);
  lines.push(`    <Hip unit="lf">${measurement.totalHipLf.toFixed(1)}</Hip>`);
  lines.push(`    <Valley unit="lf">${measurement.totalValleyLf.toFixed(1)}</Valley>`);
  lines.push(`    <Rake unit="lf">${measurement.totalRakeLf.toFixed(1)}</Rake>`);
  lines.push(`    <Eave unit="lf">${measurement.totalEaveLf.toFixed(1)}</Eave>`);
  lines.push(`    <Flashing unit="lf">${measurement.totalFlashingLf.toFixed(1)}</Flashing>`);
  lines.push(`    <DripEdge unit="lf">${measurement.totalDripEdgeLf.toFixed(1)}</DripEdge>`);
  lines.push('  </LineMeasurements>');

  // ── Facets ──
  lines.push('  <Facets>');
  for (const facet of measurement.facets) {
    lines.push(`    <Facet id="${escXml(facet.id)}">`);
    lines.push(`      <Name>${escXml(facet.name)}</Name>`);
    lines.push(`      <Pitch>${formatPitch(facet.pitch)}</Pitch>`);
    lines.push(`      <FlatArea unit="sqft">${facet.areaSqFt.toFixed(1)}</FlatArea>`);
    lines.push(`      <TrueArea unit="sqft">${facet.trueAreaSqFt.toFixed(1)}</TrueArea>`);
    lines.push(`      <Vertices>${facet.vertexIds.length}</Vertices>`);
    lines.push('    </Facet>');
  }
  lines.push('  </Facets>');

  // ── Edges ──
  lines.push('  <Edges>');
  for (const edge of measurement.edges) {
    lines.push(`    <Edge id="${escXml(edge.id)}" type="${escXml(edge.type)}">`);
    lines.push(`      <Label>${escXml(EDGE_LABELS[edge.type] || edge.type)}</Label>`);
    lines.push(`      <Length unit="lf">${edge.lengthFt.toFixed(1)}</Length>`);
    lines.push('    </Edge>');
  }
  lines.push('  </Edges>');

  // ── Material Estimates ──
  if (materials) {
    lines.push('  <MaterialEstimates wastePercent="' + measurement.suggestedWastePercent + '">');
    lines.push(`    <ShingleBundles>${materials.shingleBundles}</ShingleBundles>`);
    lines.push(`    <UnderlaymentRolls>${materials.underlaymentRolls}</UnderlaymentRolls>`);
    lines.push(`    <IceWaterShieldRolls>${materials.iceWaterRolls}</IceWaterShieldRolls>`);
    lines.push(`    <StarterStrip unit="lf">${materials.starterStripLf}</StarterStrip>`);
    lines.push(`    <RidgeCap unit="lf">${materials.ridgeCapLf}</RidgeCap>`);
    lines.push(`    <DripEdge unit="lf">${materials.dripEdgeLf}</DripEdge>`);
    lines.push(`    <StepFlashing unit="pcs">${materials.stepFlashingPcs}</StepFlashing>`);
    lines.push(`    <PipeBoots>${materials.pipeBoots}</PipeBoots>`);
    lines.push(`    <RoofingNails unit="lbs">${materials.nailsLbs}</RoofingNails>`);
    lines.push(`    <CaulkTubes>${materials.caulkTubes}</CaulkTubes>`);
    lines.push(`    <RidgeVent unit="lf">${materials.ridgeVentLf}</RidgeVent>`);
    lines.push('  </MaterialEstimates>');
  }

  // ── Damage Annotations ──
  if (damageAnnotations.length > 0) {
    lines.push('  <DamageAnnotations>');
    for (const ann of damageAnnotations) {
      lines.push(`    <Damage id="${escXml(ann.id)}" type="${escXml(ann.type)}" severity="${escXml(ann.severity)}">`);
      lines.push(`      <Latitude>${ann.lat.toFixed(6)}</Latitude>`);
      lines.push(`      <Longitude>${ann.lng.toFixed(6)}</Longitude>`);
      lines.push(`      <Note>${escXml(ann.note)}</Note>`);
      lines.push(`      <CreatedAt>${escXml(ann.createdAt)}</CreatedAt>`);
      lines.push('    </Damage>');
    }
    lines.push('  </DamageAnnotations>');
  }

  lines.push('</ESX>');
  return lines.join('\n');
}

/**
 * Export measurement as downloadable ESX file.
 */
export function exportESX(
  property: Property,
  measurement: RoofMeasurement,
  claimNumber?: string,
  insuredName?: string
): void {
  const esx = buildESX(property, measurement, claimNumber, insuredName);
  const blob = new Blob([esx], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skyhawk-claim-${property.address.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.esx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
