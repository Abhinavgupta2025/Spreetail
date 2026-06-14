import { Request } from 'express';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  avatar_url?: string | null;
  created_at: Date;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  created_by: string;
  created_at: Date;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: Date;
}

export interface Expense {
  id: string;
  group_id: string;
  title: string;
  total_amount: number;
  paid_by: string;
  split_type: 'equal' | 'unequal' | 'percentage' | 'share';
  date: Date | string;
  category?: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  owed_amount: number;
  raw_value?: number | null;
  created_at: Date;
}

export interface Settlement {
  id: string;
  group_id: string;
  paid_by: string;
  paid_to: string;
  amount: number;
  note?: string | null;
  settled_at: Date;
}

export interface Message {
  id: string;
  expense_id: string;
  sender_id: string;
  content: string;
  created_at: Date;
}

export interface ActivityLog {
  id: string;
  group_id: string;
  actor_id: string;
  action: string;
  metadata?: any | null;
  created_at: Date;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

