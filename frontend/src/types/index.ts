export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  createdBy: string;
  createdAt: string;
  currentUserRole?: 'admin' | 'member';
  members?: GroupMemberDetails[];
}

export interface GroupMemberDetails {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  totalAmount: number;
  paidBy: string;
  splitType: 'equal' | 'unequal' | 'percentage' | 'share';
  date: string;
  category?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  payerName?: string;
  creatorName?: string;
  splits?: ExpenseSplitDetails[];
}

export interface ExpenseSplitDetails {
  id: string;
  userId: string;
  owedAmount: number;
  rawValue?: number | null;
  name?: string;
  email?: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  paidBy: string;
  paidTo: string;
  amount: number;
  note?: string | null;
  settledAt: string;
  payerName?: string;
  receiverName?: string;
}

export interface Message {
  id: string;
  expenseId: string;
  senderId: string;
  content: string;
  createdAt: string;
  senderName?: string;
  senderEmail?: string;
  senderAvatarUrl?: string | null;
}

export interface ActivityLog {
  id: string;
  groupId: string;
  actorId: string;
  action: string;
  metadata?: any | null;
  createdAt: string;
}

export interface SimplifiedBalance {
  fromUserId: string;
  toUserId: string;
  amount: number;
  fromUser: User;
  toUser: User;
}

export interface GroupBalanceSummary {
  groupId: string;
  groupName: string;
  netBalance: number;
  owes: { userId: string; name: string; amount: number }[];
  owedBy: { userId: string; name: string; amount: number }[];
}

export interface UserBalanceSummary {
  netBalance: number;
  totalOwe: number;
  totalOwedToUs: number;
  groupBalances: GroupBalanceSummary[];
}
