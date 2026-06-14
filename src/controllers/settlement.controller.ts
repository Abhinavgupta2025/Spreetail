import { Response, NextFunction } from 'express';
import pool, { query } from '../db';
import { AuthRequest } from '../types';
// @ts-ignore
import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_placeholder',
});



export async function recordSettlement(req: AuthRequest, res: Response, next: NextFunction) {
  const { groupId } = req.params;
  const { paidTo, amount, note } = req.body;
  const paidBy = req.user?.id;

  if (!paidBy) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!paidTo || !amount) {
    return res.status(400).json({ error: 'Receiver user ID and amount are required' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid settlement amount' });
  }

  try {
    // 1. Verify membership of current user
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, paidBy]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // 2. Verify membership of receiver
    const receiverCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, paidTo]
    );
    if (receiverCheck.rows.length === 0) {
      return res.status(400).json({ error: 'The recipient is not a member of this group' });
    }

    // 3. Record the settlement in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO settlements (group_id, paid_by, paid_to, amount, note)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, group_id as "groupId", paid_by as "paidBy", paid_to as "paidTo", amount, note, settled_at as "settledAt"`,
        [groupId, paidBy, paidTo, parsedAmount, note || null]
      );
      const settlement = result.rows[0];

      // Log activity
      await client.query(
        `INSERT INTO activity_log (group_id, actor_id, action, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          groupId,
          paidBy,
          'settlement_recorded',
          JSON.stringify({ settlementId: settlement.id, paidBy, paidTo, amount: parsedAmount }),
        ]
      );

      await client.query('COMMIT');

      // Fetch user names for return payload
      const payerNameRes = await query(`SELECT name FROM users WHERE id = $1`, [paidBy]);
      const receiverNameRes = await query(`SELECT name FROM users WHERE id = $1`, [paidTo]);

      res.status(201).json({
        ...settlement,
        payerName: payerNameRes.rows[0].name,
        receiverName: receiverNameRes.rows[0].name,
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

export async function getSettlements(req: AuthRequest, res: Response, next: NextFunction) {
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

    // Query settlements
    const result = await query(
      `SELECT s.id, s.group_id as "groupId", s.paid_by as "paidBy", s.paid_to as "paidTo",
              s.amount, s.note, s.settled_at as "settledAt",
              u_payer.name as "payerName", u_receiver.name as "receiverName"
       FROM settlements s
       JOIN users u_payer ON s.paid_by = u_payer.id
       JOIN users u_receiver ON s.paid_to = u_receiver.id
       WHERE s.group_id = $1
       ORDER BY s.settled_at DESC`,
      [groupId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function createRazorpayOrder(req: AuthRequest, res: Response, next: NextFunction) {
  const { groupId } = req.params;
  const { amount } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid settlement amount' });
  }

  try {
    // Verify membership of current user
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    // Convert amount to paise (integer)
    const amountInPaise = Math.round(parsedAmount * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${groupId.slice(0, 8)}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key',
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyRazorpayPayment(req: AuthRequest, res: Response, next: NextFunction) {
  const { groupId } = req.params;
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, paidTo, amount, note } = req.body;
  const paidBy = req.user?.id;

  if (!paidBy) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !paidTo || !amount) {
    return res.status(400).json({ error: 'Missing payment details or recipient details' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid settlement amount' });
  }

  try {
    // 1. Verify signatures
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_placeholder';
    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }

    // 2. Verify group memberships
    const memberCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, paidBy]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const receiverCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, paidTo]
    );
    if (receiverCheck.rows.length === 0) {
      return res.status(400).json({ error: 'The recipient is not a member of this group' });
    }

    // 3. Record the settlement in a database transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO settlements (group_id, paid_by, paid_to, amount, note)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, group_id as "groupId", paid_by as "paidBy", paid_to as "paidTo", amount, note, settled_at as "settledAt"`,
        [groupId, paidBy, paidTo, parsedAmount, note || `Settled via Razorpay (ID: ${razorpayPaymentId})`]
      );
      const settlement = result.rows[0];

      // Log activity
      await client.query(
        `INSERT INTO activity_log (group_id, actor_id, action, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          groupId,
          paidBy,
          'settlement_recorded',
          JSON.stringify({
            settlementId: settlement.id,
            paidBy,
            paidTo,
            amount: parsedAmount,
            paymentMethod: 'razorpay',
            razorpayPaymentId,
          }),
        ]
      );

      await client.query('COMMIT');

      // Fetch user names for return payload
      const payerNameRes = await query(`SELECT name FROM users WHERE id = $1`, [paidBy]);
      const receiverNameRes = await query(`SELECT name FROM users WHERE id = $1`, [paidTo]);

      res.status(201).json({
        ...settlement,
        payerName: payerNameRes.rows[0].name,
        receiverName: receiverNameRes.rows[0].name,
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

