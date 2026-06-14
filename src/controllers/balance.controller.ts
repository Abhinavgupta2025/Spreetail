import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db';
import { computeGroupBalances, computeUserBalances } from '../services/balance.service';

export async function getGroupBalances(req: AuthRequest, res: Response, next: NextFunction) {
  const { groupId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Verify that user belongs to the group
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 2. Compute and return balances
    const balances = await computeGroupBalances(groupId);
    res.json(balances);
  } catch (err) {
    next(err);
  }
}

export async function getUserBalances(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const summary = await computeUserBalances(userId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}
