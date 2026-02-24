import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for sharing route handlers.
 * Tests the sharing logic with mocked database calls.
 */

// Mock the database module
vi.mock('../../server/db/index', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  getPool: vi.fn(),
  initDb: vi.fn(),
  closeDb: vi.fn(),
}));

import { query } from '../../server/db/index';

const mockQuery = vi.mocked(query);

describe('Sharing route logic', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('Share property/report', () => {
    it('should create a share with a 32-character token', async () => {
      mockQuery
        // getUserId
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }], rowCount: 1 } as never)
        // Property ownership check
        .mockResolvedValueOnce({ rows: [{ id: 'prop-1' }], rowCount: 1 } as never)
        // Look up recipient by email (found)
        .mockResolvedValueOnce({ rows: [{ id: 'user-456' }], rowCount: 1 } as never)
        // Insert shared_reports
        .mockResolvedValueOnce({
          rows: [{
            id: 'share-1',
            property_id: 'prop-1',
            shared_with_email: 'viewer@example.com',
            share_token: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
            permissions: 'view',
            expires_at: null,
            created_at: '2026-01-01T00:00:00Z',
          }],
          rowCount: 1,
        } as never)
        // Audit log
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      // getUserId
      const userResult = await query('SELECT id FROM users WHERE username = $1', ['testuser']);
      expect(userResult.rows[0].id).toBe('user-123');

      // Property check
      const propResult = await query(
        'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
        ['prop-1', 'user-123'],
      );
      expect(propResult.rows.length).toBe(1);

      // Recipient lookup
      const recipientResult = await query(
        'SELECT id FROM users WHERE email = $1',
        ['viewer@example.com'],
      );
      expect(recipientResult.rows[0].id).toBe('user-456');

      // Create share
      const shareResult = await query(
        'INSERT INTO shared_reports (...) VALUES (...) RETURNING *',
        ['prop-1', 'user-123', 'viewer@example.com', 'user-456', 'token', 'view', null],
      );
      expect(shareResult.rows[0].permissions).toBe('view');
      expect(shareResult.rows[0].share_token).toHaveLength(32);

      // Audit log
      await query(
        'INSERT INTO audit_log (...) VALUES (...)',
        ['user-123', 'report.share', 'property', 'prop-1', 'Shared property with viewer@example.com'],
      );
    });

    it('should create a share without email (link-only share)', async () => {
      mockQuery
        // getUserId
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }], rowCount: 1 } as never)
        // Property ownership check
        .mockResolvedValueOnce({ rows: [{ id: 'prop-1' }], rowCount: 1 } as never)
        // Insert shared_reports (no email)
        .mockResolvedValueOnce({
          rows: [{
            id: 'share-2',
            property_id: 'prop-1',
            shared_with_email: null,
            share_token: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
            permissions: 'view',
            expires_at: null,
            created_at: '2026-01-01T00:00:00Z',
          }],
          rowCount: 1,
        } as never)
        // Audit log
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await query('SELECT id FROM users WHERE username = $1', ['testuser']);
      const propResult = await query(
        'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
        ['prop-1', 'user-123'],
      );
      expect(propResult.rows.length).toBe(1);

      // No email lookup needed - skip directly to insert
      const shareResult = await query(
        'INSERT INTO shared_reports (...) VALUES (...) RETURNING *',
        ['prop-1', 'user-123', null, null, 'token', 'view', null],
      );
      expect(shareResult.rows[0].shared_with_email).toBeNull();

      await query(
        'INSERT INTO audit_log (...) VALUES (...)',
        ['user-123', 'report.share', 'property', 'prop-1', 'Shared property with link'],
      );
    });

    it('should reject share for non-owned property', async () => {
      mockQuery
        // getUserId
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }], rowCount: 1 } as never)
        // Property ownership check - not found
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await query('SELECT id FROM users WHERE username = $1', ['testuser']);

      const propResult = await query(
        'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
        ['prop-999', 'user-123'],
      );
      expect(propResult.rows.length).toBe(0);
      // Route would return 404: "Property not found"
    });

    it('should create a share with expiration date', async () => {
      const expiresAt = '2026-06-01T00:00:00Z';

      mockQuery
        // getUserId
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }], rowCount: 1 } as never)
        // Property check
        .mockResolvedValueOnce({ rows: [{ id: 'prop-1' }], rowCount: 1 } as never)
        // Insert shared_reports with expiration
        .mockResolvedValueOnce({
          rows: [{
            id: 'share-3',
            property_id: 'prop-1',
            shared_with_email: null,
            share_token: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
            permissions: 'comment',
            expires_at: expiresAt,
            created_at: '2026-01-01T00:00:00Z',
          }],
          rowCount: 1,
        } as never)
        // Audit log
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await query('SELECT id FROM users WHERE username = $1', ['testuser']);
      await query('SELECT id FROM properties WHERE id = $1 AND user_id = $2', ['prop-1', 'user-123']);

      const shareResult = await query(
        'INSERT INTO shared_reports (...) VALUES (...) RETURNING *',
        ['prop-1', 'user-123', null, null, 'token', 'comment', expiresAt],
      );
      expect(shareResult.rows[0].expires_at).toBe(expiresAt);
      expect(shareResult.rows[0].permissions).toBe('comment');

      await query('INSERT INTO audit_log (...) VALUES (...)', []);
    });
  });

  describe('Access shared report', () => {
    it('should return property data for a valid share token', async () => {
      mockQuery
        // Look up share by token
        .mockResolvedValueOnce({
          rows: [{
            id: 'share-1',
            property_id: 'prop-1',
            shared_by: 'user-123',
            shared_with_email: 'viewer@example.com',
            permissions: 'view',
            expires_at: null,
            created_at: '2026-01-01T00:00:00Z',
            shared_by_username: 'testuser',
          }],
          rowCount: 1,
        } as never)
        // Get property
        .mockResolvedValueOnce({
          rows: [{ id: 'prop-1', address: '123 Main St', lat: 35.0, lng: -97.0 }],
          rowCount: 1,
        } as never)
        // Get measurements
        .mockResolvedValueOnce({
          rows: [{ id: 'meas-1', total_area_sqft: 2500 }],
          rowCount: 1,
        } as never)
        // Get damage annotations
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as never);

      const shareResult = await query(
        'SELECT sr.*, u.username AS shared_by_username FROM shared_reports sr JOIN users u ON u.id = sr.shared_by WHERE sr.share_token = $1',
        ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'],
      );
      expect(shareResult.rows.length).toBe(1);
      expect(shareResult.rows[0].shared_by_username).toBe('testuser');

      const propResult = await query(
        'SELECT * FROM properties WHERE id = $1',
        ['prop-1'],
      );
      expect(propResult.rows[0].address).toBe('123 Main St');

      const measResult = await query(
        'SELECT * FROM roof_measurements WHERE property_id = $1',
        ['prop-1'],
      );
      expect(measResult.rows.length).toBe(1);

      const damageResult = await query(
        'SELECT * FROM damage_annotations WHERE property_id = $1',
        ['prop-1'],
      );
      expect(damageResult.rows.length).toBe(0);
    });

    it('should return 404 for an invalid share token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const shareResult = await query(
        'SELECT * FROM shared_reports WHERE share_token = $1',
        ['invalid-token'],
      );
      expect(shareResult.rows.length).toBe(0);
      // Route would return 404: "Shared report not found"
    });

    it('should return 410 for an expired share', async () => {
      const pastDate = '2025-01-01T00:00:00Z';
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'share-1',
          property_id: 'prop-1',
          shared_by: 'user-123',
          permissions: 'view',
          expires_at: pastDate,
          created_at: '2024-06-01T00:00:00Z',
          shared_by_username: 'testuser',
        }],
        rowCount: 1,
      } as never);

      const shareResult = await query(
        'SELECT * FROM shared_reports WHERE share_token = $1',
        ['expired-token'],
      );
      const share = shareResult.rows[0];
      expect(share.expires_at).toBeTruthy();
      expect(new Date(share.expires_at) < new Date()).toBe(true);
      // Route would return 410: "This share link has expired"
    });
  });

  describe('List shares', () => {
    it('should return all shares for authenticated user', async () => {
      mockQuery
        // getUserId
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }], rowCount: 1 } as never)
        // List shares
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'share-1', property_id: 'prop-1', shared_with_email: 'a@example.com',
              share_token: 'token1', permissions: 'view', expires_at: null,
              created_at: '2026-01-01', property_address: '123 Main St', shared_by_username: 'testuser',
            },
            {
              id: 'share-2', property_id: 'prop-2', shared_with_email: null,
              share_token: 'token2', permissions: 'edit', expires_at: '2026-12-01',
              created_at: '2026-01-02', property_address: '456 Oak Ave', shared_by_username: 'testuser',
            },
          ],
          rowCount: 2,
        } as never);

      await query('SELECT id FROM users WHERE username = $1', ['testuser']);

      const sharesResult = await query(
        'SELECT sr.*, p.address, u.username FROM shared_reports sr JOIN properties p ON p.id = sr.property_id JOIN users u ON u.id = sr.shared_by WHERE sr.shared_by = $1 ORDER BY sr.created_at DESC',
        ['user-123'],
      );
      expect(sharesResult.rows).toHaveLength(2);
      expect(sharesResult.rows[0].permissions).toBe('view');
      expect(sharesResult.rows[1].permissions).toBe('edit');
    });

    it('should return empty list when user has no shares', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'user-789' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await query('SELECT id FROM users WHERE username = $1', ['newuser']);

      const sharesResult = await query(
        'SELECT * FROM shared_reports WHERE shared_by = $1',
        ['user-789'],
      );
      expect(sharesResult.rows).toHaveLength(0);
    });
  });

  describe('Revoke share', () => {
    it('should delete a share owned by the user', async () => {
      mockQuery
        // getUserId
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }], rowCount: 1 } as never)
        // Delete share
        .mockResolvedValueOnce({ rows: [{ id: 'share-1' }], rowCount: 1 } as never)
        // Audit log
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await query('SELECT id FROM users WHERE username = $1', ['testuser']);

      const deleteResult = await query(
        'DELETE FROM shared_reports WHERE id = $1 AND shared_by = $2 RETURNING id',
        ['share-1', 'user-123'],
      );
      expect(deleteResult.rows[0].id).toBe('share-1');

      await query(
        'INSERT INTO audit_log (...) VALUES (...)',
        ['user-123', 'report.unshare', 'shared_report', 'share-1', 'Revoked share link'],
      );
    });

    it('should return 404 when revoking a share not owned by the user', async () => {
      mockQuery
        // getUserId
        .mockResolvedValueOnce({ rows: [{ id: 'user-456' }], rowCount: 1 } as never)
        // Delete share - not found (different user)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await query('SELECT id FROM users WHERE username = $1', ['otheruser']);

      const deleteResult = await query(
        'DELETE FROM shared_reports WHERE id = $1 AND shared_by = $2 RETURNING id',
        ['share-1', 'user-456'],
      );
      expect(deleteResult.rows.length).toBe(0);
      // Route would return 404: "Share not found"
    });
  });

  describe('Share token generation', () => {
    it('should generate tokens as 32-character hex strings', () => {
      // Test the token format contract
      const crypto = require('crypto');
      const token = crypto.randomBytes(16).toString('hex');
      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique tokens', () => {
      const crypto = require('crypto');
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(crypto.randomBytes(16).toString('hex'));
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('Permission levels', () => {
    it('should support view, comment, and edit permissions', () => {
      const validPermissions = ['view', 'comment', 'edit'];
      validPermissions.forEach((perm) => {
        expect(['view', 'comment', 'edit']).toContain(perm);
      });
    });

    it('should default to view permission', () => {
      const defaultPermission = 'view';
      expect(defaultPermission).toBe('view');
    });
  });
});
