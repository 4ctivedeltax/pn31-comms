const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// channel -> set of socket ids
const channels = {};

io.on('connection', (socket) => {
  let currentChannel = null;
  let userName = null;

  // Rejoindre un canal
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

  // Quitter un canal
  socket.on('leave-channel', () => {
    if (currentChannel) {
      socket.leave(currentChannel);
      if (channels[currentChannel]) channels[currentChannel].delete(socket.id);
      io.to(currentChannel).emit('user-left', { user: userName, channel: currentChannel });
      currentChannel = null;
    }
  });

  // Message texte
  socket.on('chat-message', ({ channel, user, text }) => {
    io.to(channel).emit('chat-message', { user, text, time: new Date().toLocaleTimeString('fr-FR') });
  });

  // WebRTC signaling
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('ready', ({ channel }) => {
    socket.to(channel).emit('peer-ready', { id: socket.id, user: userName });
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
