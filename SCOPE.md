# SCOPE.md: Anomaly Log & Database Schema

This document details the data anomalies detected in `expenses_export.csv` and the database schema designed to support Splitwise group membership and expense splits over time.

---

## 1. CSV Anomaly Log

Below is the list of 12+ deliberate data anomalies identified in the spreadsheet export and how our application's CSV Importer detects and resolves them.

| Row Range / Row | Anomaly Detected | Resolution Policy | Technical Handling |
| :--- | :--- | :--- | :--- |
| **All Rows** | Name inconsistency (e.g. `priya` in Row 9, `rohan ` in Row 27, `Priya S` in Row 11). | Normalize names to capitalized format, stripping whitespace and matching duplicates. | `normalizeName()` trims whitespace, maps known variations like `Priya S` -> `Priya` and capitalization. |
| **Row 7** | Comma-separated amount inside quotes (`"1,200"`). | Parse out quotes and commas before float parsing. | Replaced `"` and `,` characters inside string amount before converting. |
| **Row 10** | Unrealistic decimal precision (`899.995`). | Round total and split values to exactly 2 decimal places. | Applied `Math.round(amount * 100) / 100` in the backend. |
| **Row 13** | Missing Payer. | Flag as anomaly and allow user to select the payer in the preview UI before committing. | Importer preview marks row with `Missing Payer` anomaly; UI provides dropdown to resolve to `Aisha`. |
| **Row 14, 38** | Settlements/Deposits logged as Expenses (e.g. `Rohan paid Aisha back`, `Sam deposit share`). | Identify as financial transfers instead of split expenses; store as settlements. | Scanned descriptions for keywords (`paid back`, `deposit`) or empty split types. Directed to `settlements` table. |
| **Row 15, 32** | Percentages split sums to 110% (`30% + 30% + 30% + 20%`). | Detect percentage sum mismatch; scale shares proportionally to sum to 100%. | Normalization rescales individual shares by dividing each by `1.1` to ensure total is exactly 100%. |
| **Row 20, 21, 22, 25**| USD Transactions (e.g. Goa booking $540, shack lunch $84, parasailing $150). | Convert USD to INR using a standard fixed exchange rate. | Applied conversion rate of `1 USD = 83 INR`. |
| **Row 23** | Non-group member included in split (`Dev's friend Kabir`). | Re-attribute guest's split share to the hosting member. | Importer logic filters out guest names (case-insensitive check for `Kabir`) and assigns their split share to `Dev`. |
| **Row 25** | Duplicate Thalassa Dinner logging (Aisha logged ₹2,400, Rohan logged ₹2,450). | Detect candidate duplicates by key `(date + description + amount)` and flag them in the UI preview. | Importer matches key; UI marks row as duplicate and unchecks it by default, letting user choose which row wins. |
| **Row 26** | Negative amount (`-30 USD`). | Treat negative amount as a refund, reducing participants' balances. | Kept amount negative; split calculations naturally subtract from participants' debits. |
| **Row 31** | Zero-amount expense (`₹0`). | Skip zero-amount entries during ingestion. | Pre-excluded from default import check; backend skips zero-amount rows during database write. |
| **Row 34** | Ambiguous date (`04-05-2026`). | Warn the user of ambiguous date formats. | Added ambiguous date warning in the preview UI; parsed as May 4th. |
| **Row 36** | Out-of-bounds group member (`Meera` included in April split after moving out in March). | Validate participant eligibility based on date of expense; exclude former members. | Compared expense date against Meera's move-out date (`2026-03-31`); removed Meera and resplit among active members. |
| **Row 42** | Mismatched split type (type is `equal` but share details are provided). | Default split type to `equal` and ignore details. | Preview logged warning and performed equal split. |

---

## 2. Database Schema

We use **PostgreSQL** to maintain referential integrity. Group membership dynamics are modeled using `joined_at` and `left_at` columns.

```mermaid
erDiagram
    USERS {
        UUID id PK
        VARCHAR name
        VARCHAR email UNIQUE
        TEXT password_hash
        TEXT avatar_url
        TIMESTAMPTZ created_at
    }
    GROUPS {
        UUID id PK
        VARCHAR name
        TEXT description
        TEXT avatar_url
        UUID created_by FK
        TIMESTAMPTZ created_at
    }
    GROUP_MEMBERS {
        UUID id PK
        UUID group_id FK
        UUID user_id FK
        VARCHAR role
        TIMESTAMPTZ joined_at
        TIMESTAMPTZ left_at
    }
    EXPENSES {
        UUID id PK
        UUID group_id FK
        VARCHAR title
        NUMERIC total_amount
        UUID paid_by FK
        VARCHAR split_type
        DATE date
        VARCHAR category
        UUID created_by FK
        TIMESTAMPTZ created_at
    }
    EXPENSE_SPLITS {
        UUID id PK
        UUID expense_id FK
        UUID user_id FK
        NUMERIC owed_amount
        NUMERIC raw_value
    }
    SETTLEMENTS {
        UUID id PK
        UUID group_id FK
        UUID paid_by FK
        UUID paid_to FK
        NUMERIC amount
        TEXT note
        TIMESTAMPTZ settled_at
    }

    USERS ||--o{ GROUP_MEMBERS : member
    GROUPS ||--o{ GROUP_MEMBERS : has
    GROUPS ||--o{ EXPENSES : contains
    EXPENSES ||--o{ EXPENSE_SPLITS : splits
    USERS ||--o{ EXPENSE_SPLITS : owes
    GROUPS ||--o{ SETTLEMENTS : has
```

### Table Definitions DDL

```sql
-- 1. Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Groups Table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Group Members Join Table (Models Member Join/Leave history)
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- 'admin' | 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ DEFAULT NULL,  -- NULL = Active member
  UNIQUE(group_id, user_id)
);

-- 4. Expenses Table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  split_type VARCHAR(20) NOT NULL, -- 'equal' | 'unequal' | 'percentage' | 'share'
  date DATE NOT NULL,
  category VARCHAR(50),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Expense Splits Table
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  owed_amount NUMERIC(12, 2) NOT NULL, -- final computed INR amount
  raw_value NUMERIC(12, 2)             -- original raw share/pct/value
);

-- 6. Settlements Table
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES users(id) ON DELETE CASCADE,
  paid_to UUID REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  note TEXT,
  settled_at TIMESTAMPTZ DEFAULT NOW()
);
```
