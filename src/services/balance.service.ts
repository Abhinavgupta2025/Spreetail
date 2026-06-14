import { query } from '../db';

export interface SimplifiedBalance {
  fromUserId: string;
  toUserId: string;
  amount: number;
  fromUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  toUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
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

export async function computeGroupBalances(groupId: string): Promise<SimplifiedBalance[]> {
  // 1. Fetch all members of the group
  const membersRes = await query(
    `SELECT u.id, u.name, u.email, u.avatar_url as "avatarUrl"
     FROM users u
     JOIN group_members gm ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [groupId]
  );
  
  const members = membersRes.rows;
  const memberMap = new Map<string, any>();
  const netBalances: Record<string, number> = {};
  
  members.forEach((m) => {
    memberMap.set(m.id, m);
    netBalances[m.id] = 0;
  });

  // 2. Fetch all expenses in this group
  const expensesRes = await query(
    `SELECT e.id as expense_id, e.total_amount, e.paid_by, es.user_id, es.owed_amount
     FROM expenses e
     JOIN expense_splits es ON e.id = es.expense_id
     WHERE e.group_id = $1`,
    [groupId]
  );

  expensesRes.rows.forEach((row) => {
    const paidBy = row.paid_by;
    const participant = row.user_id;
    const totalAmount = parseFloat(row.total_amount);
    const owedAmount = parseFloat(row.owed_amount);

    // Credit the payer (we only add the total amount once per unique expense)
    // Wait, since the query returns one row per split, we will see multiple rows for the same expense.
    // So we should credit the payer only when we see the unique expense, or credit them based on each split?
    // Wait! Let's think:
    // If we credit the payer for each split's owed_amount, does that equal the total_amount?
    // Yes! The sum of all owed_amounts in expense_splits equals total_amount exactly.
    // So for each row:
    // Payer gets credited row.owed_amount.
    // Participant gets debited row.owed_amount.
    // Let's verify:
    // Alice paid 30. Splits: Alice owes 10, Bob owes 10, Charlie owes 10.
    // Row 1 (Alice split): payer = Alice, participant = Alice, amount = 10.
    //   Alice credit += 10. Alice debit += 10. (Net: 0)
    // Row 2 (Bob split): payer = Alice, participant = Bob, amount = 10.
    //   Alice credit += 10. Bob debit += 10. (Alice net: +10, Bob net: -10)
    // Row 3 (Charlie split): payer = Alice, participant = Charlie, amount = 10.
    //   Alice credit += 10. Charlie debit += 10. (Alice net: +20, Bob net: -10, Charlie net: -10)
    // Wow! This is mathematically identical, and doesn't require deduplicating expenses!
    // Let's double check if this is correct:
    // Credit = sum of splits where e.paid_by = user.
    // Debit = sum of splits where split.user_id = user.
    // Yes, this is 100% correct and extremely elegant!
    
    if (netBalances[paidBy] !== undefined) {
      netBalances[paidBy] += owedAmount;
    }
    if (netBalances[participant] !== undefined) {
      netBalances[participant] -= owedAmount;
    }
  });

  // 3. Fetch all settlements in this group
  const settlementsRes = await query(
    `SELECT paid_by, paid_to, amount
     FROM settlements
     WHERE group_id = $1`,
    [groupId]
  );

  settlementsRes.rows.forEach((row) => {
    const paidBy = row.paid_by;
    const paidTo = row.paid_to;
    const amount = parseFloat(row.amount);

    if (netBalances[paidBy] !== undefined) {
      netBalances[paidBy] += amount; // paid by debtor -> reduces debt (adds to balance)
    }
    if (netBalances[paidTo] !== undefined) {
      netBalances[paidTo] -= amount; // received by creditor -> reduces credit (subtracts from balance)
    }
  });

  // 4. Divide into debtors and creditors
  // We use objects to track id and balance
  let debtors = Object.keys(netBalances)
    .filter((id) => netBalances[id] < -0.009)
    .map((id) => ({ id, balance: netBalances[id] }));

  let creditors = Object.keys(netBalances)
    .filter((id) => netBalances[id] > 0.009)
    .map((id) => ({ id, balance: netBalances[id] }));

  const simplified: SimplifiedBalance[] = [];

  // 5. Greedy matching algorithm for debt simplification
  while (debtors.length > 0 && creditors.length > 0) {
    // Sort to get largest debtor and creditor
    debtors.sort((a, b) => a.balance - b.balance); // smallest (most negative) first
    creditors.sort((a, b) => b.balance - a.balance); // largest first

    const debtor = debtors[0];
    const creditor = creditors[0];

    const amountToSettle = Math.min(Math.abs(debtor.balance), creditor.balance);
    const roundedAmount = Math.round(amountToSettle * 100) / 100;

    if (roundedAmount > 0) {
      const fromUser = memberMap.get(debtor.id);
      const toUser = memberMap.get(creditor.id);

      simplified.push({
        fromUserId: debtor.id,
        toUserId: creditor.id,
        amount: roundedAmount,
        fromUser: {
          id: fromUser.id,
          name: fromUser.name,
          email: fromUser.email,
          avatarUrl: fromUser.avatarUrl,
        },
        toUser: {
          id: toUser.id,
          name: toUser.name,
          email: toUser.email,
          avatarUrl: toUser.avatarUrl,
        },
      });
    }

    debtor.balance += amountToSettle;
    creditor.balance -= amountToSettle;

    // Filter out settled users
    debtors = debtors.filter((d) => d.balance < -0.009);
    creditors = creditors.filter((c) => c.balance > 0.009);
  }

  return simplified;
}

export async function computeUserBalances(userId: string): Promise<UserBalanceSummary> {
  // 1. Find all groups this user belongs to
  const groupsRes = await query(
    `SELECT g.id, g.name
     FROM groups g
     JOIN group_members gm ON g.id = gm.group_id
     WHERE gm.user_id = $1`,
    [userId]
  );

  const groups = groupsRes.rows;
  let netBalance = 0;
  let totalOwe = 0;
  let totalOwedToUs = 0;
  const groupBalances: GroupBalanceSummary[] = [];

  for (const group of groups) {
    const balances = await computeGroupBalances(group.id);
    
    let groupNet = 0;
    const owes: { userId: string; name: string; amount: number }[] = [];
    const owedBy: { userId: string; name: string; amount: number }[] = [];

    balances.forEach((bal) => {
      if (bal.fromUserId === userId) {
        // User owes someone else in this group
        groupNet -= bal.amount;
        totalOwe += bal.amount;
        owes.push({
          userId: bal.toUserId,
          name: bal.toUser.name,
          amount: bal.amount,
        });
      } else if (bal.toUserId === userId) {
        // Someone owes user in this group
        groupNet += bal.amount;
        totalOwedToUs += bal.amount;
        owedBy.push({
          userId: bal.fromUserId,
          name: bal.fromUser.name,
          amount: bal.amount,
        });
      }
    });

    netBalance += groupNet;

    groupBalances.push({
      groupId: group.id,
      groupName: group.name,
      netBalance: Math.round(groupNet * 100) / 100,
      owes,
      owedBy,
    });
  }

  return {
    netBalance: Math.round(netBalance * 100) / 100,
    totalOwe: Math.round(totalOwe * 100) / 100,
    totalOwedToUs: Math.round(totalOwedToUs * 100) / 100,
    groupBalances,
  };
}
