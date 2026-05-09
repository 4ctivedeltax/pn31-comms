const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const LIVEKIT_API_KEY = 'APIBFG5b6JhNrMe';
const LIVEKIT_API_SECRET = '2ecwdfcz3Im3a37zTr1b3Sv20WFIeJ35c4kw7UsnkNJA';

const channels = {};

// POST /livekit-token
app.post('/livekit-token', async (req, res) => {
  const { room, username } = req.body;
  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: username });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

io.on('connection', (socket) => {
  let currentChannel = null;
  let userName = null;

  socket.on('join-channel', ({ channel, user }) => {
    if (currentChannel) {
      socket.leave(currentChannel);
      if (channels[currentChannel]) channels[currentChannel].delete(socket.id);
    }
    currentChannel = channel;
    userName = user;
    socket.join(channel);
    if (!channels[channel]) channels[channel] = new Set();
    channels[channel].add(socket.id);
    io.to(channel).emit('user-joined', { user, channel });
  });

  socket.on('leave-channel', () => {
    if (currentChannel) {
      socket.leave(currentChannel);
      if (channels[currentChannel]) channels[currentChannel].delete(socket.id);
      io.to(currentChannel).emit('user-left', { user: userName, channel: currentChannel });
      currentChannel = null;
    }
  });

  socket.on('chat-message', ({ channel, user, text }) => {
    io.to(channel).emit('chat-message', { user, text, time: new Date().toLocaleTimeString('fr-FR') });
  });

  socket.on('disconnect', () => {
    if (currentChannel) {
      if (channels[currentChannel]) channels[currentChannel].delete(socket.id);
      io.to(currentChannel).emit('user-left', { user: userName, channel: currentChannel });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`PN31 Comms on port ${PORT}`));
