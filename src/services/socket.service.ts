import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';

export function initSocket(server: any) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authenticate socket connections using JWT from handshake.auth.token
  io.use((socket, next) => {
    let token = socket.handshake.auth?.token;
    
    if (!token) {
      // Support headers authorization too in case it was passed there
      const authHeader = socket.handshake.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(tokenString, JWT_SECRET) as { id: string; email: string };
      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    console.log(`User connected to socket: ${userId} (Socket: ${socket.id})`);

    // On join:expense, place the client socket into the specific room
    socket.on('join:expense', (expenseId: string) => {
      if (!expenseId) return;
      const room = `expense:${expenseId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    // Handle sending chat messages in real time
    socket.on('message:send', async (data: { expenseId: string; content: string }) => {
      const { expenseId, content } = data;
      const senderId = socket.data.user?.id;

      if (!expenseId || !content || !senderId) {
        return;
      }

      try {
        // 1. Verify if user is member of the group containing this expense
        const memberCheck = await query(
          `SELECT gm.id 
           FROM group_members gm
           JOIN expenses e ON gm.group_id = e.group_id
           WHERE e.id = $1 AND gm.user_id = $2`,
          [expenseId, senderId]
        );

        if (memberCheck.rows.length === 0) {
          socket.emit('error', { message: 'You are not a member of the group containing this expense' });
          return;
        }

        // 2. Insert message to database
        const msgRes = await query(
          `INSERT INTO messages (expense_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, expense_id as "expenseId", sender_id as "senderId", content, created_at as "createdAt"`,
          [expenseId, senderId, content]
        );

        const newMsg = msgRes.rows[0];

        // 3. Fetch sender name to broadcast
        const senderRes = await query(
          `SELECT name, email, avatar_url as "avatarUrl" FROM users WHERE id = $1`,
          [senderId]
        );
        const sender = senderRes.rows[0];

        const payload = {
          ...newMsg,
          senderName: sender.name,
          senderEmail: sender.email,
          senderAvatarUrl: sender.avatarUrl,
        };

        // 4. Emit to room
        const room = `expense:${expenseId}`;
        io.to(room).emit('message:new', payload);
      } catch (err) {
        console.error('Error handling socket message:send', err);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from socket: ${userId} (Socket: ${socket.id})`);
    });
  });

  return io;
}
