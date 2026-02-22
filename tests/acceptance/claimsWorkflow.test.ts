/**
 * Acceptance: Claims lifecycle workflow.
 * create -> adjuster -> schedule -> status transitions -> completion
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';
import { resetStore } from '../helpers/store';

describe('Claims Workflow', () => {
  let propertyId: string;

  beforeEach(() => {
    resetStore();
    propertyId = useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.7817, -89.6501);
  });

  // ─── Claim Lifecycle ──────────────────────────────────────────

  describe('claim lifecycle', () => {
    it('should create a claim', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      expect(claimId).toBeTruthy();
      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.claims).toHaveLength(1);
      expect(prop.claims[0].status).toBe('new');
    });

    it('should update claim status', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      useStore.getState().updateClaimStatus(claimId, 'inspected');

      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.claims[0].status).toBe('inspected');
    });

    it('should transition through all statuses', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');

      const statuses = ['inspected', 'estimated', 'submitted', 'approved', 'closed'] as const;
      for (const status of statuses) {
        useStore.getState().updateClaimStatus(claimId, status);
        const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
        expect(prop.claims[0].status).toBe(status);
      }
    });

    it('should update claim notes', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      useStore.getState().updateClaimNotes(claimId, 'Hail damage to south-facing slope');

      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.claims[0].notes).toBe('Hail damage to south-facing slope');
    });

    it('should delete a claim', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      useStore.getState().deleteClaim(claimId);

      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.claims).toHaveLength(0);
    });

    it('should support multiple claims', () => {
      useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      useStore.getState().addClaim('CLM-002', 'Jane Smith', '2025-03-20');

      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.claims).toHaveLength(2);
    });

    it('should handle denied status', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      useStore.getState().updateClaimStatus(claimId, 'denied');

      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.claims[0].status).toBe('denied');
    });
  });

  // ─── Adjuster Management ──────────────────────────────────────

  describe('adjuster management', () => {
    it('should add an adjuster', () => {
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      expect(adjId).toBeTruthy();
      expect(useStore.getState().adjusters).toHaveLength(1);
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });

    it('should update adjuster status', () => {
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      useStore.getState().updateAdjusterStatus(adjId, 'assigned');
      expect(useStore.getState().adjusters[0].status).toBe('assigned');
    });

    it('should delete an adjuster', () => {
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      useStore.getState().deleteAdjuster(adjId);
      expect(useStore.getState().adjusters).toHaveLength(0);
    });

    it('should transition adjuster through statuses', () => {
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      useStore.getState().updateAdjusterStatus(adjId, 'assigned');
      expect(useStore.getState().adjusters[0].status).toBe('assigned');

      useStore.getState().updateAdjusterStatus(adjId, 'on-site');
      expect(useStore.getState().adjusters[0].status).toBe('on-site');

      useStore.getState().updateAdjusterStatus(adjId, 'available');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });
  });

  // ─── Inspection Scheduling ────────────────────────────────────

  describe('inspection scheduling', () => {
    it('should schedule an inspection', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', 'Initial inspection');

      expect(inspId).toBeTruthy();
      expect(useStore.getState().inspections).toHaveLength(1);
      expect(useStore.getState().inspections[0].status).toBe('scheduled');
    });

    it('should set adjuster to assigned on schedule', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', '');

      expect(useStore.getState().adjusters[0].status).toBe('assigned');
    });

    it('should transition to in-progress and set adjuster on-site', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', '');

      useStore.getState().updateInspectionStatus(inspId, 'in-progress');
      expect(useStore.getState().inspections[0].status).toBe('in-progress');
      expect(useStore.getState().adjusters[0].status).toBe('on-site');
    });

    it('should complete inspection and return adjuster to available', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', '');

      useStore.getState().updateInspectionStatus(inspId, 'completed');
      expect(useStore.getState().inspections[0].status).toBe('completed');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });

    it('should cancel inspection and return adjuster to available', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', '');

      useStore.getState().cancelInspection(inspId);
      expect(useStore.getState().inspections[0].status).toBe('cancelled');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });

    it('should delete an inspection', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', '');

      useStore.getState().deleteInspection(inspId);
      expect(useStore.getState().inspections).toHaveLength(0);
    });
  });

  // ─── Cascade on Adjuster Delete ───────────────────────────────

  describe('cascade on adjuster delete', () => {
    it('should cancel pending inspections when adjuster is deleted', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', '');

      useStore.getState().deleteAdjuster(adjId);
      expect(useStore.getState().adjusters).toHaveLength(0);
      expect(useStore.getState().inspections[0].status).toBe('cancelled');
    });

    it('should not cancel completed inspections when adjuster deleted', () => {
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', '');
      useStore.getState().updateInspectionStatus(inspId, 'completed');

      useStore.getState().deleteAdjuster(adjId);
      expect(useStore.getState().inspections[0].status).toBe('completed');
    });
  });

  // ─── Complete End-to-End ──────────────────────────────────────

  describe('end-to-end claims flow', () => {
    it('should handle full claim lifecycle', () => {
      // Create claim
      const claimId = useStore.getState().addClaim('CLM-001', 'John Doe', '2025-01-15');
      useStore.getState().updateClaimNotes(claimId, 'Severe hail damage reported');

      // Assign adjuster
      const adjId = useStore.getState().addAdjuster('Jane Smith', 'jane@test.com', '555-0100', 'residential');

      // Schedule inspection
      const inspId = useStore.getState().scheduleInspection(claimId, adjId, '2025-02-01', '10:00', 'Initial');

      // Start inspection
      useStore.getState().updateInspectionStatus(inspId, 'in-progress');
      expect(useStore.getState().adjusters[0].status).toBe('on-site');

      // Complete inspection
      useStore.getState().updateInspectionStatus(inspId, 'completed');
      expect(useStore.getState().adjusters[0].status).toBe('available');

      // Update claim through statuses
      useStore.getState().updateClaimStatus(claimId, 'inspected');
      useStore.getState().updateClaimStatus(claimId, 'estimated');
      useStore.getState().updateClaimStatus(claimId, 'submitted');
      useStore.getState().updateClaimStatus(claimId, 'approved');
      useStore.getState().updateClaimStatus(claimId, 'closed');

      const prop = useStore.getState().properties.find(p => p.id === propertyId)!;
      expect(prop.claims[0].status).toBe('closed');
      expect(useStore.getState().inspections[0].status).toBe('completed');
    });
  });
});
