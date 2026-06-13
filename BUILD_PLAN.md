# BUILD_PLAN.md

This document outlines the product research, system architecture, AI collaboration history, and engineering tradeoffs for the Splitwise Clone project, built as part of the Spreetail evaluation.

---

## 1. Product Research

### Study of Splitwise
Through studying Splitwise's core product behavior, we identified several defining pillars of the application:
1. **The Ledger:** A simple, high-density ledger displaying transactions, settlements, and activity.
2. **Dynamic Splitting:** Splitting bills is not always 50/50. Real-world scenarios require splitting unequally (exact cash shares), by percentages, or arbitrary share ratios.
3. **Debt Simplification:** The core value proposition of Splitwise is minimizing physical transactions. If Alice owes Bob $10 and Bob owes Charlie $10, Bob shouldn't have to pay. Alice should pay Charlie $10 directly.
4. **Contextual Chat:** Expenses are conversational. Users often need to discuss specific bills ("Why is the internet bill higher this month?") directly inside the expense context.

### Identified Workflows
- **Onboarding:** Immediate access with low friction (name, email, password).
- **Group Lifecycle:** Creating a group, inviting members by email, removing members (only if settled), and deleting groups.
- **Expense Lifecycle:** Creating an expense, defining splitting weights, real-time discussion, updating details, and deletion.
- **Settlement Lifecycle:** Checking net balances, selecting a member to pay, recording a payment (full or partial), and updating the ledger.

### Product Assumptions
- **Single Currency:** To meet the 2-day delivery constraint, all transactions assume a single base currency (e.g. INR/USD).
- **Instant Invites:** Users invited to groups who are already registered are added instantly. If they do not exist, their membership is pending and automatically bound when they sign up with that email.
- **Immediate Settlements:** Payments are recorded manually as "cash" settlements. No actual bank transfers or external API integrations are performed.

---

## 2. Architecture

### Tech Stack
- **Frontend:** React + Vite (Single Page Application) with Stitch UI for clean, consistent interface elements.
- **Backend:** Express.js + Node.js with TypeScript for type-safe models, controllers, and APIs.
- **Database:** PostgreSQL (Relational Database) for transactional safety, foreign key constraints, and relational queries.
- **Real-time Engine:** Socket.io (WebSockets) for bi-directional real-time message broadcasting in expense chats.
- **Authentication:** JWT (JSON Web Tokens) passed in the `Authorization` header for session verification.

### Database Schema
Refer to [AI_CONTEXT.md](file:///Users/abhinavgupta/Desktop/SpreeTail/AI_CONTEXT.md#L95-L196) for detailed SQL table definitions.
- `users`: Standard user credentials.
- `groups`: Group metadata.
- `group_members`: M2M join table enforcing user-group membership and roles.
- `expenses`: Individual ledger entries.
- `expense_splits`: Record of who owes how much for each expense.
- `settlements`: Record of payments between users.
- `messages`: Chat logs tied to specific expenses.
- `activity_log`: Audit trail for group actions.

### API Design
Refer to [AI_CONTEXT.md](file:///Users/abhinavgupta/Desktop/SpreeTail/AI_CONTEXT.md#L200-L252) for REST endpoints. All endpoints under `/api/*` are guarded by JWT middleware, except `/api/auth/register` and `/api/auth/login`.

### Frontend Structure
Refer to [AI_CONTEXT.md](file:///Users/abhinavgupta/Desktop/SpreeTail/AI_CONTEXT.md#L254-L316) for folder and page routing layouts. Zustand will be used for central state management (session, groups, current group expenses).

---

## 3. AI Collaboration Process

### Instructions & Prompts
The project began by feeding the initial prompt specified in the assignment into the AI agent. The agent was instructed to act as a junior engineer, not assume requirements, and ask detailed questions across product and technical segments before coding.

### Question/Answer Evolution
- **Initial Phase:** The AI agent initialized the `implementation_plan.md` and raised the first section of questions regarding product goals, scale, and design tools.
- **Context Finalization:** The user answered by directly modifying and committing the complete `AI_CONTEXT.md` file, which mapped out the exact database schema, file structure, API endpoints, testing plan, and tradeoffs. This locked in the project context.
- **Current State:** The AI agent reviewed the schema, fixed headings in `AI_CONTEXT.md`, and is generating this `BUILD_PLAN.md` to formalize the roadmap before executing the code generation phase.

---

## 4. Tradeoffs & Limitations

### Simplifications
- **No Automated Test Suite:** We rely on manual checklist testing to save dev time and deliver within the 2-day timeline.
- **Local Storage JWT:** Storing JWT in localStorage is simpler than setting up secure HttpOnly cookie logic, which is acceptable for an internship evaluation.
- **Raw SQL Migrations:** We avoid complex ORM layers like Prisma or TypeORM to keep DB queries simple, explicit, and performant.

### Hardcoded Elements
- **Preset Categories:** Expense categories (Food, Travel, Utilities, Others) are preset.
- **Single Currency:** The currency symbol is hardcoded (defaulting to ₹ or $ depending on user's region).

### Future Improvements (Given More Time)
- **Token Refresh Flow:** Implement JWT refresh tokens to avoid sudden session expirations.
- **Optimistic UI:** Implement optimistic updates in React for adding messages and expenses to make the app feel faster.
- **Automated Calculations Verification:** Add Jest test suites specifically for testing the debt simplification algorithm.
