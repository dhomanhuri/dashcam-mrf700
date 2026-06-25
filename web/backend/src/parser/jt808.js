/**
 * JT808 Packet Parser
 * Supports JT808-2019 protocol
 * 
 * Frame structure:
 * 7E [Header 12 bytes] [Body] [Checksum 1 byte] 7E
 */

const MSG_ID = {
  0x0001: 'GENERAL_RESPONSE',       // Terminal general response
  0x0002: 'HEARTBEAT',              // Heartbeat
  0x0100: 'REGISTER',               // Terminal registration
  0x0102: 'AUTH',                   // Terminal authentication
  0x0200: 'GPS',                    // Location report
  0x0704: 'BATCH_GPS',              // Batch location upload
  0x0900: 'PASSTHROUGH',            // Data passthrough
  0x1003: 'PARAM_QUERY',            // Query terminal params
  0x8001: 'PLATFORM_RESPONSE',      // Platform general response
  0x8100: 'REGISTER_RESPONSE',      // Registration response
  0x8103: 'SET_PARAM',              // Set terminal params
  0x8300: 'TEXT_SEND',              // Text message send
};

function unescape7e(buf) {
  const result = [];
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x7d && buf[i + 1] === 0x02) {
      result.push(0x7e);
      i++;
    } else if (buf[i] === 0x7d && buf[i + 1] === 0x01) {
      result.push(0x7d);
      i++;
    } else {
      result.push(buf[i]);
    }
  }
  return Buffer.from(result);
}

function verifyChecksum(buf) {
  // XOR from byte 1 to buf.length-2 (skip first 7E and last checksum+7E)
  let cs = 0;
  for (let i = 0; i < buf.length - 1; i++) {
    cs ^= buf[i];
  }
  return cs === buf[buf.length - 1];
}

function parseHeader(buf) {
  return {
    msgId:    buf.readUInt16BE(0),
    msgAttr:  buf.readUInt16BE(2),
    protVer:  buf[4],              // 2019: byte 4 = version, 2013: part of phone
    phone:    buf.slice(5, 11).toString('hex'),
    serial:   buf.readUInt16BE(11),
  };
}

function parseGPS(body) {
  if (body.length < 28) return null;
  
  const alarmFlag = body.readUInt32BE(0);
  const statusFlag = body.readUInt32BE(4);
  const lat = body.readUInt32BE(8) / 1e6;
  const lng = body.readUInt32BE(12) / 1e6;
  const altitude = body.readUInt16BE(16);
  const speed = body.readUInt16BE(18) / 10; // km/h
  const direction = body.readUInt16BE(20);
  
  // BCD time: YYMMDDHHmmss
  const timeBuf = body.slice(22, 28);
  const timeStr = timeBuf.toString('hex');
  const year = 2000 + parseInt(timeStr.substr(0, 2), 16);
  const month = parseInt(timeStr.substr(2, 2), 16);
  const day = parseInt(timeStr.substr(4, 2), 16);
  const hour = parseInt(timeStr.substr(6, 2), 16);
  const min = parseInt(timeStr.substr(8, 2), 16);
  const sec = parseInt(timeStr.substr(10, 2), 16);

  const latDir = (statusFlag & 0x04) ? -1 : 1;
  const lngDir = (statusFlag & 0x08) ? -1 : 1;

  return {
    alarmFlag,
    statusFlag,
    lat: lat * latDir,
    lng: lng * lngDir,
    altitude,
    speed,
    direction,
    accOn: !!(statusFlag & 0x01),
    gpsValid: !!(statusFlag & 0x02),
    timestamp: new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}Z`),
  };
}

function parse(rawBuf) {
  try {
    // Must start and end with 0x7E
    if (rawBuf[0] !== 0x7e || rawBuf[rawBuf.length - 1] !== 0x7e) {
      return { type: 'UNKNOWN', raw: rawBuf.toString('hex') };
    }

    // Strip 7E delimiters
    const inner = rawBuf.slice(1, rawBuf.length - 1);
    
    // Unescape
    const unescaped = unescape7e(inner);
    
    // Verify checksum
    const data = unescaped.slice(0, unescaped.length - 1);
    const checksum = unescaped[unescaped.length - 1];
    
    // Parse header (13 bytes for 2019, 12 for 2013)
    const header = parseHeader(data);
    const msgName = MSG_ID[header.msgId] || `UNKNOWN_0x${header.msgId.toString(16).toUpperCase()}`;
    
    // Body starts at byte 13
    const body = data.slice(13);

    let parsed = { type: msgName, header, raw: rawBuf.toString('hex') };

    switch (header.msgId) {
      case 0x0002: // Heartbeat
        parsed.data = {};
        break;

      case 0x0100: // Register
        parsed.data = {
          provinceId: body.readUInt16BE(0),
          cityId: body.readUInt16BE(2),
          manufacturer: body.slice(4, 9).toString('ascii').trim(),
          deviceModel: body.slice(9, 29).toString('ascii').trim(),
          deviceId: body.slice(29, 36).toString('ascii').trim(),
          plateColor: body[36],
          plateNo: body.slice(37).toString('utf8').trim(),
        };
        break;

      case 0x0102: // Auth
        parsed.data = {
          authCode: body.toString('ascii').trim(),
        };
        break;

      case 0x0200: // GPS Location
        parsed.data = parseGPS(body);
        break;

      default:
        parsed.data = { bodyHex: body.toString('hex') };
    }

    return parsed;
  } catch (err) {
    return { type: 'PARSE_ERROR', error: err.message, raw: rawBuf.toString('hex') };
  }
}

module.exports = { parse, MSG_ID };
