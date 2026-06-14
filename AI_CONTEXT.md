# AI_CONTEXT.md

This file serves as the source of truth for the Splitwise Clone assignment built for the Spreetail internship evaluation. It contains the full product scope, architectural decisions, technical design, implementation logs, and tradeoffs.

---

## 1. Product Understanding & Goals

- **Objective:** Build a fully functional Splitwise clone that implements all assignment requirements — login, group management, expense splitting, real-time chat, balance summaries, and debt settlement.
- **Scale:** Designed for small-to-medium groups (up to 50 members per group, up to 500 expenses per group). Not optimized for millions of users — this is an MVP with production-ready patterns.
- **Frontend Design Tooling:** Stitch MCP used to generate and maintain consistent UI components and screens.
- **AI Collaborator:** Claude (Anthropic) used as primary development collaborator throughout the build.
- **Core Philosophy:** Every decision is driven by the assignment rubric — the evaluator should be able to rebuild this app from this file alone.

---

## 2. Product Scope & MVP Features

### In-Scope
- JWT-based authentication (register, login, logout)
- Group management: create group, invite users by email, remove members, delete group
- Expense management:
  - Add expense with title, amount, date, category, paid-by
  - Split equally, unequally, by percentage, by share
  - Edit and delete expenses
- Real-time chat per expense using Socket.io
- Group-wise balance summary (who owes whom within a group)
- Individual balance summary (across all groups)
- Debt simplification (net balances, not raw pairwise)
- Settle debts: record a payment between two users
- Activity feed per group (expense added, settled, member joined)

### Out-of-Scope
- Email verification / OTP flows
- Push notifications
- Mobile app
- Multiple currencies
- Recurring expenses
- Export to PDF/CSV
- OAuth (Google/GitHub login)
- In-app payments (Stripe etc.)
- Admin dashboard

---

## 3. User Personas

- **Primary User:** A college student or young professional who shares expenses with friends/roommates.
- **Group Admin:** The user who creates a group — can invite/remove members and delete the group.
- **Group Member:** Can add expenses, chat, view balances, and record settlements.

---

## 4. Core Workflows

### Auth Flow
1. User registers with name, email, password.
2. Password hashed with bcrypt, stored in DB.
3. On login, JWT issued (access token, 7-day expiry).
4. Token stored in localStorage on frontend.
5. All protected API routes require `Authorization: Bearer <token>` header.

### Group Flow
1. User creates a group (name, optional description, optional avatar).
2. Creator becomes group admin.
3. Admin invites users by email — if user exists, they are added directly. If not, invitation is stored and user is added on registration.
4. Admin can remove any member. Members can leave a group.
5. Group is deletable only by admin and only when all balances are settled.

### Expense Flow
1. Any group member adds an expense.
2. They fill: title, total amount, date, paid by (defaults to self, can select any member), split type.
3. Split types:
   - **Equal:** amount / n for each participant
   - **Unequal:** manually enter each person's share (must sum to total)
   - **Percentage:** enter % per person (must sum to 100)
   - **By Share:** enter share units per person (e.g. 2:1:1), system calculates amounts
4. Expense saved, balances updated.
5. Expense has a chat thread — any group member can post messages, updates appear in real-time via Socket.io.

### Balance Calculation
- Raw pairwise debts are computed from all expense splits.
- Debt simplification applied: net balances calculated so A→B and B→A cancel out.
- Result: minimum number of transactions to settle the group.
- Displayed as: "You owe Rahul ₹450" or "Priya owes you ₹200".

### Settlement Flow
1. User clicks "Settle Up" on a balance.
2. Selects amount (defaults to full balance, can be partial).
3. Records payment — creates a settlement record in DB.
4. Balances recalculated and updated.

---

## 5. Data Model (PostgreSQL Schema)

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### groups
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### group_members
```sql
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- 'admin' | 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);
```

### expenses
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  paid_by UUID REFERENCES users(id),
  split_type VARCHAR(20) NOT NULL, -- 'equal' | 'unequal' | 'percentage' | 'share'
  date DATE NOT NULL,
  category VARCHAR(50),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### expense_splits
```sql
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  owed_amount NUMERIC(12, 2) NOT NULL, -- final computed amount this user owes
  raw_value NUMERIC(12, 2),            -- percentage / share units / raw amount before computation
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### settlements
```sql
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES users(id),   -- who paid
  paid_to UUID REFERENCES users(id),   -- who received
  amount NUMERIC(12, 2) NOT NULL,
  note TEXT,
  settled_at TIMESTAMPTZ DEFAULT NOW()
);
```

### messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### activity_log
```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- 'expense_added', 'member_invited', 'settled', etc.
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. API Design (REST)

### Auth
POST   /api/auth/register       — register new user

POST   /api/auth/login          — login, returns JWT

GET    /api/auth/me             — get current user profile

### Users
GET    /api/users/search?email= — search user by email (for invite)

### Groups
GET    /api/groups              — list all groups for current user

POST   /api/groups              — create group

GET    /api/groups/:id          — get group details + members

PATCH  /api/groups/:id          — update group name/description

DELETE /api/groups/:id          — delete group (admin only)

POST   /api/groups/:id/members  — invite/add member by email

DELETE /api/groups/:id/members/:userId — remove member

### Expenses
GET    /api/groups/:id/expenses         — list expenses in group

POST   /api/groups/:id/expenses         — create expense

GET    /api/expenses/:id                — get expense detail + splits

PATCH  /api/expenses/:id                — edit expense

DELETE /api/expenses/:id                — delete expense

### Balances
GET    /api/groups/:id/balances         — group-wise balance summary

GET    /api/users/me/balances           — individual balance across all groups

### Settlements
POST   /api/groups/:id/settlements      — record a settlement

GET    /api/groups/:id/settlements      — list settlements in group

### Messages (REST fallback + Socket.io primary)
GET    /api/expenses/:id/messages       — fetch message history

POST   /api/expenses/:id/messages       — post message (fallback)

---

## 7. Frontend Structure
src/

├── api/                  # axios instance + API call functions

├── components/

│   ├── auth/             # LoginForm, RegisterForm

│   ├── groups/           # GroupCard, GroupList, GroupForm, MemberList

│   ├── expenses/         # ExpenseCard, ExpenseForm, SplitEditor, ExpenseDetail

│   ├── chat/             # ChatWindow, MessageBubble, ChatInput

│   ├── balances/         # BalanceSummary, BalanceCard, SettleUpModal

│   └── shared/           # Navbar, Sidebar, Avatar, Modal, Spinner, Toast

├── pages/

│   ├── AuthPage.tsx

│   ├── DashboardPage.tsx

│   ├── GroupPage.tsx

│   ├── ExpenseDetailPage.tsx

│   └── BalancePage.tsx

├── hooks/

│   ├── useAuth.ts

│   ├── useSocket.ts

│   └── useBalances.ts

├── store/                # Zustand global state (auth, groups, expenses)

├── types/                # TypeScript interfaces

├── utils/                # balance calculation, split computation helpers

└── App.tsx

### Routing
/                  → redirects to /dashboard (public landing page)

/login             → AuthPage (login tab) - supports ?redirect=create-group query param to automatically pop open modal post-login

/register          → AuthPage (register tab)

/dashboard         → DashboardPage (public landing page if unauthenticated, private user dashboard if authenticated)

/groups/:id        → GroupPage (protected; expenses list, members, group balances)

/expenses/:id      → ExpenseDetailPage (protected; splits + chat)

/balances          → BalancePage (protected; individual summary across groups)

/groups/:groupId/import → ImportPage (protected; CSV previews and anomaly resolution)

---

## 8. Backend Structure
src/

├── controllers/

│   ├── auth.controller.ts

│   ├── group.controller.ts

│   ├── expense.controller.ts

│   ├── balance.controller.ts

│   ├── settlement.controller.ts

│   └── message.controller.ts

├── middleware/

│   ├── auth.middleware.ts       # JWT verification

│   └── error.middleware.ts

├── routes/

│   ├── auth.routes.ts

│   ├── group.routes.ts

│   ├── expense.routes.ts

│   ├── balance.routes.ts

│   └── settlement.routes.ts

├── services/

│   ├── balance.service.ts       # debt simplification logic

│   ├── split.service.ts         # split computation logic

│   └── socket.service.ts        # Socket.io event handlers

├── db/

│   ├── index.ts                 # pg pool setup

│   └── migrations/              # raw SQL migration files

├── types/

│   └── index.ts

└── app.ts

---

## 9. Real-time (Socket.io)

- Client connects with JWT in handshake auth.
- On connecting to an expense chat: `socket.join(expense:<expense_id>)`
- Events:
  - `message:send` → server saves to DB, broadcasts `message:new` to room
  - `message:new` → received by all clients in room, rendered in chat
- Fallback: REST endpoint for initial message history load on page open.

---

## 10. Deployment Plan

| Layer | Platform |
|---|---|
| Frontend | Firebase Hosting (via Stitch MCP) |
+| Backend | Railway or Render (Node.js service) |
+| Database | Railway PostgreSQL or Supabase |
+| Environment | `.env` for DB URL, JWT secret, frontend API base URL |

- Frontend hits backend via `VITE_API_BASE_URL` env variable.
- CORS configured on backend to allow frontend origin only.
- Socket.io server runs on same Express instance.

---

## 11. Testing Plan

- Manual testing of all flows: auth, groups, expenses (all 4 split types), chat, balances, settlements.
- Edge cases tested:
  - Unequal splits that don't sum to total (validation error)
  - Percentage splits not summing to 100 (validation error)
  - Removing a member with unsettled balances (blocked with error message)
  - Deleting a group with unsettled balances (blocked)
  - User trying to access a group they're not a member of (403)
- No automated test suite in MVP (time constraint tradeoff).

---

## 12. Trade-offs & Known Limitations

| Decision | Tradeoff |
|---|---|
| No automated tests | Faster delivery; manual testing covers all flows |
| JWT in localStorage | Simpler than httpOnly cookies; acceptable for assignment scope |
| Debt simplification (net) | Slightly complex logic but far better UX than raw pairwise |
| No email verification | Reduces friction; out of scope for MVP |
| Migrations in raw SQL | Simple and explicit; no ORM overhead (Prisma/Knex avoided) |
| Single backend instance | No horizontal scaling; sufficient for evaluation |
| No pagination on expenses | Acceptable for small groups in MVP |

---

## 13. Balance Calculation Logic
For each expense:

payer gets credit of total_amount

each participant gets debit of their owed_amount
Net balance per user pair (A, B):

net = sum of all (A paid, B owes) - sum of all (B paid, A owes)

if net > 0: B owes A net amount

if net < 0: A owes B abs(net) amount
Settlements reduce the net balance between two users directly.

---

## 14. Changes During Implementation

*This section is updated continuously as the build progresses.*

| # | Change | Reason |
|---|---|---|
| 1 | Initial schema and API design locked | Post-interview context finalized |
| 2 | Database setup completed | Created 001_init.sql DDL migrations and db/index.ts connection pool |
| 3 | Backend foundation and routes completed | Built package.json, configs, and all routes/controllers/services/middleware |
| 4 | Frontend scaffolding and components completed | Setup React/Vite/TS, Zustand store, Axios client, Hooks, layout elements, and views |
| 5 | App documentation and final configurations | Created README.md, completed BUILD_PLAN.md, verified builds on both layers |
| 6 | Database Docker initialization & transaction fixes | Started Postgres in Docker, initialized migrations, and refactored backend controllers to checkout dedicated clients from the connection pool for database transactions to prevent pool separation bugs |


---

## 15. Known Risks

- Socket.io and Railway free tier may have cold start latency.
- JWT expiry not handled on frontend gracefully (TODO: refresh token or re-login prompt).
- Concurrent expense edits not handled (last-write-wins).Good. Phase 1 is complete. Continue with Phase 2 — Backend.

Build every file completely, one by one, in this exact order. Do not summarize or skip any file:

1. package.json — include all dependencies:
   express, cors, dotenv, pg, bcrypt, jsonwebtoken, socket.io, uuid
   devDependencies: typescript, ts-node, nodemon, @types/express, @types/pg, 
   @types/bcrypt, @types/jsonwebtoken, @types/cors, @types/node

2. tsconfig.json — target ES2020, module commonjs, outDir dist, rootDir src, strict true

3. .env.example:
   DATABASE_URL=
   JWT_SECRET=
   PORT=5000
   CLIENT_URL=

4. src/types/index.ts — interfaces for:
   User, Group, GroupMember, Expense, ExpenseSplit, Settlement, Message, ActivityLog
   Also: AuthRequest extending Express Request with user: { id: string, email: string }

5. src/db/index.ts — pg Pool from DATABASE_URL

6. src/services/split.service.ts — export function computeSplits():
   Takes (totalAmount, splitType, participants, rawValues)
   Returns array of { userId, owedAmount, rawValue }
   Handles: equal, unequal, percentage, share
   Throws validation error if splits don't sum correctly

7. src/services/balance.service.ts — export function computeGroupBalances(groupId):
   Queries all expense_splits and settlements for the group
   Computes net pairwise balances
   Returns array of { fromUserId, toUserId, amount, fromUser, toUser }
   Also export function computeUserBalances(userId) — across all groups

8. src/services/socket.service.ts — export function initSocket(server):
   Authenticate socket using JWT from handshake.auth.token
   On connection: socket.join("expense:" + expenseId) on event "join:expense"
   On "message:send": save message to DB, broadcast "message:new" to room
   On disconnect: cleanup

9. src/middleware/auth.middleware.ts — verify JWT, attach user to req, return 401 if invalid

10. src/middleware/error.middleware.ts — global error handler, return 500 with message

11. src/controllers/auth.controller.ts — register, login, getMe
    register: hash password with bcrypt(10), insert user, return JWT
    login: compare hash, return JWT
    getMe: return user from DB by req.user.id

12. src/routes/auth.routes.ts — POST /register, POST /login, GET /me (protected)

13. src/controllers/group.controller.ts — full CRUD:
    createGroup: insert group, insert creator as admin in group_members, log activity
    getGroups: select all groups where user is a member
    getGroup: group details + all members with user info
    updateGroup: patch name/description (admin only)
    deleteGroup: check no unsettled balances, delete (admin only)
    addMember: search user by email, add to group_members, log activity
    removeMember: remove from group_members, log activity

14. src/routes/group.routes.ts — all group routes (all protected)

15. src/controllers/expense.controller.ts:
    createExpense: validate input, call split.service, insert expense + splits, log activity
    getExpenses: list for group with creator name and payer name
    getExpense: detail with splits joined with user names
    updateExpense: delete old splits, recompute, insert new splits
    deleteExpense: delete expense (cascade handles splits)

16. src/routes/expense.routes.ts

17. src/controllers/balance.controller.ts:
    getGroupBalances: call balance.service.computeGroupBalances
    getUserBalances: call balance.service.computeUserBalances

18. src/routes/balance.routes.ts

19. src/controllers/settlement.controller.ts:
    recordSettlement: insert settlement, log activity
    getSettlements: list for group with user names

20. src/routes/settlement.routes.ts

21. src/controllers/message.controller.ts:
    getMessages: fetch all messages for expense with sender name
    postMessage: insert message (REST fallback)

22. src/routes/message.routes.ts (mounted under /api/expenses/:id/messages)

23. src/app.ts:
    Express app setup
    CORS with CLIENT_URL from env
    JSON body parser
    Mount all routes under /api
    Attach Socket.io to HTTP server via initSocket
    Export app and server

Build each file completely with full working code. No placeholders. No TODOs.
After all files are done, tell me Phase 2 is complete.