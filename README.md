# 💸 Splitwise Clone — Spreetail Internship Assignment

A premium, high-fidelity Splitwise clone built as an evaluation project for the Spreetail internship. The application implements multi-method expense splitting (equal, unequal, percentage, share), net-debt simplification, real-time expense discussion chat rooms, Razorpay-based settlements, and an interactive CSV importer with anomaly resolution.

![Status](https://img.shields.io/badge/status-complete-brightgreen)
![Tech](https://img.shields.io/badge/stack-MERN%20%2B%20TypeScript-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 📑 Table of Contents

- [Deliverables & Documentation](#-deliverables--documentation)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Environment Variables](#️-environment-variables)
- [Getting Started](#-getting-started)
- [Build & Production](#-build--production)
- [AI Collaboration & Tooling](#-ai-collaboration--tooling)
- [Roadmap](#-roadmap)

---

## 📋 Deliverables & Documentation

As per the assignment requirements, the following documentation files are available at the root of the repository:

| File | Description |
|---|---|
| [SCOPE.md](SCOPE.md) | Anomaly log — the 12+ data anomalies identified in the source CSV, how each was handled, and the full database schema (including membership timelines) |
| [DECISIONS.md](DECISIONS.md) | Key architectural and product decisions: relational database choice, exchange rate handling, soft-deletion for members, and guest split policies |
| [AI_USAGE.md](AI_USAGE.md) | A transparent log of the AI collaboration process, prompts used, and three concrete instances where AI-generated code was incorrect and had to be corrected |

---

## 🚀 Key Features

### 🔐 Authentication
Secure password hashing with bcrypt, JWT-based authentication, and persistent sessions.

### 📥 CSV Importer (Ingest & Resolve)
- Preview grid showing every CSV row, the total amount in INR, and computed split shares.
- Automatic detection of duplicates, zero values, negative values, and date/name formatting errors.
- **Interactive resolution UI** — dropdown selectors let users assign payers for missing fields and resolve duplicate entries before committing.
- All rows are ingested inside a single database transaction, so a failure midway never leaves a partial import.

### 👥 Dynamic Group Membership
Members can join and leave groups at any time. A `left_at` timestamp on each membership record preserves a historical timeline, ensuring balance calculations remain mathematically consistent regardless of when an expense occurred.

### 💳 Razorpay Settlements
A mocked Razorpay checkout flow lets users settle outstanding balances directly within the app, styled with Stitch-derived teal accents for brand consistency.

### 💬 Real-Time Discussion Chat
Socket.io powers live, per-expense discussion threads inside each group's chat panel — useful for clarifying or disputing a charge in context.

### 🧮 Multi-Method Splitting & Debt Simplification
Expenses can be split equally, by exact amounts, by percentage, or by shares. A debt-simplification algorithm reduces the group's net balances to the minimum number of settling transactions.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React, Vite, TypeScript, Zustand, React Router, Socket.io Client, Lucide React |
| **Backend** | Node.js, Express.js, TypeScript, PostgreSQL (`pg` connection pool), Socket.io, JWT, bcrypt, Razorpay Node SDK |
| **Database** | PostgreSQL (hosted on Neon) |
| **Design System** | Custom CSS — glassmorphism, HSL color tokens, full dark mode support |

---

## 🏗 Architecture Overview

```
┌─────────────┐      REST + WebSocket      ┌──────────────┐
│   React SPA │ ◄────────────────────────► │ Express API  │
│  (Vite/TS)  │                             │  (TS + pg)   │
└─────────────┘                             └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │  PostgreSQL  │
                                              │   (Neon)     │
                                              └──────────────┘
```

- **Auth flow:** Client obtains a JWT on login/signup; the token is attached to subsequent API requests and validated by Express middleware.
- **Real-time layer:** Socket.io rooms are scoped per group, broadcasting new expenses, chat messages, and settlement updates to all connected members.
- **Data integrity:** CSV imports and multi-row financial operations are wrapped in PostgreSQL transactions to guarantee atomicity.

---

## 📁 Project Structure

```
.
├── src/
│   ├── db/
│   │   └── migrations/
│   │       └── 001_init.sql      # Schema DDL (groups, members, expenses, splits, etc.)
│   ├── routes/                   # Express route handlers
│   ├── services/                 # Business logic (splitting, debt simplification, CSV parsing)
│   ├── sockets/                  # Socket.io event handlers
│   └── server.ts                 # App entry point
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/                # Zustand stores
│   │   └── main.tsx
│   └── vite.config.ts
├── SCOPE.md
├── DECISIONS.md
├── AI_USAGE.md
└── README.md
```

---

## ⚙️ Environment Variables

### Backend (`.env` in root)

```env
PORT=5000
DATABASE_URL=postgres://username:password@localhost:5432/splitwise_clone
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:5173
RAZORPAY_KEY_ID=your_razorpay_key_id_placeholder
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_placeholder
```

### Frontend (`.env` in `frontend/`)

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

> ⚠️ Never commit real `.env` files. Use the placeholders above as a template and supply your own secrets locally.

---

## 🚀 Getting Started

### 1. Database Setup

Ensure PostgreSQL is running, then apply the schema:

```bash
psql -U postgres -d splitwise_clone -f src/db/migrations/001_init.sql
```

### 2. Backend Server

From the project root:

```bash
npm install
npm run dev
```

The API will be available at `http://localhost:5000`.

### 3. Frontend Server

From the `frontend/` directory:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 📦 Build & Production

### Backend

```bash
npm run build   # compiles TypeScript to ./dist
npm start       # runs the compiled server
```

### Frontend

```bash
cd frontend
npm run build   # outputs static assets to frontend/dist
```

---

## 🤖 AI Collaboration & Tooling

This project was built with the assistance of AI agentic coding tools, used transparently and documented in detail in [AI_USAGE.md](AI_USAGE.md):

- **Claude (Anthropic)** — used during the initial phase for scaffolding the application structure and implementing core business logic (e.g., the splitting and debt-simplification algorithms).
- **Antigravity (Google DeepMind)** — used as the primary agent for final-stage design refactoring (applying Stitch design tokens), migrating the database to Neon, running automated endpoint verification, and launching local dev servers.
- **Stitch MCP** — used to retrieve design tokens (color palettes, Geist/Inter typography, spacing scale, elevation/shadow configuration) that drive the custom styling system.

All AI-assisted code was reviewed and, where necessary, corrected — see [AI_USAGE.md](AI_USAGE.md) for three documented examples of mistakes caught and fixed during development.

---

## 🗺 Roadmap

- [ ] Replace mocked Razorpay flow with live test-mode integration
- [ ] Add automated test suite (unit + integration)
- [ ] Multi-currency support with live exchange rates
- [ ] Export group ledgers to PDF/CSV

---

## 📄 License

This project is licensed under the MIT License.