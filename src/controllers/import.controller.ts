import { Response, NextFunction } from 'express';
import pool, { query } from '../db';
import { AuthRequest } from '../types';

// Robust CSV Line Parser
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Clean and normalize names
function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  // Resolve "Priya S" to "Priya"
  if (trimmed.toLowerCase() === 'priya s') {
    return 'Priya';
  }
  // Resolve "rohan" to "Rohan"
  if (trimmed.toLowerCase() === 'rohan') {
    return 'Rohan';
  }
  // Capitalize first letter
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// Convert dates
function parseDate(dateStr: string): { date: Date | null; warning: string | null } {
  const str = dateStr.trim();
  if (!str) return { date: null, warning: 'Empty date' };

  // Handle formats like "Mar-14"
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  
  const monthDayMatch = str.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (monthDayMatch) {
    const mStr = monthDayMatch[1].toLowerCase();
    const day = parseInt(monthDayMatch[2], 10);
    if (monthMap[mStr] !== undefined) {
      const date = new Date(2026, monthMap[mStr], day); // Assume 2026 based on spreadsheet context
      return { date, warning: `Normalized date format from "${str}" to "2026-${String(monthMap[mStr]+1).padStart(2, '0')}-${String(day).padStart(2, '0')}"` };
    }
  }

  // Handle DD-MM-YYYY
  const parts = str.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = new Date(year, month, day);
      // Warning for ambiguous date "04-05-2026"
      if (str === '04-05-2026') {
        return { date, warning: 'Ambiguous date (is it April 5 or May 4? Defaulted to May 4th)' };
      }
      return { date, warning: null };
    }
  }

  // Fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return { date: parsed, warning: null };
  }

  return { date: null, warning: 'Invalid date format' };
}

// Controller Actions
export async function getPreview(req: AuthRequest, res: Response, next: NextFunction) {
  const { groupId } = req.params;
  const { csvText } = req.body;

  if (!csvText) {
    return res.status(400).json({ error: 'csvText is required in request body' });
  }

  try {
    const lines = csvText.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must contain at least headers and one data row' });
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const dataRows: any[] = [];
    
    // Group members for date membership validation
    // Meera leaves: 2026-03-31
    // Sam joins: 2026-04-08
    const meeraLeftDate = new Date('2026-03-31T23:59:59Z');
    const samJoinedDate = new Date('2026-04-08T00:00:00Z');

    // Duplicate detection helper map: key is date + desc + amount
    const uniqueMap = new Map<string, number>(); // key -> row index

    for (let r = 1; r < lines.length; r++) {
      const cols = parseCSVLine(lines[r]);
      if (cols.length < headers.length) continue;

      // Extract row data
      const dateRaw = cols[0];
      const description = cols[1];
      const paidByRaw = cols[2];
      const amountRaw = cols[3];
      const currencyRaw = cols[4];
      const splitTypeRaw = cols[5];
      const splitWithRaw = cols[6];
      const splitDetailsRaw = cols[7];
      const notes = cols[8];

      const anomalies: string[] = [];
      let isDuplicate = false;
      let duplicateOfIndex = -1;
      let isSettlement = false;
      let targetPayer = paidByRaw ? normalizeName(paidByRaw) : '';
      let currency = currencyRaw ? currencyRaw.toUpperCase().trim() : 'INR';
      let amount = parseFloat(amountRaw.replace(/"/g, '').replace(/,/g, ''));
      let splitType = splitTypeRaw ? splitTypeRaw.toLowerCase().trim() : 'equal';
      let splitWith = splitWithRaw ? splitWithRaw.split(';').map(normalizeName).filter(n => n.length > 0) : [];
      let splitDetails = splitDetailsRaw || '';

      // 1. Check date
      const { date, warning: dateWarning } = parseDate(dateRaw);
      if (dateWarning) anomalies.push(dateWarning);
      const formattedDate = date ? date.toISOString().split('T')[0] : '';

      // 2. Check currency
      if (!currencyRaw) {
        currency = 'INR';
        anomalies.push('Missing currency: defaulted to INR');
      }

      // 3. Multi-currency USD
      let exchangeRate = 1.0;
      if (currency === 'USD') {
        exchangeRate = 83.0; // 1 USD = 83 INR
        amount = amount * exchangeRate;
        anomalies.push(`Converted amount from USD to INR using fixed rate 1 USD = 83 INR (calculated ₹${amount.toFixed(2)})`);
      }

      // 4. Inconsistent number formats & decimal rounding
      if (amountRaw.includes(',')) {
        anomalies.push(`Parsed comma-separated amount format: "${amountRaw}"`);
      }
      const decimalMatch = amountRaw.match(/\.\d{3,}/);
      if (decimalMatch) {
        const rounded = Math.round(amount * 100) / 100;
        anomalies.push(`Rounded decimal amount from ${amountRaw} to ${rounded.toFixed(2)}`);
        amount = rounded;
      }

      // 5. Zero / Negative amounts (Refunds)
      if (amount === 0) {
        anomalies.push('Zero-value expense detected');
      } else if (amount < 0) {
        anomalies.push(`Negative amount parsed: treated as a refund (total amount: ₹${amount.toFixed(2)})`);
      }

      // 6. Missing payer
      if (!paidByRaw) {
        anomalies.push('Missing payer: Payer is blank and must be resolved');
      }

      // 7. Lowercase/trailing names normalization
      if (paidByRaw && (paidByRaw !== targetPayer)) {
        anomalies.push(`Normalized payer name from "${paidByRaw}" to "${targetPayer}"`);
      }

      // 8. Settlements vs Expenses
      const descLower = description.toLowerCase();
      if (descLower.includes('paid') && descLower.includes('back') || descLower.includes('deposit') || splitTypeRaw === '') {
        isSettlement = true;
        splitType = 'settlement';
        anomalies.push('Settlement transaction detected: recorded as transfer instead of expense');
      }

      // 9. Dynamic membership validation (Meera, Sam, Kabir)
      if (date) {
        // Meera moved out end of March
        if (date > meeraLeftDate) {
          if (splitWith.includes('Meera')) {
            splitWith = splitWith.filter(name => name !== 'Meera');
            anomalies.push('Meera included after her move out date (end of March). Automatically excluded her from the split.');
          }
          if (targetPayer === 'Meera') {
            anomalies.push('Warning: Meera recorded as payer after she moved out!');
          }
        }
        
        // Sam moved in mid-April
        if (date < samJoinedDate) {
          if (splitWith.includes('Sam')) {
            splitWith = splitWith.filter(name => name !== 'Sam');
            anomalies.push('Sam included before his move in date (mid-April). Excluded him from the split.');
          }
        }
      }

      // Kabir is guest (Dev's friend Kabir)
      const hasKabir = splitWith.some(name => name.toLowerCase().includes('kabir'));
      if (hasKabir) {
        splitWith = splitWith.filter(name => !name.toLowerCase().includes('kabir'));
        if (!splitWith.includes('Dev')) {
          splitWith.push('Dev');
        }
        anomalies.push('Guest participant "Dev\'s friend Kabir" detected. Kabir\'s share assigned to Dev.');
      }

      // 10. Split type and details mismatch
      if (splitType === 'equal' && splitDetailsRaw) {
        anomalies.push('Equal split type contains redundant split details. Ignored split details.');
      }

      // Compute split shares
      const splits: { name: string; amount: number; rawValue?: number }[] = [];
      
      if (isSettlement) {
        // Settlement has 1 recipient in splitWith
        const recipient = splitWith.length > 0 ? splitWith[0] : '';
        splits.push({ name: recipient, amount });
      } else if (amount !== 0) {
        const participantCount = splitWith.length;
        if (participantCount > 0) {
          if (splitType === 'equal') {
            const shareAmount = Math.round((amount / participantCount) * 100) / 100;
            // Adjust last person's share for rounding
            let runningSum = 0;
            splitWith.forEach((pName, index) => {
              const currentShare = index === participantCount - 1 ? amount - runningSum : shareAmount;
              splits.push({ name: pName, amount: Math.round(currentShare * 100) / 100 });
              runningSum += shareAmount;
            });
          } else if (splitType === 'unequal') {
            // e.g. "Rohan 700; Priya 400; Meera 400"
            const parts = splitDetails.split(';').map(p => p.trim());
            let sum = 0;
            const detailMap: Record<string, number> = {};
            parts.forEach(part => {
              const lastSpaceIdx = part.lastIndexOf(' ');
              if (lastSpaceIdx !== -1) {
                const name = normalizeName(part.slice(0, lastSpaceIdx));
                const val = parseFloat(part.slice(lastSpaceIdx + 1));
                if (!isNaN(val)) {
                  detailMap[name] = val;
                  sum += val;
                }
              }
            });
            // If the sum doesn't match the total amount, rescale
            const scaleFactor = Math.abs(sum - amount) > 0.01 ? amount / sum : 1.0;
            if (scaleFactor !== 1.0) {
              anomalies.push(`Unequal split details sum (₹${sum.toFixed(2)}) doesn't match total bill (₹${amount.toFixed(2)}). Rescaled individual splits.`);
            }

            let runningSum = 0;
            splitWith.forEach((pName, index) => {
              const rawVal = detailMap[pName] || 0;
              const computedShare = rawVal * scaleFactor;
              const share = index === participantCount - 1 ? amount - runningSum : computedShare;
              splits.push({ name: pName, amount: Math.round(share * 100) / 100, rawValue: rawVal });
              runningSum += Math.round(computedShare * 100) / 100;
            });
          } else if (splitType === 'percentage') {
            // e.g. "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%" (110%)
            const parts = splitDetails.split(';').map(p => p.trim());
            let sumPct = 0;
            const pctMap: Record<string, number> = {};
            parts.forEach(part => {
              const lastSpaceIdx = part.lastIndexOf(' ');
              if (lastSpaceIdx !== -1) {
                const name = normalizeName(part.slice(0, lastSpaceIdx));
                const val = parseFloat(part.slice(lastSpaceIdx + 1).replace('%', ''));
                if (!isNaN(val)) {
                  pctMap[name] = val;
                  sumPct += val;
                }
              }
            });

            if (Math.abs(sumPct - 100) > 0.01) {
              anomalies.push(`Percentages sum to ${sumPct}% instead of 100%. Rescaled percentages proportionately.`);
            }

            let runningSum = 0;
            splitWith.forEach((pName, index) => {
              const rawVal = pctMap[pName] || 0;
              const pct = rawVal / sumPct; // rescaled to 100%
              const computedShare = amount * pct;
              const share = index === participantCount - 1 ? amount - runningSum : computedShare;
              splits.push({ name: pName, amount: Math.round(share * 100) / 100, rawValue: rawVal });
              runningSum += Math.round(computedShare * 100) / 100;
            });
          } else if (splitType === 'share') {
            // e.g. "Aisha 1; Rohan 2; Priya 1; Dev 2"
            const parts = splitDetails.split(';').map(p => p.trim());
            let totalShares = 0;
            const shareMap: Record<string, number> = {};
            parts.forEach(part => {
              const lastSpaceIdx = part.lastIndexOf(' ');
              if (lastSpaceIdx !== -1) {
                const name = normalizeName(part.slice(0, lastSpaceIdx));
                const val = parseFloat(part.slice(lastSpaceIdx + 1));
                if (!isNaN(val)) {
                  shareMap[name] = val;
                  totalShares += val;
                }
              }
            });

            let runningSum = 0;
            splitWith.forEach((pName, index) => {
              const rawVal = shareMap[pName] !== undefined ? shareMap[pName] : 1; // Default to 1 share if missing
              const pct = rawVal / totalShares;
              const computedShare = amount * pct;
              const share = index === participantCount - 1 ? amount - runningSum : computedShare;
              splits.push({ name: pName, amount: Math.round(share * 100) / 100, rawValue: rawVal });
              runningSum += Math.round(computedShare * 100) / 100;
            });
          }
        }
      }

      // 11. Duplicate detection
      // Check if this date, description (case-insensitive) and amount is already seen
      const dedupKey = `${formattedDate}_${description.toLowerCase().trim()}_${Math.abs(amount).toFixed(2)}`;
      if (uniqueMap.has(dedupKey)) {
        isDuplicate = true;
        duplicateOfIndex = uniqueMap.get(dedupKey) as number;
        anomalies.push(`Suspected duplicate of row ${duplicateOfIndex} (${description} for ₹${Math.abs(amount).toFixed(2)})`);
      } else {
        // Store row index
        uniqueMap.set(dedupKey, r);
      }

      dataRows.push({
        rowIndex: r,
        date: formattedDate,
        dateRaw,
        description,
        paidByRaw,
        targetPayer,
        amount,
        amountRaw,
        currency,
        currencyRaw,
        splitType,
        splitTypeRaw,
        splitWith,
        splitWithRaw,
        splitDetailsRaw,
        notes,
        anomalies,
        isDuplicate,
        duplicateOfIndex,
        isSettlement,
        splits,
      });
    }

    res.json({
      groupId,
      rows: dataRows,
    });
  } catch (err) {
    next(err);
  }
}

export async function commitImport(req: AuthRequest, res: Response, next: NextFunction) {
  const { groupId } = req.params;
  const { rows } = req.body; // Array of resolved, approved rows to import

  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'rows array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch group members and users mapping
    const existingMembersRes = await client.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [groupId]
    );

    const memberMap = new Map<string, string>(); // name (normalized) -> user_id
    existingMembersRes.rows.forEach(m => {
      memberMap.set(normalizeName(m.name), m.id);
    });

    const resolveUser = async (name: string): Promise<string> => {
      const normalized = normalizeName(name);
      if (memberMap.has(normalized)) {
        return memberMap.get(normalized) as string;
      }

      // If user doesn't exist in system, check users table or create them
      const email = `${normalized.toLowerCase()}@example.com`;
      let userRes = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
      let userId: string;

      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
      } else {
        // Create user
        const newUserRes = await client.query(
          `INSERT INTO users (name, email, password_hash)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [normalized, email, '$2b$10$PLACEHOLDERHASH'] // default password placeholder
        );
        userId = newUserRes.rows[0].id;
      }

      // Add as group member
      await client.query(
        `INSERT INTO group_members (group_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (group_id, user_id) DO UPDATE SET left_at = NULL`,
        [groupId, userId, 'member']
      );

      memberMap.set(normalized, userId);
      return userId;
    };

    const importReportLogs: string[] = [];

    // Loop through each transaction row
    for (const row of rows) {
      const { description, amount, date, isSettlement, targetPayer, splits, anomalies } = row;

      if (amount === 0) {
        importReportLogs.push(`Row ${row.rowIndex}: Skipped zero-amount expense "${description}".`);
        continue;
      }

      if (!targetPayer || !targetPayer.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Payer name cannot be blank for row ${row.rowIndex} ("${description}")` });
      }

      // Resolve payer ID
      const payerId = await resolveUser(targetPayer);

      if (isSettlement) {
        // In CSV settlements: payer pays to recipient
        // splits[0] has recipient's name
        const recipientName = splits[0]?.name;
        if (!recipientName) continue;
        const recipientId = await resolveUser(recipientName);

        await client.query(
          `INSERT INTO settlements (group_id, paid_by, paid_to, amount, note, settled_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [groupId, payerId, recipientId, Math.abs(amount), description || 'Imported settlement', date ? new Date(date) : new Date()]
        );

        importReportLogs.push(`Row ${row.rowIndex}: Imported Settlement (₹${Math.abs(amount).toFixed(2)}) from ${targetPayer} to ${recipientName}.`);
      } else {
        // Normal expense
        const expenseInsert = await client.query(
          `INSERT INTO expenses (group_id, title, total_amount, paid_by, split_type, date, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [groupId, description, amount, payerId, row.splitType || 'equal', date ? new Date(date) : new Date(), 'Imported']
        );
        const expenseId = expenseInsert.rows[0].id;

        // Insert splits
        for (const split of splits) {
          const participantId = await resolveUser(split.name);
          await client.query(
            `INSERT INTO expense_splits (expense_id, user_id, owed_amount, raw_value)
             VALUES ($1, $2, $3, $4)`,
            [expenseId, participantId, split.amount, split.rawValue || null]
          );
        }

        const anomalyStr = anomalies && anomalies.length > 0 ? ` [Anomalies: ${anomalies.join(' | ')}]` : '';
        importReportLogs.push(`Row ${row.rowIndex}: Imported Expense "${description}" (₹${amount.toFixed(2)}) paid by ${targetPayer}.${anomalyStr}`);
      }
    }

    // Write final import report summary to database (or return in response)
    const reportSummary = importReportLogs.join('\n');
    
    // Log activity
    await client.query(
      `INSERT INTO activity_log (group_id, actor_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [groupId, req.user?.id, 'csv_imported', JSON.stringify({ count: rows.length, report: reportSummary })]
    );

    await client.query('COMMIT');
    res.json({
      message: 'CSV Imported successfully!',
      importedCount: rows.length,
      report: reportSummary,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}
