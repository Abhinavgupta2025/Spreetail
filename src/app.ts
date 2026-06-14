import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import groupRoutes from './routes/group.routes';
import expenseRoutes from './routes/expense.routes';
import balanceRoutes from './routes/balance.routes';
import settlementRoutes from './routes/settlement.routes';
import messageRoutes from './routes/message.routes';
import importRoutes from './routes/import.routes';
import errorMiddleware from './middleware/error.middleware';
import { initSocket } from './services/socket.service';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
const io = initSocket(server);

// CORS configuration
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: clientUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// Body parser
app.use(express.json());

// API Routes mounting
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/groups', importRoutes);
app.use('/api', expenseRoutes);
app.use('/api', balanceRoutes);
app.use('/api', settlementRoutes);
app.use('/api', messageRoutes);

// Root test route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use(errorMiddleware);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[Server] running on port ${PORT}`);
  console.log(`[CORS] configured to allow origin: ${clientUrl}`);
});

export { app, server, io };
