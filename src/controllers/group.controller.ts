import { Response, NextFunction } from 'express';
import pool, { query } from '../db';
import { AuthRequest } from '../types';
import { computeGroupBalances } from '../services/balance.service';

export async function createGroup(req: AuthRequest, res: Response, next: NextFunction) {
  const { name, description, avatarUrl } = req.body;
  const creatorId = req.user?.id;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  if (!creatorId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await pool.connect();
  try {
    // Start Transaction
    await client.query('BEGIN');

    // 1. Insert Group
    const groupRes = await client.query(
      `INSERT INTO groups (name, description, avatar_url, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, avatar_url as "avatarUrl", created_by as "createdBy", created_at as "createdAt"`,
      [name, description || null, avatarUrl || null, creatorId]
    );
    const newGroup = groupRes.rows[0];

    // 2. Insert creator as Admin in group_members
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [newGroup.id, creatorId, 'admin']
    );

    // 3. Log Activity
    await client.query(
      `INSERT INTO activity_log (group_id, actor_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [newGroup.id, creatorId, 'group_created', JSON.stringify({ groupName: name })]
    );

    await client.query('COMMIT');
    res.status(201).json(newGroup);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}


export async function getGroups(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query(
      `SELECT g.id, g.name, g.description, g.avatar_url as "avatarUrl", g.created_by as "createdBy", g.created_at as "createdAt"
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1 AND gm.left_at IS NULL
       ORDER BY g.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function getGroup(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: groupId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Check if user is member of the group
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const userRole = memberCheck.rows[0].role;

    // 2. Fetch Group details
    const groupRes = await query(
      `SELECT id, name, description, avatar_url as "avatarUrl", created_by as "createdBy", created_at as "createdAt"
       FROM groups
       WHERE id = $1`,
      [groupId]
    );

    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = groupRes.rows[0];

    // 3. Fetch Group members details
    const membersRes = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url as "avatarUrl", gm.role, gm.joined_at as "joinedAt"
       FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.left_at IS NULL
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );

    res.json({
      ...group,
      currentUserRole: userRole,
      members: membersRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateGroup(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: groupId } = req.params;
  const { name, description, avatarUrl } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Check if user is admin
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // 2. Update group details
    const result = await query(
      `UPDATE groups
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4
       RETURNING id, name, description, avatar_url as "avatarUrl", created_by as "createdBy", created_at as "createdAt"`,
      [name, description, avatarUrl, groupId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // 3. Log activity
    await query(
      `INSERT INTO activity_log (group_id, actor_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [groupId, userId, 'group_updated', JSON.stringify({ name, description })]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deleteGroup(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: groupId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Check if user is admin
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // 2. Check for unsettled balances
    const balances = await computeGroupBalances(groupId);
    const hasUnsettled = balances.some((b) => b.amount > 0.009);

    if (hasUnsettled) {
      return res.status(400).json({ error: 'Cannot delete group. All balances must be settled first.' });
    }

    // 3. Delete group (foreign key CASCADE handles members, expenses, splits, settlements, etc.)
    const result = await query(`DELETE FROM groups WHERE id = $1 RETURNING id`, [groupId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ message: 'Group deleted successfully', id: groupId });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: groupId } = req.params;
  const { email } = req.body;
  const userId = req.user?.id;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Check if current user is a member of the group
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 2. Find or create user
    const normalizedEmail = email.toLowerCase().trim();
    let inviteeRes = await query(`SELECT id, name, email FROM users WHERE email = $1`, [normalizedEmail]);
    let inviteeId: string;
    let inviteeName: string;
    let isNewUser = false;

    if (inviteeRes.rows.length > 0) {
      inviteeId = inviteeRes.rows[0].id;
      inviteeName = inviteeRes.rows[0].name;
    } else {
      // Create a stub user
      const namePrefix = normalizedEmail.split('@')[0];
      const result = await query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name`,
        [namePrefix, normalizedEmail, 'PLACEHOLDER']
      );
      inviteeId = result.rows[0].id;
      inviteeName = result.rows[0].name;
      isNewUser = true;
    }

    // 3. Check if already a member
    const alreadyMember = await query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, inviteeId]
    );

    if (alreadyMember.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }

    // 4. Add to group_members
    await query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [groupId, inviteeId, 'member']
    );

    // 5. Log activity
    await query(
      `INSERT INTO activity_log (group_id, actor_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [groupId, userId, 'member_invited', JSON.stringify({ email: normalizedEmail, isNewUser, name: inviteeName })]
    );

    res.status(201).json({
      message: 'Member added successfully',
      member: {
        id: inviteeId,
        name: inviteeName,
        email: normalizedEmail,
        role: 'member',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: groupId, userId: memberId } = req.params;
  const actorId = req.user?.id;

  if (!actorId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Check if actor is group admin
    const actorCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, actorId]
    );

    if (actorCheck.rows.length === 0 || actorCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required to remove members.' });
    }

    // 2. Prevent removing the admin themselves unless they delete the group
    if (actorId === memberId) {
      return res.status(400).json({ error: 'Admins cannot remove themselves. Delete the group instead.' });
    }

    // 3. Check if member exists in group
    const memberCheck = await query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, memberId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in this group.' });
    }

    // 4. Check if member has unsettled balances
    const balances = await computeGroupBalances(groupId);
    const hasBalance = balances.some(
      (b) => (b.fromUserId === memberId || b.toUserId === memberId) && b.amount > 0.009
    );

    if (hasBalance) {
      return res.status(400).json({ error: 'Cannot remove member. Member has unsettled balances in this group.' });
    }

    // 5. Set left_at instead of deleting
    await query(`UPDATE group_members SET left_at = NOW() WHERE group_id = $1 AND user_id = $2`, [groupId, memberId]);

    // 6. Log activity
    await query(
      `INSERT INTO activity_log (group_id, actor_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [groupId, actorId, 'member_removed', JSON.stringify({ removedUserId: memberId })]
    );

    res.json({ message: 'Member removed successfully', userId: memberId });
  } catch (err) {
    next(err);
  }
}
