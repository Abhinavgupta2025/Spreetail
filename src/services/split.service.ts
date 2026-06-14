export interface SplitResult {
  userId: string;
  owedAmount: number;
  rawValue: number;
}

export function computeSplits(
  totalAmount: number,
  splitType: 'equal' | 'unequal' | 'percentage' | 'share',
  participants: string[],
  rawValues: Record<string, number>
): SplitResult[] {
  if (participants.length === 0) {
    throw new Error('Expense must have at least one participant');
  }

  if (totalAmount <= 0) {
    throw new Error('Expense amount must be greater than zero');
  }

  const results: SplitResult[] = [];

  switch (splitType) {
    case 'equal': {
      const share = totalAmount / participants.length;
      let roundedShare = Math.round(share * 100) / 100;
      
      // Calculate running sum and adjust for rounding errors
      let runningSum = 0;
      participants.forEach((userId, index) => {
        if (index === participants.length - 1) {
          // Last participant gets the remainder to ensure exact sum match
          const finalAmount = Math.round((totalAmount - runningSum) * 100) / 100;
          results.push({
            userId,
            owedAmount: finalAmount,
            rawValue: 0,
          });
        } else {
          results.push({
            userId,
            owedAmount: roundedShare,
            rawValue: 0,
          });
          runningSum += roundedShare;
        }
      });
      break;
    }

    case 'unequal': {
      let sum = 0;
      participants.forEach((userId) => {
        const val = rawValues[userId] || 0;
        sum += val;
        results.push({
          userId,
          owedAmount: Math.round(val * 100) / 100,
          rawValue: val,
        });
      });

      // Allow 0.01 tolerance for floating point representations
      if (Math.abs(sum - totalAmount) > 0.0101) {
        throw new Error(`Sum of split amounts (${sum.toFixed(2)}) must equal total amount (${totalAmount.toFixed(2)})`);
      }

      // Enforce exact total amount by adjusting any rounding difference on the first participant
      const computedSum = results.reduce((acc, r) => acc + r.owedAmount, 0);
      const diff = Math.round((totalAmount - computedSum) * 100) / 100;
      if (diff !== 0 && results.length > 0) {
        results[0].owedAmount = Math.round((results[0].owedAmount + diff) * 100) / 100;
      }
      break;
    }

    case 'percentage': {
      let sumPct = 0;
      participants.forEach((userId) => {
        const pct = rawValues[userId] || 0;
        sumPct += pct;
      });

      if (Math.abs(sumPct - 100) > 0.0101) {
        throw new Error(`Sum of percentages (${sumPct.toFixed(2)}%) must equal 100%`);
      }

      let runningSum = 0;
      participants.forEach((userId, index) => {
        const pct = rawValues[userId] || 0;
        if (index === participants.length - 1) {
          const finalAmount = Math.round((totalAmount - runningSum) * 100) / 100;
          results.push({
            userId,
            owedAmount: finalAmount,
            rawValue: pct,
          });
        } else {
          const owed = Math.round(((totalAmount * pct) / 100) * 100) / 100;
          results.push({
            userId,
            owedAmount: owed,
            rawValue: pct,
          });
          runningSum += owed;
        }
      });
      break;
    }

    case 'share': {
      let totalShares = 0;
      participants.forEach((userId) => {
        const sh = rawValues[userId] || 0;
        if (sh < 0) {
          throw new Error('Shares cannot be negative');
        }
        totalShares += sh;
      });

      if (totalShares <= 0) {
        throw new Error('Total shares must be greater than zero');
      }

      let runningSum = 0;
      participants.forEach((userId, index) => {
        const sh = rawValues[userId] || 0;
        if (index === participants.length - 1) {
          const finalAmount = Math.round((totalAmount - runningSum) * 100) / 100;
          results.push({
            userId,
            owedAmount: finalAmount,
            rawValue: sh,
          });
        } else {
          const owed = Math.round(((totalAmount * sh) / totalShares) * 100) / 100;
          results.push({
            userId,
            owedAmount: owed,
            rawValue: sh,
          });
          runningSum += owed;
        }
      });
      break;
    }

    default:
      throw new Error(`Unsupported split type: ${splitType}`);
  }

  return results;
}
