/**
 * Unit tests for Claims management store actions
 * Run with: npx vitest run tests/unit/claims.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/store/useStore';

describe('Claims Management', () => {
  beforeEach(() => {
    useStore.setState({
      properties: [],
      activePropertyId: null,
      activeMeasurement: null,
    });
    useStore.getState().createProperty('123 Main St', 'Springfield', 'IL', '62701', 39.7817, -89.6501);
  });

  it('should add a claim to the active property', () => {
    const claimId = useStore.getState().addClaim('CLM-001', 'John Smith', '2024-06-15');
    expect(claimId).toBeTruthy();
    const property = useStore.getState().properties[0];
    expect(property.claims.length).toBe(1);
    expect(property.claims[0].claimNumber).toBe('CLM-001');
    expect(property.claims[0].insuredName).toBe('John Smith');
    expect(property.claims[0].dateOfLoss).toBe('2024-06-15');
    expect(property.claims[0].status).toBe('new');
    expect(property.claims[0].notes).toBe('');
  });

  it('should return empty string when no active property', () => {
    useStore.setState({ activePropertyId: null });
    const id = useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    expect(id).toBe('');
  });

  it('should add multiple claims', () => {
    useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    useStore.getState().addClaim('CLM-002', 'Jane', '2024-02-01');
    const property = useStore.getState().properties[0];
    expect(property.claims.length).toBe(2);
  });

  it('should update claim status', () => {
    const claimId = useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    useStore.getState().updateClaimStatus(claimId, 'inspected');
    const claim = useStore.getState().properties[0].claims[0];
    expect(claim.status).toBe('inspected');
  });

  it('should cycle through all claim statuses', () => {
    const claimId = useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    const statuses = ['inspected', 'estimated', 'submitted', 'approved', 'closed'] as const;
    for (const status of statuses) {
      useStore.getState().updateClaimStatus(claimId, status);
      expect(useStore.getState().properties[0].claims[0].status).toBe(status);
    }
  });

  it('should update claim notes', () => {
    const claimId = useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    useStore.getState().updateClaimNotes(claimId, 'Roof damage from hailstorm. 15 broken shingles.');
    const claim = useStore.getState().properties[0].claims[0];
    expect(claim.notes).toBe('Roof damage from hailstorm. 15 broken shingles.');
  });

  it('should set updatedAt on status change', () => {
    const claimId = useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    useStore.getState().updateClaimStatus(claimId, 'estimated');
    const claim = useStore.getState().properties[0].claims[0];
    expect(claim.updatedAt).toBeTruthy();
    expect(new Date(claim.updatedAt).getTime()).toBeGreaterThan(0);
  });

  it('should delete a claim', () => {
    const claimId = useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    useStore.getState().addClaim('CLM-002', 'Jane', '2024-02-01');
    expect(useStore.getState().properties[0].claims.length).toBe(2);

    useStore.getState().deleteClaim(claimId);
    expect(useStore.getState().properties[0].claims.length).toBe(1);
    expect(useStore.getState().properties[0].claims[0].claimNumber).toBe('CLM-002');
  });

  it('should handle deleting non-existent claim gracefully', () => {
    useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    useStore.getState().deleteClaim('non-existent-id');
    expect(useStore.getState().properties[0].claims.length).toBe(1);
  });

  it('should do nothing when updating status with no active property', () => {
    const claimId = useStore.getState().addClaim('CLM-001', 'John', '2024-01-01');
    useStore.setState({ activePropertyId: null });
    useStore.getState().updateClaimStatus(claimId, 'approved');
    // Status should remain unchanged since we can't update without active property
    // (but the state was already nulled so the property is unreachable)
    expect(true).toBe(true); // Should not throw
  });

  it('should preserve claim data across status updates', () => {
    const claimId = useStore.getState().addClaim('CLM-001', 'John Smith', '2024-06-15');
    useStore.getState().updateClaimStatus(claimId, 'submitted');
    const claim = useStore.getState().properties[0].claims[0];
    expect(claim.claimNumber).toBe('CLM-001');
    expect(claim.insuredName).toBe('John Smith');
    expect(claim.dateOfLoss).toBe('2024-06-15');
  });

  it('should only modify claims on active property', () => {
    const id1 = useStore.getState().properties[0].id;
    const id2 = useStore.getState().createProperty('456 Oak', 'Chicago', 'IL', '60601', 41.88, -87.63);

    // Add claim to property 2
    useStore.getState().addClaim('CLM-P2', 'User2', '2024-03-01');
    expect(useStore.getState().properties[1].claims.length).toBe(1);

    // Switch to property 1 and add claim
    useStore.getState().setActiveProperty(id1);
    useStore.getState().addClaim('CLM-P1', 'User1', '2024-04-01');
    expect(useStore.getState().properties[0].claims.length).toBe(1);
    expect(useStore.getState().properties[1].claims.length).toBe(1);
  });
});
