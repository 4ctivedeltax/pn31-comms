const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const channels = {};

// POST /daily-token
app.post('/daily-token', async (req, res) => {
  const { room_name } = req.body;
  try {
    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer aecea2bf849f88a8456e0f90ec7f0caa389d0dd1fafba064426e1678db6a777c`
      },
      body: JSON.stringify({ properties: { room_name, is_owner: false } })
    });
    const data = await response.json();
    res.json(data);
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
