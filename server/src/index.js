import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { Server } from 'socket.io';
import { RoomManager } from './state/roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');
const shouldServeClient = process.env.NODE_ENV === 'production' && existsSync(clientIndexPath);
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

function log(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
});

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager(io);

app.use(cors());
app.use(express.json());

app.get('/api/bootstrap', async (_req, res) => {
  try {
    res.json(await roomManager.getBootstrap());
  } catch (error) {
    log('error', 'Bootstrap failed', { error: error.message });
    res.status(500).json({ ok: false, error: 'Bootstrap failed' });
  }
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

if (shouldServeClient) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/socket.io' || req.path.startsWith('/socket.io/')) {
      next();
      return;
    }
    res.sendFile(clientIndexPath);
  });
}

io.on('connection', (socket) => {
  log('log', 'Socket connected', { socketId: socket.id });

  socket.on('room:create', async (payload, callback = () => {}) => {
    try {
      const result = await roomManager.createRoom(socket, payload);
      log('log', 'Room created', { socketId: socket.id, roomCode: result.roomCode, playerId: result.playerId });
      callback({ ok: true, ...result });
    } catch (error) {
      log('error', 'Room creation failed', { socketId: socket.id, error: error.message });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('player:join', async (payload, callback = () => {}) => {
    try {
      const result = await roomManager.joinRoom(socket, payload);
      log('log', 'Room join succeeded', { socketId: socket.id, roomCode: result.roomCode, playerId: result.playerId });
      callback({ ok: true, ...result });
    } catch (error) {
      log('error', 'Room join failed', {
        socketId: socket.id,
        roomCode: payload?.roomCode,
        error: error.message
      });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('room:updateSettings', async (payload, callback = () => {}) => {
    try {
      await roomManager.updateSettings(socket, payload);
      callback({ ok: true });
    } catch (error) {
      log('error', 'Room settings update failed', { socketId: socket.id, error: error.message });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('room:updateProfile', async (payload, callback = () => {}) => {
    try {
      const result = await roomManager.updateProfile(socket, payload);
      callback({ ok: true, ...result });
    } catch (error) {
      log('error', 'Profile update failed', { socketId: socket.id, error: error.message });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('room:kick', async (targetId, callback = () => {}) => {
    try {
      await roomManager.kickPlayer(socket, targetId);
      callback({ ok: true });
    } catch (error) {
      log('error', 'Kick failed', { socketId: socket.id, error: error.message });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('game:start', (payload, callback = () => {}) => {
    try {
      roomManager.startGame(socket, payload);
      callback({ ok: true });
    } catch (error) {
      log('error', 'Game start failed', { socketId: socket.id, error: error.message });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('game:vote', (targetId, callback = () => {}) => {
    try {
      roomManager.submitVote(socket, targetId);
      callback({ ok: true });
    } catch (error) {
      log('error', 'Vote failed', { socketId: socket.id, error: error.message });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('game:dictatorChoice', (targetId, callback = () => {}) => {
    try {
      roomManager.submitVote(socket, targetId);
      callback({ ok: true });
    } catch (error) {
      log('error', 'Dictator vote failed', { socketId: socket.id, error: error.message });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('game:restart', async (_payload, callback = () => {}) => {
    try {
      await roomManager.restartGame(socket);
      callback({ ok: true });
    } catch (error) {
      log('error', 'Game restart failed', { socketId: socket.id, error: error.message });
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('disconnect', (reason) => {
    log('log', 'Socket disconnected', { socketId: socket.id, reason });
    roomManager.handleDisconnect(socket).catch((error) => {
      log('error', 'Disconnect handling failed', { socketId: socket.id, error: error.message });
    });
  });
});

server.listen(PORT, HOST, () => {
  log('log', 'Server started', {
    port: PORT,
    host: HOST,
    mode: process.env.NODE_ENV || 'development',
    serveClient: shouldServeClient
  });
});
