/**
 * Acceptance: Damage annotations + export formats.
 * add/select/delete markers -> export JSON/GeoJSON/CSV
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore, setupPropertyWithOutline } from '../helpers/store';
import { buildExportData, buildGeoJSON, buildCSV } from '../../src/utils/exportData';

describe('Damage and Export', () => {
  let propertyId: string;

  beforeEach(() => {
    resetStore();
    ({ propertyId } = setupPropertyWithOutline());
  });

  // ─── Damage Annotations ───────────────────────────────────────

  describe('damage annotations', () => {
    it('should add a damage annotation', () => {
      const dmgId = useStore.getState().addDamageAnnotation(39.781, -89.650, 'hail', 'moderate', 'Test damage');
      expect(dmgId).toBeTruthy();
      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.damageAnnotations).toHaveLength(1);
    });

    it('should add multiple damage annotations', () => {
      useStore.getState().addDamageAnnotation(39.781, -89.650, 'hail', 'moderate', 'Damage 1');
      useStore.getState().addDamageAnnotation(39.782, -89.651, 'wind', 'severe', 'Damage 2');
      useStore.getState().addDamageAnnotation(39.780, -89.649, 'missing-shingle', 'minor', 'Damage 3');

      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.damageAnnotations).toHaveLength(3);
    });

    it('should select a damage annotation', () => {
      const dmgId = useStore.getState().addDamageAnnotation(39.781, -89.650, 'hail', 'moderate', 'Test');
      useStore.getState().selectDamage(dmgId);
      expect(useStore.getState().selectedDamageId).toBe(dmgId);
    });

    it('should deselect damage', () => {
      const dmgId = useStore.getState().addDamageAnnotation(39.781, -89.650, 'hail', 'moderate', 'Test');
      useStore.getState().selectDamage(dmgId);
      useStore.getState().selectDamage(null);
      expect(useStore.getState().selectedDamageId).toBeNull();
    });

    it('should delete a damage annotation', () => {
      const dmgId = useStore.getState().addDamageAnnotation(39.781, -89.650, 'hail', 'moderate', 'Test');
      useStore.getState().deleteDamageAnnotation(dmgId);

      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.damageAnnotations).toHaveLength(0);
    });

    it('should clear selectedDamageId on delete', () => {
      const dmgId = useStore.getState().addDamageAnnotation(39.781, -89.650, 'hail', 'moderate', 'Test');
      useStore.getState().selectDamage(dmgId);
      useStore.getState().deleteDamageAnnotation(dmgId);
      expect(useStore.getState().selectedDamageId).toBeNull();
    });

    it('should set active damage type', () => {
      useStore.getState().setActiveDamageType('wind');
      expect(useStore.getState().activeDamageType).toBe('wind');
    });

    it('should set active damage severity', () => {
      useStore.getState().setActiveDamageSeverity('severe');
      expect(useStore.getState().activeDamageSeverity).toBe('severe');
    });

    it('should isolate damage per property', () => {
      useStore.getState().addDamageAnnotation(39.781, -89.650, 'hail', 'moderate', 'Property 1 damage');

      // Create second property
      const prop2Id = useStore.getState().createProperty('456 Oak Ave', 'Chicago', 'IL', '60601', 41.878, -87.630);
      useStore.getState().addDamageAnnotation(41.878, -87.630, 'wind', 'severe', 'Property 2 damage');

      const prop1 = useStore.getState().properties.find(p => p.id === propertyId)!;
      const prop2 = useStore.getState().properties.find(p => p.id === prop2Id)!;

      expect(prop1.damageAnnotations).toHaveLength(1);
      expect(prop1.damageAnnotations[0].type).toBe('hail');
      expect(prop2.damageAnnotations).toHaveLength(1);
      expect(prop2.damageAnnotations[0].type).toBe('wind');
    });
  });

  // ─── JSON Export with Data ────────────────────────────────────

  describe('JSON export', () => {
    it('should export correct measurement data', () => {
      const m = useStore.getState().activeMeasurement!;
      const data = buildExportData(m);

      expect(data.measurement.id).toBe(m.id);
      expect(data.measurement.vertices.length).toBe(m.vertices.length);
      expect(data.measurement.edges.length).toBe(m.edges.length);
      expect(data.measurement.facets.length).toBe(m.facets.length);
    });

    it('should include waste table', () => {
      const m = useStore.getState().activeMeasurement!;
      const data = buildExportData(m);

      expect(data.measurement.wasteTable.length).toBeGreaterThan(0);
    });

    it('should include edge types in export', () => {
      const m = useStore.getState().activeMeasurement!;
      const data = buildExportData(m);

      for (const edge of data.measurement.edges) {
        expect(edge.type).toBeTruthy();
        expect(edge.lengthFt).toBeGreaterThan(0);
      }
    });
  });

  // ─── GeoJSON Export ───────────────────────────────────────────

  describe('GeoJSON export', () => {
    it('should contain correct feature types', () => {
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      expect(geo.type).toBe('FeatureCollection');
      const types = new Set(geo.features.map(f => f.properties.featureType));
      expect(types.has('edge')).toBe(true);
      expect(types.has('facet')).toBe(true);
      expect(types.has('vertex')).toBe(true);
    });

    it('should have edge features with type and length', () => {
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      const edges = geo.features.filter(f => f.properties.featureType === 'edge');
      for (const edge of edges) {
        expect(edge.properties.edgeType).toBeTruthy();
        expect(edge.properties.lengthFt).toBeGreaterThan(0);
        expect(edge.geometry.type).toBe('LineString');
      }
    });

    it('should have facet features with pitch and area', () => {
      const m = useStore.getState().activeMeasurement!;
      const geo = buildGeoJSON(m);

      const facets = geo.features.filter(f => f.properties.featureType === 'facet');
      for (const facet of facets) {
        expect(facet.properties.pitch).toBeDefined();
        expect(facet.properties.areaSqFt).toBeGreaterThan(0);
        expect(facet.geometry.type).toBe('Polygon');
      }
    });
  });

  // ─── CSV Export ───────────────────────────────────────────────

  describe('CSV export', () => {
    it('should contain summary section', () => {
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('ROOF MEASUREMENT SUMMARY');
      expect(csv).toContain('Total True Area');
      expect(csv).toContain('Total Squares');
    });

    it('should contain line measurements', () => {
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('LINE MEASUREMENTS');
      expect(csv).toContain('Ridges');
      expect(csv).toContain('Eaves');
    });

    it('should contain facet details', () => {
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('FACET DETAILS');
      expect(csv).toContain('Name,Pitch');
    });

    it('should contain edge details', () => {
      const m = useStore.getState().activeMeasurement!;
      const csv = buildCSV(m);

      expect(csv).toContain('EDGE DETAILS');
    });
  });

  // ─── Snapshots ────────────────────────────────────────────────

  describe('snapshots', () => {
    it('should add a snapshot', () => {
      const snapId = useStore.getState().addSnapshot('Before repair', 'data:image/png;base64,abc');
      expect(snapId).toBeTruthy();
      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.snapshots).toHaveLength(1);
      expect(prop.snapshots[0].label).toBe('Before repair');
    });

    it('should delete a snapshot', () => {
      const snapId = useStore.getState().addSnapshot('Before repair', 'data:image/png;base64,abc');
      useStore.getState().deleteSnapshot(snapId);
      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.snapshots).toHaveLength(0);
    });
  });
});
