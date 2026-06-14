# Splitwise Clone App & Spreetail Assignment

A premium, high-fidelity Splitwise clone built as an evaluation project for the Spreetail internship. The app implements multi-weight splitting (equal, unequal, percentage, share), net debt simplification, real-time expense discussion chat rooms, Razorpay payment settlements, and an interactive CSV Importer with anomaly resolution.

---

## 📋 Deliverables & Documentation Links
As per the assignment requirements, the following documentation files have been created at the root of the repository:
1. **[SCOPE.md](SCOPE.md)**: Details the anomaly log (the 12+ data anomalies identified in the CSV file, how they were handled, and the database schema including membership timelines).
2. **[DECISIONS.md](DECISIONS.md)**: Records key architectural and product design decisions, including the relational database choice, exchange rate settings, soft-deletion for members, and guest split policies.
3. **[AI_USAGE.md](AI_USAGE.md)**: Documents the AI collaboration process, prompts, and three concrete corrections where the AI generated incorrect code that was corrected.

---

## 🚀 Key Features

1. **Robust Login & Auth**: Standard secure password hashing with bcrypt, JWT token authentication, and session persistence.
2. **CSV Importer (Ingest & Resolve)**:
   - Preview grid displays all CSV rows, total amount in INR, and split shares.
   - Identifies duplicates, zero values, negative values, and date/name formatting errors.
   - **Interactive Resolution**: Dropdown selectors let users choose payers for missing fields and resolve duplicate choices before committing.
   - Ingests all data in a single transactional block to prevent partial import failures.
3. **Dynamic Group Membership**: Supports members joining and leaving. Utilizes a `left_at` timeline timestamp to keep balances mathematically consistent over time.
4. **Razorpay settlements**: Integrated mock payment gateway checkout flow using Stitch teals for visual brand consistency.
5. **Real-time Discussion Chat**: Integrated Socket.io for immediate discussion of expenses inside group chat panels.

---

## 🤖 AI Collaboration & Tooling
This project was developed in close collaboration with AI agentic coding assistants:
* **Antigravity (Google DeepMind)**: Served as the primary agent for final design refactoring (applying Stitch design tokens), connecting and migrating the database to AWS Neon, performing automated endpoint verification, and launching live servers.
* **Claude (Anthropic)**: Utilized during the initial phase for core application scaffolding and business logic implementation.
* **Stitch MCP**: Used to list design systems and retrieve the visual tokens (color palettes, Geist/Inter font declarations, layout spacing, elevation/shadow configs) for the custom styling system.

---

## 🛠 Tech Stack

- **Frontend:** React, Vite, TypeScript, Zustand, React Router, Socket.io Client, Lucide React
- **Backend:** Node.js, Express.js, TypeScript, PostgreSQL Connection Pool (`pg`), Socket.io, JWT, bcrypt, Razorpay Node SDK
- **Design System:** Custom CSS (glassmorphism, HSL color tokens, dark mode support)

---

## ⚙️ Environment Variables

### Backend Configuration
Create a `.env` file in the root directory:

```env
PORT=5000
DATABASE_URL=postgres://username:password@localhost:5432/splitwise_clone
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:5173
RAZORPAY_KEY_ID=your_razorpay_key_id_placeholder
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_placeholder
```

### Frontend Configuration
Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 🚀 How to Run Locally

### 1. Database Setup
Ensure you have a running PostgreSQL database. Create the tables by executing the DDL migrations found in:
* **[src/db/migrations/001_init.sql](src/db/migrations/001_init.sql)**

```bash
psql -U postgres -d splitwise_clone -f src/db/migrations/001_init.sql
```

### 2. Run Backend Server
From the root directory:

```bash
# Install dependencies
npm install

# Start in development mode (HMR via nodemon)
npm run dev
```

The backend server will launch on `http://localhost:5000`.

### 3. Run Frontend Server
From the `frontend/` directory:

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The React frontend will launch on `http://localhost:5173`.

---

## 🏗 Build & Production Compilation

### Compiling Backend
To build the TypeScript backend into production Javascript:
```bash
npm run build
```
This generates compiled code in the `./dist` folder, which can be run with `npm start`.

### Compiling Frontend
To build the React frontend for hosting:
```bash
cd frontend
npm run build
```
This outputs static assets under `frontend/dist`.
