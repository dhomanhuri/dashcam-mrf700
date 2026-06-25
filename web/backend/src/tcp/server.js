const net = require('net');
const { parse } = require('../parser/jt808');
const db = require('../db');

let wsClients = new Set();
const connectedDevices = new Map();

function setWsClients(clients) {
  wsClients = clients;
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wsClients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

async function handlePacket(socket, deviceId, packet) {
  const hex = packet.toString('hex');
  const ascii = packet.toString('ascii').replace(/[^\x20-\x7E]/g, '.');

  // Always save raw packet
  await db.query(
    `INSERT INTO raw_packets (device_id, direction, hex_data, ascii_data, packet_type)
     VALUES ($1, 'IN', $2, $3, $4)`,
    [deviceId || 'unknown', hex, ascii, packet[0] === 0x7e ? 'JT808' : 'UNKNOWN']
  ).catch(() => {});

  // Try parse if JT808
  if (packet[0] === 0x7e) {
    const parsed = parse(packet);

    console.log(`[TCP] Device: ${deviceId} | Type: ${parsed.type}`);

    // Update packet type in DB
    await db.query(
      `UPDATE raw_packets SET packet_type = $1 WHERE id = (SELECT id FROM raw_packets ORDER BY id DESC LIMIT 1)`,
      [parsed.type]
    ).catch(() => {});

    switch (parsed.type) {
      case 'REGISTER': {
        const id = parsed.header?.phone || deviceId;
        connectedDevices.set(socket, id);
        await db.query(
          `INSERT INTO devices (device_id, last_seen, online)
           VALUES ($1, NOW(), TRUE)
           ON CONFLICT (device_id) DO UPDATE SET last_seen = NOW(), online = TRUE`,
          [id]
        ).catch(() => {});

        // Send register response (0x8100)
        const resp = buildPlatformResponse(0x8100, parsed.header?.serial || 0, '0');
        socket.write(resp);
        break;
      }

      case 'HEARTBEAT': {
        const id = connectedDevices.get(socket) || deviceId;
        await db.query(
          `UPDATE devices SET last_seen = NOW(), online = TRUE WHERE device_id = $1`,
          [id]
        ).catch(() => {});

        // Send heartbeat response
        const resp = buildGeneralResponse(parsed.header?.serial || 0, 0x0002, 0);
        socket.write(resp);
        break;
      }

      case 'AUTH': {
        const id = connectedDevices.get(socket) || deviceId;
        const resp = buildGeneralResponse(parsed.header?.serial || 0, 0x0102, 0);
        socket.write(resp);
        break;
      }

      case 'GPS': {
        const id = connectedDevices.get(socket) || deviceId;
        if (parsed.data && parsed.data.lat) {
          await db.query(
            `INSERT INTO gps_records (device_id, lat, lng, speed, direction, altitude, acc_on, recorded_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, parsed.data.lat, parsed.data.lng, parsed.data.speed,
             parsed.data.direction, parsed.data.altitude, parsed.data.accOn,
             parsed.data.timestamp || new Date()]
          ).catch(() => {});

          // Broadcast to WebSocket clients
          broadcast({
            type: 'GPS_UPDATE',
            deviceId: id,
            data: {
              lat: parsed.data.lat,
              lng: parsed.data.lng,
              speed: parsed.data.speed,
              direction: parsed.data.direction,
              accOn: parsed.data.accOn,
              timestamp: parsed.data.timestamp,
            }
          });
        }

        const resp = buildGeneralResponse(parsed.header?.serial || 0, 0x0200, 0);
        socket.write(resp);
        break;
      }
    }
  }
}

function buildGeneralResponse(serial, msgId, result) {
  // 0x8001: Platform general response
  const body = Buffer.alloc(5);
  body.writeUInt16BE(serial, 0);
  body.writeUInt16BE(msgId, 2);
  body[4] = result;
  return buildFrame(0x8001, '000000000000', body);
}

function buildPlatformResponse(msgId, serial, authCode) {
  const auth = Buffer.from(authCode || '0');
  const body = Buffer.alloc(3 + auth.length);
  body.writeUInt16BE(serial, 0);
  body[2] = 0; // success
  auth.copy(body, 3);
  return buildFrame(msgId, '000000000000', body);
}

function buildFrame(msgId, phone, body) {
  const header = Buffer.alloc(13);
  header.writeUInt16BE(msgId, 0);
  header.writeUInt16BE(body.length & 0x03ff, 2);
  header[4] = 0x01; // version
  Buffer.from(phone, 'hex').copy(header, 5);
  header.writeUInt16BE(0x0001, 11);

  const content = Buffer.concat([header, body]);
  let cs = 0;
  for (const b of content) cs ^= b;

  const raw = Buffer.concat([content, Buffer.from([cs])]);

  // Escape
  const escaped = [];
  for (const b of raw) {
    if (b === 0x7e) { escaped.push(0x7d, 0x02); }
    else if (b === 0x7d) { escaped.push(0x7d, 0x01); }
    else { escaped.push(b); }
  }

  return Buffer.from([0x7e, ...escaped, 0x7e]);
}

function startTCPServer(port) {
  const server = net.createServer((socket) => {
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP] New connection from ${remoteAddr}`);

    let buffer = Buffer.alloc(0);

    socket.on('data', async (data) => {
      buffer = Buffer.concat([buffer, data]);

      // Extract complete JT808 frames (delimited by 0x7E)
      while (true) {
        const start = buffer.indexOf(0x7e);
        if (start === -1) { buffer = Buffer.alloc(0); break; }

        const end = buffer.indexOf(0x7e, start + 1);
        if (end === -1) break;

        const frame = buffer.slice(start, end + 1);
        buffer = buffer.slice(end + 1);

        const deviceId = connectedDevices.get(socket) || 'unknown';
        await handlePacket(socket, deviceId, frame);
      }
    });

    socket.on('close', async () => {
      const deviceId = connectedDevices.get(socket);
      console.log(`[TCP] Disconnected: ${remoteAddr} (${deviceId || 'unknown'})`);
      if (deviceId) {
        await db.query(
          `UPDATE devices SET online = FALSE WHERE device_id = $1`,
          [deviceId]
        ).catch(() => {});
        connectedDevices.delete(socket);

        broadcast({ type: 'DEVICE_OFFLINE', deviceId });
      }
    });

    socket.on('error', (err) => {
      console.error(`[TCP] Socket error ${remoteAddr}:`, err.message);
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[TCP] Server listening on port ${port}`);
  });

  return server;
}

module.exports = { startTCPServer, setWsClients };
