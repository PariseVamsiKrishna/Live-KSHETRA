const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory state
const rooms = {};
// rooms[roomId] = {
//   host: socketId,
//   locked: false,
//   participants: { [socketId]: { id, name, audioOn, videoOn, handRaised, screenSharing, isHost } },
//   lobby: { [socketId]: { id, name } },
//   chat: [],
//   whiteboardStrokes: [],
// }

function getRoomParticipantsList(roomId) {
  const room = rooms[roomId];
  if (!room) return [];
  return Object.values(room.participants);
}

function getRoomLobbyList(roomId) {
  const room = rooms[roomId];
  if (!room) return [];
  return Object.values(room.lobby);
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ─── Room & Lobby ───────────────────────────────────────────────────────────

  // Ask to join (lobby)
  socket.on('ask-to-join', ({ roomId, name }) => {
    if (!rooms[roomId]) {
      // First person creates the room and is auto-admitted
      rooms[roomId] = {
        host: socket.id,
        locked: false,
        participants: {},
        lobby: {},
        chat: [],
        whiteboardStrokes: [],
      };
      admitUser(socket, roomId, name, true);
    } else if (rooms[roomId].locked) {
      socket.emit('room-locked');
    } else if (rooms[roomId].host === socket.id) {
      // Rejoin as host
      admitUser(socket, roomId, name, true);
    } else {
      // Add to lobby and alert host
      rooms[roomId].lobby[socket.id] = { id: socket.id, name };
      socket.emit('waiting-in-lobby', { roomId });
      const hostId = rooms[roomId].host;
      if (hostId) {
        io.to(hostId).emit('lobby-request', { socketId: socket.id, name });
      }
      console.log(`[lobby] ${name} (${socket.id}) waiting for admission to ${roomId}`);
    }
  });

  function admitUser(socket, roomId, name, isHost) {
    const room = rooms[roomId];
    delete room.lobby[socket.id];

    const participant = {
      id: socket.id,
      name,
      audioOn: true,
      videoOn: true,
      handRaised: false,
      screenSharing: false,
      isHost,
    };
    room.participants[socket.id] = participant;

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;

    // Send room state to new participant
    socket.emit('room-joined', {
      roomId,
      participants: getRoomParticipantsList(roomId),
      chat: room.chat,
      whiteboardStrokes: room.whiteboardStrokes,
      isHost,
      hostId: room.host,
    });

    // Notify existing participants
    socket.to(roomId).emit('participant-joined', { participant });
    console.log(`[join] ${name} (${socket.id}) joined room ${roomId}. Total: ${Object.keys(room.participants).length}`);
  }

  // Host admits a lobby user
  socket.on('admit-user', ({ roomId, socketId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    const lobbyUser = room.lobby[socketId];
    if (!lobbyUser) return;
    const target = io.sockets.sockets.get(socketId);
    if (target) {
      admitUser(target, roomId, lobbyUser.name, false);
      target.emit('admitted');
    }
  });

  // Host denies a lobby user
  socket.on('deny-user', ({ roomId, socketId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    delete room.lobby[socketId];
    const target = io.sockets.sockets.get(socketId);
    if (target) target.emit('denied');
  });

  // ─── WebRTC Signaling ───────────────────────────────────────────────────────

  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // ─── Participant State ──────────────────────────────────────────────────────

  socket.on('update-state', (stateUpdate) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || !room.participants[socket.id]) return;
    Object.assign(room.participants[socket.id], stateUpdate);
    socket.to(roomId).emit('participant-state-changed', {
      socketId: socket.id,
      ...stateUpdate,
    });
  });

  // ─── Host Controls ──────────────────────────────────────────────────────────

  socket.on('mute-all', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    Object.keys(room.participants).forEach((pid) => {
      if (pid !== socket.id) {
        room.participants[pid].audioOn = false;
        io.to(pid).emit('force-muted');
      }
    });
    socket.to(roomId).emit('all-muted');
  });

  socket.on('kick-user', ({ roomId, socketId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    const target = io.sockets.sockets.get(socketId);
    if (target) {
      target.emit('kicked');
      delete room.participants[socketId];
      io.to(roomId).emit('participant-left', { socketId });
      target.leave(roomId);
    }
  });

  socket.on('lock-room', ({ roomId, locked }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    room.locked = locked;
    io.to(roomId).emit('room-lock-changed', { locked });
  });

  // ─── Chat ───────────────────────────────────────────────────────────────────

  socket.on('send-chat', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;
    const participant = room.participants[socket.id];
    if (!participant) return;
    const msg = {
      id: uuidv4(),
      senderId: socket.id,
      senderName: participant.name,
      message,
      timestamp: Date.now(),
    };
    room.chat.push(msg);
    io.to(roomId).emit('receive-chat', msg);
  });

  // ─── Reactions ──────────────────────────────────────────────────────────────

  socket.on('send-reaction', ({ roomId, emoji }) => {
    const room = rooms[roomId];
    if (!room) return;
    const participant = room.participants[socket.id];
    if (!participant) return;
    io.to(roomId).emit('receive-reaction', {
      id: uuidv4(),
      senderId: socket.id,
      senderName: participant.name,
      emoji,
      timestamp: Date.now(),
    });
  });

  // ─── Live Captions ──────────────────────────────────────────────────────────

  socket.on('send-caption', ({ roomId, text }) => {
    socket.to(roomId).emit('receive-caption', {
      senderId: socket.id,
      senderName: socket.data.name,
      text,
      timestamp: Date.now(),
    });
  });

  // ─── Whiteboard ─────────────────────────────────────────────────────────────

  socket.on('whiteboard-draw', ({ roomId, stroke }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.whiteboardStrokes.push(stroke);
    socket.to(roomId).emit('whiteboard-draw', { stroke });
  });

  socket.on('whiteboard-clear', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.whiteboardStrokes = [];
    io.to(roomId).emit('whiteboard-cleared');
  });

  socket.on('whiteboard-undo', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.whiteboardStrokes.pop();
    io.to(roomId).emit('whiteboard-undo');
  });

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  socket.on('leave-room', () => {
    handleLeave(socket);
  });

  socket.on('end-meeting', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;
    io.to(roomId).emit('meeting-ended');
    // Clean up room after small delay
    setTimeout(() => {
      delete rooms[roomId];
    }, 2000);
  });

  socket.on('disconnect', () => {
    handleLeave(socket);
    console.log(`[disconnect] ${socket.id}`);
  });

  function handleLeave(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room) return;

    // Remove from lobby if still there
    delete room.lobby[socket.id];

    if (room.participants[socket.id]) {
      delete room.participants[socket.id];
      socket.to(roomId).emit('participant-left', { socketId: socket.id });
      socket.leave(roomId);
      delete socket.data.roomId;

      const remaining = Object.keys(room.participants);
      if (remaining.length === 0) {
        delete rooms[roomId];
        console.log(`[room] ${roomId} closed (empty)`);
      } else if (room.host === socket.id) {
        // Transfer host to next participant
        room.host = remaining[0];
        room.participants[remaining[0]].isHost = true;
        io.to(roomId).emit('host-changed', { newHostId: remaining[0] });
        console.log(`[host] Transferred to ${remaining[0]}`);
      }
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Signaling server running on http://localhost:${PORT}\n`);
});
