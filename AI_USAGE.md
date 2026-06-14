# AI_USAGE.md: AI Collaboration Log

This document lists the AI tools used, key prompts, and three concrete cases where the AI made a mistake, how it was identified, and the corrections implemented.

---

## 1. AI Tools & Key Prompts

* **AI Tool**: Antigravity (Google DeepMind Advanced Agentic Coding Assistant).
* **Key Prompts**:
  - *"integrate the razorpay"* - Used to create backend orders controller, verification handler, frontend Zustand actions, and checkout modals.
  - *"start commiting aagain after 4 minutes"* - Used to push local commits and resume background git-spacing script.
  - *"Ingesting CSV and Resolving Anomalies"* - Used to implement CSV parsing, anomaly previews, interactive resolved fields, and SQL database transactions.

---

## 2. Concrete Cases of AI Corrections

### Case 1: Case-Sensitive Guest Participant Check Bug
* **What the AI did**: In `import.controller.ts`, the AI attempted to exclude Kabir using a case-sensitive search:
  ```typescript
  if (splitWith.includes('Dev\'s friend Kabir') || splitWith.includes('Kabir')) { ... }
  ```
* **How it was caught**: Running the integration test showed that a user named `Dev's friend kabir` was still created in the database and carried a balance. This happened because the parser normalized names to lowercase (`Dev's friend kabir`), causing the case-sensitive `includes()` to return `false`.
* **What was changed**: Replaced the check with a case-insensitive locator:
  ```typescript
  const hasKabir = splitWith.some(name => name.toLowerCase().includes('kabir'));
  if (hasKabir) {
    splitWith = splitWith.filter(name => !name.toLowerCase().includes('kabir'));
    ...
  }
  ```

---

### Case 2: Incorrect Row Index Mapping in Validation Script
* **What the AI did**: In the validation script `test_import.js`, the AI attempted to resolve the missing payer for Row 13 (line 13 in the spreadsheet: "House cleaning supplies") by checking:
  ```javascript
  if (row.rowIndex === 13) { row.targetPayer = 'Aisha'; }
  ```
* **How it was caught**: The integration test run output showed that Row 12 ("House cleaning supplies") was still missing a payer, while Row 13 ("Rohan paid Aisha back" settlement) was updated to have Aisha pay Aisha back. This occurred because row indices are 1-based starting from index 1 (line 2 of the CSV), so line 13 corresponds to index 12.
* **What was changed**: Corrected the index target in the test script to:
  ```javascript
  if (row.rowIndex === 12) {
    row.targetPayer = 'Aisha';
  }
  ```

---

### Case 3: Strict TypeScript Compilation Failure due to Unused Imports
* **What the AI did**: While writing the `ImportPage.tsx` component, the AI imported several icons (`HelpCircle`, `Play`, `Check`, `RefreshCw`, `Info`) from `lucide-react` and the `Avatar` component, but did not use them in the final JSX code.
* **How it was caught**: Running `npm run build` in the frontend failed with compilation errors, as the project's strict TypeScript compiler (under `tsc -b`) flags unused variables as errors.
* **What was changed**: Removed the unused imports and clean-compiled the project.
