/**
 * Unit tests for Adjuster Assignment & Inspection Scheduling system
 * Run with: npx vitest run tests/unit/adjuster.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';

describe('Adjuster Assignment & Scheduling', () => {
  let claimId: string;

  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
      adjusters: [],
      inspections: [],
    });
    useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.78, -89.65);
    claimId = useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
  });

  // ─── Adjuster CRUD ──────────────────────────────────────────────

  describe('Adding adjusters', () => {
    it('should add an adjuster and return a unique ID', () => {
      const id = useStore.getState().addAdjuster('Alice Walker', 'alice@example.com', '555-0101', 'residential');
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should store the adjuster with all provided fields', () => {
      const id = useStore.getState().addAdjuster('Alice Walker', 'alice@example.com', '555-0101', 'residential');
      const adjusters = useStore.getState().adjusters;
      expect(adjusters.length).toBe(1);

      const adj = adjusters[0];
      expect(adj.id).toBe(id);
      expect(adj.name).toBe('Alice Walker');
      expect(adj.email).toBe('alice@example.com');
      expect(adj.phone).toBe('555-0101');
      expect(adj.specialty).toBe('residential');
      expect(adj.status).toBe('available');
      expect(adj.createdAt).toBeTruthy();
      expect(new Date(adj.createdAt).getTime()).toBeGreaterThan(0);
    });

    it('should add multiple adjusters with unique IDs', () => {
      const id1 = useStore.getState().addAdjuster('Alice Walker', 'alice@example.com', '555-0101', 'residential');
      const id2 = useStore.getState().addAdjuster('Bob Chen', 'bob@example.com', '555-0102', 'commercial');
      const id3 = useStore.getState().addAdjuster('Carol Davis', 'carol@example.com', '555-0103', 'catastrophe');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);

      const adjusters = useStore.getState().adjusters;
      expect(adjusters.length).toBe(3);
      expect(adjusters[0].name).toBe('Alice Walker');
      expect(adjusters[1].name).toBe('Bob Chen');
      expect(adjusters[2].name).toBe('Carol Davis');
    });

    it('should support all specialty types', () => {
      const specialties = ['residential', 'commercial', 'catastrophe', 'general'] as const;
      for (const specialty of specialties) {
        useStore.getState().addAdjuster(`Adj ${specialty}`, `${specialty}@example.com`, '555-0000', specialty);
      }
      const adjusters = useStore.getState().adjusters;
      expect(adjusters.length).toBe(4);
      specialties.forEach((specialty, idx) => {
        expect(adjusters[idx].specialty).toBe(specialty);
      });
    });

    it('should default new adjuster status to available', () => {
      useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'general');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });
  });

  // ─── Adjuster Status Updates ────────────────────────────────────

  describe('Updating adjuster status', () => {
    it('should update adjuster status to assigned', () => {
      const id = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().updateAdjusterStatus(id, 'assigned');
      expect(useStore.getState().adjusters[0].status).toBe('assigned');
    });

    it('should update adjuster status to on-site', () => {
      const id = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().updateAdjusterStatus(id, 'on-site');
      expect(useStore.getState().adjusters[0].status).toBe('on-site');
    });

    it('should update adjuster status to unavailable', () => {
      const id = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().updateAdjusterStatus(id, 'unavailable');
      expect(useStore.getState().adjusters[0].status).toBe('unavailable');
    });

    it('should cycle through all adjuster statuses', () => {
      const id = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const statuses = ['assigned', 'on-site', 'unavailable', 'available'] as const;
      for (const status of statuses) {
        useStore.getState().updateAdjusterStatus(id, status);
        expect(useStore.getState().adjusters.find((a) => a.id === id)?.status).toBe(status);
      }
    });

    it('should only update the targeted adjuster', () => {
      const id1 = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const id2 = useStore.getState().addAdjuster('Bob', 'bob@example.com', '555-0102', 'commercial');
      useStore.getState().updateAdjusterStatus(id1, 'unavailable');

      expect(useStore.getState().adjusters.find((a) => a.id === id1)?.status).toBe('unavailable');
      expect(useStore.getState().adjusters.find((a) => a.id === id2)?.status).toBe('available');
    });

    it('should handle updating status of non-existent adjuster gracefully', () => {
      useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      // Should not throw
      useStore.getState().updateAdjusterStatus('non-existent-id', 'assigned');
      // Original adjuster should be unaffected
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });
  });

  // ─── Deleting Adjusters ─────────────────────────────────────────

  describe('Deleting adjusters', () => {
    it('should remove the adjuster from the list', () => {
      const id = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().addAdjuster('Bob', 'bob@example.com', '555-0102', 'commercial');
      expect(useStore.getState().adjusters.length).toBe(2);

      useStore.getState().deleteAdjuster(id);
      expect(useStore.getState().adjusters.length).toBe(1);
      expect(useStore.getState().adjusters[0].name).toBe('Bob');
    });

    it('should cancel active inspections for the deleted adjuster', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Initial inspection');

      expect(useStore.getState().inspections[0].status).toBe('scheduled');

      useStore.getState().deleteAdjuster(adjusterId);
      expect(useStore.getState().inspections[0].status).toBe('cancelled');
    });

    it('should not cancel completed inspections when adjuster is deleted', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Inspection');

      // Complete the inspection first
      useStore.getState().updateInspectionStatus(inspId, 'completed');
      expect(useStore.getState().inspections[0].status).toBe('completed');

      useStore.getState().deleteAdjuster(adjusterId);
      // Completed inspection should remain completed
      expect(useStore.getState().inspections[0].status).toBe('completed');
    });

    it('should not cancel already-cancelled inspections when adjuster is deleted', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Inspection');

      useStore.getState().cancelInspection(useStore.getState().inspections[0].id);
      const cancelledAt = useStore.getState().inspections[0].updatedAt;

      useStore.getState().deleteAdjuster(adjusterId);
      // Should still be cancelled, status preserved
      expect(useStore.getState().inspections[0].status).toBe('cancelled');
    });

    it('should cancel in-progress inspections when adjuster is deleted', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Inspection');

      useStore.getState().updateInspectionStatus(inspId, 'in-progress');
      expect(useStore.getState().inspections[0].status).toBe('in-progress');

      useStore.getState().deleteAdjuster(adjusterId);
      expect(useStore.getState().inspections[0].status).toBe('cancelled');
    });

    it('should not affect inspections of other adjusters when deleting', () => {
      const adj1 = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const adj2 = useStore.getState().addAdjuster('Bob', 'bob@example.com', '555-0102', 'commercial');

      useStore.getState().scheduleInspection(claimId, adj1, '2024-03-15', '10:00', 'Alice inspection');

      const claimId2 = useStore.getState().addClaim('CLM-002', 'Jane', '2024-02-01');
      useStore.getState().scheduleInspection(claimId2, adj2, '2024-03-16', '11:00', 'Bob inspection');

      useStore.getState().deleteAdjuster(adj1);

      const inspections = useStore.getState().inspections;
      // Alice's inspection should be cancelled
      expect(inspections.find((i) => i.adjusterId === adj1)?.status).toBe('cancelled');
      // Bob's inspection should remain scheduled
      expect(inspections.find((i) => i.adjusterId === adj2)?.status).toBe('scheduled');
    });

    it('should handle deleting non-existent adjuster gracefully', () => {
      useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().deleteAdjuster('non-existent-id');
      expect(useStore.getState().adjusters.length).toBe(1);
    });
  });

  // ─── Scheduling Inspections ─────────────────────────────────────

  describe('Scheduling inspections', () => {
    it('should schedule an inspection and return a unique ID', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Initial inspection');

      expect(inspId).toBeTruthy();
      expect(typeof inspId).toBe('string');
      expect(inspId.length).toBeGreaterThan(0);
    });

    it('should store the inspection with all provided fields', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Roof damage assessment');

      const inspections = useStore.getState().inspections;
      expect(inspections.length).toBe(1);

      const insp = inspections[0];
      expect(insp.id).toBe(inspId);
      expect(insp.claimId).toBe(claimId);
      expect(insp.adjusterId).toBe(adjusterId);
      expect(insp.scheduledDate).toBe('2024-03-15');
      expect(insp.scheduledTime).toBe('10:00');
      expect(insp.status).toBe('scheduled');
      expect(insp.notes).toBe('Roof damage assessment');
      expect(insp.createdAt).toBeTruthy();
      expect(insp.updatedAt).toBeTruthy();
      expect(new Date(insp.createdAt).getTime()).toBeGreaterThan(0);
      expect(new Date(insp.updatedAt).getTime()).toBeGreaterThan(0);
    });

    it('should set the adjuster status to assigned when inspection is scheduled', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      expect(useStore.getState().adjusters[0].status).toBe('available');

      useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');
      expect(useStore.getState().adjusters[0].status).toBe('assigned');
    });

    it('should schedule multiple inspections', () => {
      const adj1 = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const adj2 = useStore.getState().addAdjuster('Bob', 'bob@example.com', '555-0102', 'commercial');
      const claimId2 = useStore.getState().addClaim('CLM-002', 'Jane', '2024-02-01');

      const inspId1 = useStore.getState().scheduleInspection(claimId, adj1, '2024-03-15', '10:00', 'First');
      const inspId2 = useStore.getState().scheduleInspection(claimId2, adj2, '2024-03-16', '14:00', 'Second');

      expect(inspId1).not.toBe(inspId2);
      expect(useStore.getState().inspections.length).toBe(2);
    });

    it('should handle scheduling with empty notes', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', '');

      expect(inspId).toBeTruthy();
      expect(useStore.getState().inspections[0].notes).toBe('');
    });
  });

  // ─── Updating Inspection Status ─────────────────────────────────

  describe('Updating inspection status', () => {
    it('should update inspection to in-progress and set adjuster to on-site', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      useStore.getState().updateInspectionStatus(inspId, 'in-progress');

      expect(useStore.getState().inspections[0].status).toBe('in-progress');
      expect(useStore.getState().adjusters[0].status).toBe('on-site');
    });

    it('should update inspection to completed and set adjuster back to available', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      useStore.getState().updateInspectionStatus(inspId, 'in-progress');
      expect(useStore.getState().adjusters[0].status).toBe('on-site');

      useStore.getState().updateInspectionStatus(inspId, 'completed');
      expect(useStore.getState().inspections[0].status).toBe('completed');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });

    it('should update the inspection updatedAt timestamp', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');
      const originalUpdatedAt = useStore.getState().inspections[0].updatedAt;

      useStore.getState().updateInspectionStatus(inspId, 'in-progress');
      const newUpdatedAt = useStore.getState().inspections[0].updatedAt;

      expect(newUpdatedAt).toBeTruthy();
      expect(new Date(newUpdatedAt).getTime()).toBeGreaterThanOrEqual(new Date(originalUpdatedAt).getTime());
    });

    it('should not change adjuster status for other status transitions', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      // Adjuster should be 'assigned' after scheduling
      expect(useStore.getState().adjusters[0].status).toBe('assigned');

      // Update to 'scheduled' (same status) -- the store doesn't explicitly handle this,
      // so adjuster status should remain unchanged
      useStore.getState().updateInspectionStatus(inspId, 'scheduled');
      expect(useStore.getState().adjusters[0].status).toBe('assigned');
    });

    it('should handle updating status of non-existent inspection gracefully', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      // Should not throw
      useStore.getState().updateInspectionStatus('non-existent-id', 'completed');

      // Existing data should be unaffected
      expect(useStore.getState().inspections[0].status).toBe('scheduled');
      expect(useStore.getState().adjusters[0].status).toBe('assigned');
    });

    it('should only update the targeted inspection and adjuster', () => {
      const adj1 = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const adj2 = useStore.getState().addAdjuster('Bob', 'bob@example.com', '555-0102', 'commercial');
      const claimId2 = useStore.getState().addClaim('CLM-002', 'Jane', '2024-02-01');

      const inspId1 = useStore.getState().scheduleInspection(claimId, adj1, '2024-03-15', '10:00', 'First');
      const inspId2 = useStore.getState().scheduleInspection(claimId2, adj2, '2024-03-16', '14:00', 'Second');

      useStore.getState().updateInspectionStatus(inspId1, 'in-progress');

      // Alice's inspection should be in-progress, Alice on-site
      expect(useStore.getState().inspections.find((i) => i.id === inspId1)?.status).toBe('in-progress');
      expect(useStore.getState().adjusters.find((a) => a.id === adj1)?.status).toBe('on-site');

      // Bob's inspection should still be scheduled, Bob still assigned
      expect(useStore.getState().inspections.find((i) => i.id === inspId2)?.status).toBe('scheduled');
      expect(useStore.getState().adjusters.find((a) => a.id === adj2)?.status).toBe('assigned');
    });

    it('should follow the full lifecycle: scheduled -> in-progress -> completed', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Full lifecycle');

      // After scheduling
      expect(useStore.getState().inspections[0].status).toBe('scheduled');
      expect(useStore.getState().adjusters[0].status).toBe('assigned');

      // In progress
      useStore.getState().updateInspectionStatus(inspId, 'in-progress');
      expect(useStore.getState().inspections[0].status).toBe('in-progress');
      expect(useStore.getState().adjusters[0].status).toBe('on-site');

      // Completed
      useStore.getState().updateInspectionStatus(inspId, 'completed');
      expect(useStore.getState().inspections[0].status).toBe('completed');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });
  });

  // ─── Cancelling Inspections ─────────────────────────────────────

  describe('Cancelling inspections', () => {
    it('should cancel a scheduled inspection and set adjuster back to available', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      expect(useStore.getState().adjusters[0].status).toBe('assigned');

      useStore.getState().cancelInspection(inspId);

      expect(useStore.getState().inspections[0].status).toBe('cancelled');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });

    it('should cancel an in-progress inspection and set adjuster back to available', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      useStore.getState().updateInspectionStatus(inspId, 'in-progress');
      expect(useStore.getState().adjusters[0].status).toBe('on-site');

      useStore.getState().cancelInspection(inspId);

      expect(useStore.getState().inspections[0].status).toBe('cancelled');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });

    it('should update the updatedAt timestamp when cancelled', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');
      const originalUpdatedAt = useStore.getState().inspections[0].updatedAt;

      useStore.getState().cancelInspection(inspId);
      const newUpdatedAt = useStore.getState().inspections[0].updatedAt;

      expect(new Date(newUpdatedAt).getTime()).toBeGreaterThanOrEqual(new Date(originalUpdatedAt).getTime());
    });

    it('should handle cancelling non-existent inspection gracefully', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      // Should not throw
      useStore.getState().cancelInspection('non-existent-id');

      // Existing data should be unaffected
      expect(useStore.getState().inspections[0].status).toBe('scheduled');
      expect(useStore.getState().adjusters[0].status).toBe('assigned');
    });

    it('should preserve other inspection fields when cancelled', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Important notes');

      useStore.getState().cancelInspection(inspId);

      const insp = useStore.getState().inspections[0];
      expect(insp.claimId).toBe(claimId);
      expect(insp.adjusterId).toBe(adjusterId);
      expect(insp.scheduledDate).toBe('2024-03-15');
      expect(insp.scheduledTime).toBe('10:00');
      expect(insp.notes).toBe('Important notes');
      expect(insp.status).toBe('cancelled');
    });
  });

  // ─── Deleting Inspections ──────────────────────────────────────

  describe('Deleting inspections', () => {
    it('should remove the inspection from the list', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      expect(useStore.getState().inspections.length).toBe(1);

      useStore.getState().deleteInspection(inspId);
      expect(useStore.getState().inspections.length).toBe(0);
    });

    it('should only delete the targeted inspection', () => {
      const adj1 = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const adj2 = useStore.getState().addAdjuster('Bob', 'bob@example.com', '555-0102', 'commercial');
      const claimId2 = useStore.getState().addClaim('CLM-002', 'Jane', '2024-02-01');

      const inspId1 = useStore.getState().scheduleInspection(claimId, adj1, '2024-03-15', '10:00', 'First');
      const inspId2 = useStore.getState().scheduleInspection(claimId2, adj2, '2024-03-16', '14:00', 'Second');

      useStore.getState().deleteInspection(inspId1);

      expect(useStore.getState().inspections.length).toBe(1);
      expect(useStore.getState().inspections[0].id).toBe(inspId2);
    });

    it('should handle deleting non-existent inspection gracefully', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      useStore.getState().deleteInspection('non-existent-id');
      expect(useStore.getState().inspections.length).toBe(1);
    });

    it('should not modify adjuster status when inspection is deleted', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const inspId = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'Notes');

      // Adjuster is assigned after scheduling
      expect(useStore.getState().adjusters[0].status).toBe('assigned');

      useStore.getState().deleteInspection(inspId);

      // deleteInspection only removes the record; adjuster status is not changed
      expect(useStore.getState().adjusters[0].status).toBe('assigned');
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should start with empty adjusters array', () => {
      useStore.setState({ adjusters: [], inspections: [] });
      expect(useStore.getState().adjusters).toEqual([]);
      expect(useStore.getState().adjusters.length).toBe(0);
    });

    it('should start with empty inspections array', () => {
      useStore.setState({ adjusters: [], inspections: [] });
      expect(useStore.getState().inspections).toEqual([]);
      expect(useStore.getState().inspections.length).toBe(0);
    });

    it('should handle updating status on an empty adjusters list', () => {
      useStore.setState({ adjusters: [] });
      // Should not throw
      useStore.getState().updateAdjusterStatus('any-id', 'assigned');
      expect(useStore.getState().adjusters.length).toBe(0);
    });

    it('should handle deleting from an empty adjusters list', () => {
      useStore.setState({ adjusters: [], inspections: [] });
      // Should not throw
      useStore.getState().deleteAdjuster('any-id');
      expect(useStore.getState().adjusters.length).toBe(0);
    });

    it('should handle cancelling inspection when inspections list is empty', () => {
      useStore.setState({ inspections: [] });
      // Should not throw
      useStore.getState().cancelInspection('any-id');
      expect(useStore.getState().inspections.length).toBe(0);
    });

    it('should handle deleting inspection when inspections list is empty', () => {
      useStore.setState({ inspections: [] });
      // Should not throw
      useStore.getState().deleteInspection('any-id');
      expect(useStore.getState().inspections.length).toBe(0);
    });

    it('should handle updating inspection status when inspections list is empty', () => {
      useStore.setState({ inspections: [] });
      // Should not throw
      useStore.getState().updateInspectionStatus('any-id', 'completed');
      expect(useStore.getState().inspections.length).toBe(0);
    });

    it('should preserve adjuster data across status updates', () => {
      const id = useStore.getState().addAdjuster('Alice Walker', 'alice@example.com', '555-0101', 'catastrophe');
      useStore.getState().updateAdjusterStatus(id, 'on-site');

      const adj = useStore.getState().adjusters[0];
      expect(adj.name).toBe('Alice Walker');
      expect(adj.email).toBe('alice@example.com');
      expect(adj.phone).toBe('555-0101');
      expect(adj.specialty).toBe('catastrophe');
      expect(adj.createdAt).toBeTruthy();
      expect(adj.status).toBe('on-site');
    });

    it('should handle multiple inspections for the same adjuster', () => {
      const adjusterId = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const claimId2 = useStore.getState().addClaim('CLM-002', 'Jane', '2024-02-01');

      const inspId1 = useStore.getState().scheduleInspection(claimId, adjusterId, '2024-03-15', '10:00', 'First');
      const inspId2 = useStore.getState().scheduleInspection(claimId2, adjusterId, '2024-03-16', '14:00', 'Second');

      expect(useStore.getState().inspections.length).toBe(2);
      expect(useStore.getState().adjusters[0].status).toBe('assigned');

      // Complete the first inspection -- adjuster set back to available
      useStore.getState().updateInspectionStatus(inspId1, 'completed');
      expect(useStore.getState().adjusters[0].status).toBe('available');
    });

    it('should handle multiple inspections for the same claim', () => {
      const adj1 = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const adj2 = useStore.getState().addAdjuster('Bob', 'bob@example.com', '555-0102', 'commercial');

      useStore.getState().scheduleInspection(claimId, adj1, '2024-03-15', '10:00', 'Alice inspects');
      useStore.getState().scheduleInspection(claimId, adj2, '2024-03-16', '14:00', 'Bob inspects');

      const inspections = useStore.getState().inspections;
      expect(inspections.length).toBe(2);
      expect(inspections[0].claimId).toBe(claimId);
      expect(inspections[1].claimId).toBe(claimId);
    });

    it('should handle deleting all adjusters leaving inspections as cancelled', () => {
      const adj1 = useStore.getState().addAdjuster('Alice', 'alice@example.com', '555-0101', 'residential');
      const adj2 = useStore.getState().addAdjuster('Bob', 'bob@example.com', '555-0102', 'commercial');
      const claimId2 = useStore.getState().addClaim('CLM-002', 'Jane', '2024-02-01');

      useStore.getState().scheduleInspection(claimId, adj1, '2024-03-15', '10:00', 'First');
      useStore.getState().scheduleInspection(claimId2, adj2, '2024-03-16', '14:00', 'Second');

      useStore.getState().deleteAdjuster(adj1);
      useStore.getState().deleteAdjuster(adj2);

      expect(useStore.getState().adjusters.length).toBe(0);
      expect(useStore.getState().inspections[0].status).toBe('cancelled');
      expect(useStore.getState().inspections[1].status).toBe('cancelled');
    });
  });
});
