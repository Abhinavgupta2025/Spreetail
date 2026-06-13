# Splitwise Clone App

A premium, high-fidelity Splitwise clone built as an evaluation project for the Spreetail internship. The app implements multi-weight splitting (equal, unequal, percentage, share), net debt simplification, and real-time expense discussion chat rooms.

---

## 🤖 AI Collaboration & Tooling
This project was developed in close collaboration with AI agentic coding assistants:
* **Antigravity (Google DeepMind)**: Served as the primary agent for final design refactoring (applying Stitch design tokens), connecting and migrating the database to AWS Neon, performing automated endpoint verification, and launching live servers.
* **Claude (Anthropic)**: Utilized during the initial phase for core application scaffolding and business logic implementation.
* **Stitch MCP**: Used to list design systems and retrieve the visual tokens (color palettes, Geist/Inter font declarations, layout spacing, elevation/shadow configs) for the custom styling system.

---

## 🛠 Tech Stack

- **Frontend:** React, Vite, TypeScript, Zustand, React Router, Socket.io Client, Lucide React
- **Backend:** Node.js, Express.js, TypeScript, PostgreSQL Connection Pool (`pg`), Socket.io, JWT, bcrypt
- **Design System:** Custom CSS (glassmorphism, tailored HSL color tokens, dark mode support)

---

## ⚙️ Environment Variables

### Backend Configuration
Create a `.env` file in the root directory:

```env
PORT=5000
DATABASE_URL=postgres://username:password@localhost:5432/splitwise_clone
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:5173
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
Ensure you have a running PostgreSQL database. Create the tables by executing the initial DDL DDL migrations found in:
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

---

## 🌐 Deployment Plan

### Backend & Database
- **Platform:** Railway or Render
- **Database:** Supabase or Railway PostgreSQL Addon
- Make sure to set the production environment variables (`DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`) in the provider dashboard.

### Frontend
- **Platform:** Vercel or Netlify
- Set the backend URL variable (`VITE_API_BASE_URL`, `VITE_SOCKET_URL`) during the build process to point to your live backend domain.
- Verify that the backend CORS (`CLIENT_URL`) is configured to allow your Vercel/Netlify frontend URL.
