import { Router, type Request, type Response } from 'express';
import { query } from '../db/index.js';
import { requireFields, requireUuidParam } from '../middleware/validate.js';
import type { AuthPayload } from '../middleware/auth.js';

const router = Router();

type AuthRequest = Request & { user: AuthPayload };

/** Extract a single string param from Express params */
function p(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

/** Helper: get user ID from username */
async function getUserId(username: string): Promise<string> {
  const result = await query<{ id: string }>(
    'SELECT id FROM users WHERE username = $1',
    [username],
  );
  if (result.rows.length === 0) {
    throw new Error(`User not found: ${username}`);
  }
  return result.rows[0].id;
}

/** Helper: check if user is an admin of the organization */
async function isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
  const result = await query(
    `SELECT role FROM organization_members
     WHERE organization_id = $1 AND user_id = $2 AND role = 'admin'`,
    [orgId, userId],
  );
  return result.rows.length > 0;
}

/** Helper: check if user is a member of the organization */
async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const result = await query(
    `SELECT id FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId],
  );
  return result.rows.length > 0;
}

// ─── CREATE ORGANIZATION ────────────────────────────────────────────
router.post(
  '/',
  requireFields('name'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const { name, plan } = req.body;

      // Create the organization
      const orgResult = await query(
        `INSERT INTO organizations (name, plan)
         VALUES ($1, $2)
         RETURNING id, name, plan, created_at, updated_at`,
        [name, plan || 'free'],
      );

      const org = orgResult.rows[0];

      // Add the creator as admin
      await query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
        [org.id, userId],
      );

      // Log the action
      await query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'organization.create', 'organization', org.id, `Created organization "${name}"`],
      );

      res.status(201).json(org);
    } catch (err) {
      console.error('Create organization error:', err);
      res.status(500).json({ error: 'Failed to create organization' });
    }
  },
);

// ─── GET ORGANIZATION ───────────────────────────────────────────────
router.get('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const orgId = p(req, 'id');

    // Verify membership
    if (!(await isOrgMember(orgId, userId))) {
      res.status(403).json({ error: 'Not a member of this organization' });
      return;
    }

    const orgResult = await query(
      `SELECT id, name, plan, created_at, updated_at
       FROM organizations WHERE id = $1`,
      [orgId],
    );

    if (orgResult.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Get member count
    const countResult = await query(
      'SELECT COUNT(*) AS count FROM organization_members WHERE organization_id = $1',
      [orgId],
    );

    res.json({
      ...orgResult.rows[0],
      memberCount: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Get organization error:', err);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

// ─── UPDATE ORGANIZATION ────────────────────────────────────────────
router.put('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const orgId = p(req, 'id');

    // Only admins can update
    if (!(await isOrgAdmin(orgId, userId))) {
      res.status(403).json({ error: 'Only organization admins can update settings' });
      return;
    }

    const { name, plan } = req.body;

    const result = await query(
      `UPDATE organizations
       SET name = COALESCE($2, name),
           plan = COALESCE($3, plan),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, plan, created_at, updated_at`,
      [orgId, name, plan],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Log the action
    await query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'organization.update', 'organization', orgId, 'Updated organization settings'],
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update organization error:', err);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ─── DELETE ORGANIZATION ────────────────────────────────────────────
router.delete('/:id', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const orgId = p(req, 'id');

    // Only admins can delete
    if (!(await isOrgAdmin(orgId, userId))) {
      res.status(403).json({ error: 'Only organization admins can delete the organization' });
      return;
    }

    const result = await query(
      'DELETE FROM organizations WHERE id = $1 RETURNING id',
      [orgId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Log the action
    await query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'organization.delete', 'organization', orgId, 'Deleted organization'],
    );

    res.json({ deleted: true, id: orgId });
  } catch (err) {
    console.error('Delete organization error:', err);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// ─── INVITE MEMBER ──────────────────────────────────────────────────
router.post(
  '/:id/members',
  requireUuidParam('id'),
  requireFields('email'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const orgId = p(req, 'id');

      // Only admins can invite
      if (!(await isOrgAdmin(orgId, userId))) {
        res.status(403).json({ error: 'Only organization admins can invite members' });
        return;
      }

      const { email, role } = req.body;
      const memberRole = role || 'viewer';

      // Look up user by email
      const userResult = await query<{ id: string; username: string }>(
        'SELECT id, username FROM users WHERE email = $1',
        [email],
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ error: 'No user found with that email address' });
        return;
      }

      const invitedUser = userResult.rows[0];

      // Check if already a member
      if (await isOrgMember(orgId, invitedUser.id)) {
        res.status(409).json({ error: 'User is already a member of this organization' });
        return;
      }

      // Add member
      const memberResult = await query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, $3)
         RETURNING id, organization_id, user_id, role, joined_at, last_active_at`,
        [orgId, invitedUser.id, memberRole],
      );

      // Log the action
      await query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'user.invite', 'organization', orgId, `Invited ${email} as ${memberRole}`],
      );

      res.status(201).json({
        ...memberResult.rows[0],
        username: invitedUser.username,
        email,
      });
    } catch (err) {
      console.error('Invite member error:', err);
      res.status(500).json({ error: 'Failed to invite member' });
    }
  },
);

// ─── LIST MEMBERS ───────────────────────────────────────────────────
router.get('/:id/members', requireUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const { username } = (req as AuthRequest).user;
    const userId = await getUserId(username);
    const orgId = p(req, 'id');

    // Verify membership
    if (!(await isOrgMember(orgId, userId))) {
      res.status(403).json({ error: 'Not a member of this organization' });
      return;
    }

    const result = await query(
      `SELECT om.id, om.organization_id, om.user_id, u.username, u.email,
              om.role, om.joined_at, om.last_active_at
       FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.joined_at ASC`,
      [orgId],
    );

    res.json({ members: result.rows });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

// ─── UPDATE MEMBER ROLE ─────────────────────────────────────────────
router.put(
  '/:id/members/:uid',
  requireUuidParam('id', 'uid'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const orgId = p(req, 'id');
      const targetUid = p(req, 'uid');

      // Only admins can change roles
      if (!(await isOrgAdmin(orgId, userId))) {
        res.status(403).json({ error: 'Only organization admins can change member roles' });
        return;
      }

      const { role } = req.body;
      if (!role) {
        res.status(400).json({ error: 'Role is required' });
        return;
      }

      const result = await query(
        `UPDATE organization_members
         SET role = $3
         WHERE organization_id = $1 AND user_id = $2
         RETURNING id, organization_id, user_id, role, joined_at, last_active_at`,
        [orgId, targetUid, role],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      // Log the action
      await query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'user.role_change', 'organization', orgId, `Changed role of user ${targetUid} to ${role}`],
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update member role error:', err);
      res.status(500).json({ error: 'Failed to update member role' });
    }
  },
);

// ─── REMOVE MEMBER ──────────────────────────────────────────────────
router.delete(
  '/:id/members/:uid',
  requireUuidParam('id', 'uid'),
  async (req: Request, res: Response) => {
    try {
      const { username } = (req as AuthRequest).user;
      const userId = await getUserId(username);
      const orgId = p(req, 'id');
      const targetUid = p(req, 'uid');

      // Only admins can remove members
      if (!(await isOrgAdmin(orgId, userId))) {
        res.status(403).json({ error: 'Only organization admins can remove members' });
        return;
      }

      // Cannot remove yourself if you are the only admin
      if (targetUid === userId) {
        const adminCount = await query(
          `SELECT COUNT(*) AS count FROM organization_members
           WHERE organization_id = $1 AND role = 'admin'`,
          [orgId],
        );
        if (parseInt(adminCount.rows[0].count, 10) <= 1) {
          res.status(400).json({ error: 'Cannot remove the last admin from the organization' });
          return;
        }
      }

      const result = await query(
        `DELETE FROM organization_members
         WHERE organization_id = $1 AND user_id = $2
         RETURNING id`,
        [orgId, targetUid],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      // Log the action
      await query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'user.remove', 'organization', orgId, `Removed user ${targetUid} from organization`],
      );

      res.json({ deleted: true, userId: targetUid });
    } catch (err) {
      console.error('Remove member error:', err);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  },
);

export { router as organizationsRouter };
