# DECISIONS.md: Engineering & Product Decision Log

This document records the key architectural, product, and engineering decisions made during the design and implementation of the Splitwise Clone application.

---

## 1. Database Choice: Relational Database (PostgreSQL on Neon)

* **Options Considered**: PostgreSQL (Relational) vs MongoDB (NoSQL).
* **Decision**: Selected **PostgreSQL** running on AWS Neon serverless cluster.
* **Rationale**:
  - **Data Integrity**: Financial ledgers and debt settlement models demand ACID compliance and strict schema validation.
  - **Foreign Key Constraints**: Using relational tables allows mapping links between `expenses`, `expense_splits`, `group_members`, and `settlements` with cascading rules.
  - **Transactions**: Implementing CSV import requires committing 40+ expenses/settlements atomically. Relational database transactions (`BEGIN` / `COMMIT` / `ROLLBACK`) ensure that if any row fails, the entire import rolls back safely with no partial writes.

---

## 2. Dynamic Group Membership & Roster History

* **Options Considered**:
  1. Delete group member rows on removal (`DELETE FROM group_members`).
  2. Maintain a `left_at` timestamp column to soft-delete group members.
* **Decision**: Option 2 (**Maintain `left_at` timestamp column**).
* **Rationale**:
  - Physical deletion would trigger foreign key cascades that delete the member's historical expense splits, erasing the ledger history.
  - Using `left_at` preserves the member join/leave timeline. Former members (like Meera, who left in March) are kept in historical balance computations so past calculations sum to zero, but they are excluded from April/May splits and active group rosters.

---

## 3. Exchange Rate Handling for USD Transactions

* **Options Considered**:
  1. Retrieve live exchange rates via a third-party currency API.
  2. Use a fixed historical exchange rate.
* **Decision**: Option 2 (**Fixed exchange rate of 1 USD = 83 INR**).
* **Rationale**:
  - The spreadsheet transactions took place between February and May 2026. A live API lookup today would fetch current rates rather than the historical rates active at the time of the transaction.
  - A fixed rate of `1 USD = 83 INR` is highly reflective of the early 2026 exchange rate and ensures deterministic, repeatable balance calculations during evaluations.

---

## 4. Re-Attributing Guest Participant Shares (Kabir's Share -> Dev)

* **Options Considered**:
  1. Create `Dev's friend Kabir` as a full group member.
  2. Re-attribute Kabir's share to his host, Dev.
* **Decision**: Option 2 (**Attribute Kabir's share to Dev**).
* **Rationale**:
  - Kabir was a temporary guest joining for a single day of parasailing. Creating a full system account for a guest bloats the group roster and complicates future balance settlement.
  - Attributing the guest's share to the host (Dev) matches real-life split dynamics where hosts pay for their guests and settle with them privately.

---

## 5. Rescaling Percentages Mismatches

* **Options Considered**:
  1. Throw an error and fail the row import.
  2. Rescale the split shares proportionally to sum to 100%.
* **Decision**: Option 2 (**Rescale splits proportionally**).
* **Rationale**:
  - Throwing an error stops the import flow. Rescaling allows correcting Pizza Friday and Weekend Brunch (which sum to 110% in the sheet) mathematically by dividing each percentage by `1.1` (total sum / 100).
  - This preserves the relative split weight between Aisha (30/110), Rohan (30/110), Priya (30/110), and Meera (20/110) while ensuring the total matches the bill amount.

---

## 6. Identifying Settlements vs Expenses

* **Options Considered**:
  1. Import all CSV rows as expenses.
  2. Parse and record repayments (e.g. `Rohan paid Aisha back` and `Sam deposit share`) directly into the `settlements` table.
* **Decision**: Option 2 (**Import repayments into the settlements table**).
* **Rationale**:
  - Settlements are debt repayments, not shared consumption. Recording them as expenses would inflate the group's total spending and distort ledger balances.
  - Recording them directly as settlements decrements the debtor's balance and credits the creditor, maintaining a correct net balance.
