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
  res.json(await roomManager.getBootstrap());
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
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
  socket.on('room:create', async (payload, callback = () => {}) => {
    try {
      const result = await roomManager.createRoom(socket, payload);
      callback({ ok: true, ...result });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('player:join', async (payload, callback = () => {}) => {
    try {
      const result = roomManager.joinRoom(socket, payload);
      callback({ ok: true, ...result });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('room:updateSettings', (payload, callback = () => {}) => {
    try {
      roomManager.updateSettings(socket, payload);
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('room:kick', (targetId, callback = () => {}) => {
    try {
      roomManager.kickPlayer(socket, targetId);
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('game:start', (_payload, callback = () => {}) => {
    try {
      roomManager.startGame(socket);
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('game:vote', (targetId, callback = () => {}) => {
    try {
      roomManager.submitVote(socket, targetId);
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('game:dictatorChoice', (targetId, callback = () => {}) => {
    try {
      roomManager.submitDictatorChoice(socket, targetId);
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('game:restart', (_payload, callback = () => {}) => {
    try {
      roomManager.restartGame(socket);
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Spotlight Suspects server listening on http://localhost:${PORT}`);
});
