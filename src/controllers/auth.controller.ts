import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { AuthRequest } from '../types';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';
const SALT_ROUNDS = 10;

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  const { name, email, password, avatarUrl } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    // Check if user already exists
    const existingUser = await query('SELECT id, password_hash FROM users WHERE email = $1', [normalizedEmail]);
    
    let user;

    if (existingUser.rows.length > 0) {
      const dbUser = existingUser.rows[0];
      if (dbUser.password_hash !== 'PLACEHOLDER') {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Claim the stub user!
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const updateRes = await query(
        `UPDATE users
         SET name = $1, password_hash = $2, avatar_url = $3
         WHERE id = $4
         RETURNING id, name, email, avatar_url as "avatarUrl", created_at as "createdAt"`,
        [name, passwordHash, avatarUrl || null, dbUser.id]
      );
      user = updateRes.rows[0];
    } else {
      // Create new user
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const insertRes = await query(
        `INSERT INTO users (name, email, password_hash, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, avatar_url as "avatarUrl", created_at as "createdAt"`,
        [name, normalizedEmail, passwordHash, avatarUrl || null]
      );
      user = insertRes.rows[0];
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
}


export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user
    const result = await query(
      `SELECT id, name, email, password_hash, avatar_url as "avatarUrl"
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });

    // Remove password hash from user details sent to client
    const { password_hash, ...userProfile } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userProfile,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query(
      `SELECT id, name, email, avatar_url as "avatarUrl", created_at as "createdAt"
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}
