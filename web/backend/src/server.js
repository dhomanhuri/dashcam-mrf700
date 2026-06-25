require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const { startTCPServer, setWsClients } = require('./tcp/server');
const deviceRoutes = require('./routes/devices');
const packetRoutes = require('./routes/packets');

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`[WS] Client connected. Total: ${wsClients.size}`);

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${wsClients.size}`);
  });
});

setWsClients(wsClients);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/devices', deviceRoutes);
app.use('/api/packets', packetRoutes);

// Start servers
const HTTP_PORT = process.env.PORT || 3501;
const TCP_PORT = process.env.TCP_PORT || 9088;

server.listen(HTTP_PORT, () => {
  console.log(`[HTTP] API server running on port ${HTTP_PORT}`);
  console.log(`[WS]  WebSocket running on port ${HTTP_PORT}`);
});

startTCPServer(TCP_PORT);
