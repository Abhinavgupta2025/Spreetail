import { Response, NextFunction } from 'express';
import { query } from '../db';
import { AuthRequest } from '../types';

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: expenseId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Verify if user is member of the group containing this expense
    const memberCheck = await query(
      `SELECT gm.id 
       FROM group_members gm
       JOIN expenses e ON gm.group_id = e.group_id
       WHERE e.id = $1 AND gm.user_id = $2`,
      [expenseId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of the group containing this expense.' });
    }

    // 2. Fetch messages
    const result = await query(
      `SELECT m.id, m.expense_id as "expenseId", m.sender_id as "senderId", m.content, m.created_at as "createdAt",
              u.name as "senderName", u.email as "senderEmail", u.avatar_url as "senderAvatarUrl"
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.expense_id = $1
       ORDER BY m.created_at ASC`,
      [expenseId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function postMessage(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: expenseId } = req.params;
  const { content } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    // 1. Verify membership
    const memberCheck = await query(
      `SELECT gm.id 
       FROM group_members gm
       JOIN expenses e ON gm.group_id = e.group_id
       WHERE e.id = $1 AND gm.user_id = $2`,
      [expenseId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of the group containing this expense.' });
    }

    // 2. Insert message
    const insertRes = await query(
      `INSERT INTO messages (expense_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, expense_id as "expenseId", sender_id as "senderId", content, created_at as "createdAt"`,
      [expenseId, userId, content]
    );

    const message = insertRes.rows[0];

    // Fetch user details for reply payload
    const userRes = await query(
      `SELECT name, email, avatar_url as "avatarUrl" FROM users WHERE id = $1`,
      [userId]
    );
    const sender = userRes.rows[0];

    res.status(201).json({
      ...message,
      senderName: sender.name,
      senderEmail: sender.email,
      senderAvatarUrl: sender.avatarUrl,
    });
  } catch (err) {
    next(err);
  }
}
