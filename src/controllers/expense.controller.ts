import { Response, NextFunction } from 'express';
import pool, { query } from '../db';
import { AuthRequest } from '../types';
import { computeSplits } from '../services/split.service';

export async function createExpense(req: AuthRequest, res: Response, next: NextFunction) {
  const { groupId } = req.params;
  const { title, totalAmount, paidBy, splitType, date, category, participants, rawValues } = req.body;
  const creatorId = req.user?.id;

  if (!creatorId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!title || !totalAmount || !paidBy || !splitType || !date || !participants || participants.length === 0) {
    return res.status(400).json({ error: 'Missing required expense fields' });
  }

  const parsedAmount = parseFloat(totalAmount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid total amount' });
  }

  try {
    // 1. Check if current user is member of the group
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, creatorId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 2. Check if all participants are group members
    const participantCountCheck = await query(
      `SELECT COUNT(id) FROM group_members WHERE group_id = $1 AND user_id = ANY($2::uuid[])`,
      [groupId, participants]
    );
    if (parseInt(participantCountCheck.rows[0].count) !== participants.length) {
      return res.status(400).json({ error: 'Some split participants are not members of the group' });
    }

    // 3. Check if paidBy is a group member
    const paidByCheck = await query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, paidBy]
    );
    if (paidByCheck.rows.length === 0) {
      return res.status(400).json({ error: 'The payer is not a member of this group' });
    }

    // 4. Compute splits using the split service
    let splits;
    try {
      splits = computeSplits(parsedAmount, splitType, participants, rawValues || {});
    } catch (splitError: any) {
      return res.status(400).json({ error: splitError.message });
    }

    // 5. Save in DB inside a Transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert Expense
      const expenseRes = await client.query(
        `INSERT INTO expenses (group_id, title, total_amount, paid_by, split_type, date, category, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, title, total_amount as "totalAmount", paid_by as "paidBy", split_type as "splitType", date, category, created_by as "createdBy", created_at as "createdAt"`,
        [groupId, title, parsedAmount, paidBy, splitType, date, category || null, creatorId]
      );
      const newExpense = expenseRes.rows[0];

      // Insert splits
      const splitInsertPromises = splits.map((s) => {
        return client.query(
          `INSERT INTO expense_splits (expense_id, user_id, owed_amount, raw_value)
           VALUES ($1, $2, $3, $4)
           RETURNING id, user_id as "userId", owed_amount as "owedAmount", raw_value as "rawValue"`,
          [newExpense.id, s.userId, s.owedAmount, s.rawValue]
        );
      });

      const splitResults = await Promise.all(splitInsertPromises);
      const savedSplits = splitResults.map((r) => r.rows[0]);

      // Log activity
      await client.query(
        `INSERT INTO activity_log (group_id, actor_id, action, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          groupId,
          creatorId,
          'expense_added',
          JSON.stringify({ expenseId: newExpense.id, title, totalAmount: parsedAmount }),
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        ...newExpense,
        splits: savedSplits,
      });
    } catch (transactionErr) {
      await client.query('ROLLBACK');
      throw transactionErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

export async function getExpenses(req: AuthRequest, res: Response, next: NextFunction) {
  const { groupId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check membership
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // List expenses
    const expensesRes = await query(
      `SELECT e.id, e.title, e.total_amount as "totalAmount", e.paid_by as "paidBy",
              e.split_type as "splitType", e.date, e.category, e.created_by as "createdBy",
              e.created_at as "createdAt", e.updated_at as "updatedAt",
              u_payer.name as "payerName", u_creator.name as "creatorName"
       FROM expenses e
       JOIN users u_payer ON e.paid_by = u_payer.id
       JOIN users u_creator ON e.created_by = u_creator.id
       WHERE e.group_id = $1
       ORDER BY e.date DESC, e.created_at DESC`,
      [groupId]
    );

    res.json(expensesRes.rows);
  } catch (err) {
    next(err);
  }
}

export async function getExpense(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: expenseId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Fetch expense details
    const expenseRes = await query(
      `SELECT e.id, e.group_id as "groupId", e.title, e.total_amount as "totalAmount", e.paid_by as "paidBy",
              e.split_type as "splitType", e.date, e.category, e.created_by as "createdBy",
              e.created_at as "createdAt", e.updated_at as "updatedAt",
              u_payer.name as "payerName", u_creator.name as "creatorName"
       FROM expenses e
       JOIN users u_payer ON e.paid_by = u_payer.id
       JOIN users u_creator ON e.created_by = u_creator.id
       WHERE e.id = $1`,
      [expenseId]
    );

    if (expenseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = expenseRes.rows[0];

    // 2. Check user group membership
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [expense.groupId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 3. Fetch splits
    const splitsRes = await query(
      `SELECT es.id, es.user_id as "userId", es.owed_amount as "owedAmount", es.raw_value as "rawValue", u.name, u.email
       FROM expense_splits es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = $1`,
      [expenseId]
    );

    res.json({
      ...expense,
      splits: splitsRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: expenseId } = req.params;
  const { title, totalAmount, paidBy, splitType, date, category, participants, rawValues } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!title || !totalAmount || !paidBy || !splitType || !date || !participants || participants.length === 0) {
    return res.status(400).json({ error: 'Missing required expense fields' });
  }

  const parsedAmount = parseFloat(totalAmount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid total amount' });
  }

  try {
    // 1. Fetch current expense to get group ID
    const expenseRes = await query(`SELECT group_id FROM expenses WHERE id = $1`, [expenseId]);
    if (expenseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    const groupId = expenseRes.rows[0].group_id;

    // 2. Check if user is member of the group
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 3. Check if paidBy is group member
    const paidByCheck = await query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, paidBy]
    );
    if (paidByCheck.rows.length === 0) {
      return res.status(400).json({ error: 'The payer is not a member of this group' });
    }

    // 4. Compute splits using the split service
    let splits;
    try {
      splits = computeSplits(parsedAmount, splitType, participants, rawValues || {});
    } catch (splitError: any) {
      return res.status(400).json({ error: splitError.message });
    }

    // 5. Update inside transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update expense record
      const updateRes = await client.query(
        `UPDATE expenses
         SET title = $1, total_amount = $2, paid_by = $3, split_type = $4, date = $5, category = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING id, title, total_amount as "totalAmount", paid_by as "paidBy", split_type as "splitType", date, category, created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"`,
        [title, parsedAmount, paidBy, splitType, date, category || null, expenseId]
      );
      const updatedExpense = updateRes.rows[0];

      // Delete old splits
      await client.query(`DELETE FROM expense_splits WHERE expense_id = $1`, [expenseId]);

      // Insert new splits
      const splitInsertPromises = splits.map((s) => {
        return client.query(
          `INSERT INTO expense_splits (expense_id, user_id, owed_amount, raw_value)
           VALUES ($1, $2, $3, $4)
           RETURNING id, user_id as "userId", owed_amount as "owedAmount", raw_value as "rawValue"`,
          [expenseId, s.userId, s.owedAmount, s.rawValue]
        );
      });

      const splitResults = await Promise.all(splitInsertPromises);
      const savedSplits = splitResults.map((r) => r.rows[0]);

      // Log activity
      await client.query(
        `INSERT INTO activity_log (group_id, actor_id, action, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          groupId,
          userId,
          'expense_updated',
          JSON.stringify({ expenseId, title, totalAmount: parsedAmount }),
        ]
      );

      await client.query('COMMIT');

      res.json({
        ...updatedExpense,
        splits: savedSplits,
      });
    } catch (transactionErr) {
      await client.query('ROLLBACK');
      throw transactionErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req: AuthRequest, res: Response, next: NextFunction) {
  const { id: expenseId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Fetch current expense details
    const expenseRes = await query(`SELECT group_id, title FROM expenses WHERE id = $1`, [expenseId]);
    if (expenseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    const { group_id: groupId, title } = expenseRes.rows[0];

    // 2. Check if user is member of the group
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 3. Delete expense (cascade takes care of splits and messages)
    await query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);

    // 4. Log activity
    await query(
      `INSERT INTO activity_log (group_id, actor_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [groupId, userId, 'expense_deleted', JSON.stringify({ expenseId, title })]
    );

    res.json({ message: 'Expense deleted successfully', id: expenseId });
  } catch (err) {
    next(err);
  }
}
