const net  = require('net');
const fs   = require('fs');
const path = require('path');

// =============================================
// CONFIG
// =============================================

const CONFIG = {
    listen: {
        host : '0.0.0.0',
        port : 9088
    },
    cmsv6: {
        host : '10.10.0.53',
        port : 6608
    },
    log: {
        dir : 'logs'
    }
};

// =============================================
// UTILITY
// =============================================

function nowTs() {
    return new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
}

function todayDate() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function toHex(buf) {
    return Array.from(buf)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
}

function toAsciiSafe(buf) {
    return Array.from(buf)
        .map(b => (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.')
        .join('');
}

function zeroPad(n, len = 4) {
    return String(n).padStart(len, '0');
}

/**
 * Coba ekstrak device ID dari beberapa packet awal.
 * Dicoba beberapa pola agar tidak stuck di UNKNOWN.
 */
function parseDeviceId(buf) {
    try {
        const str = buf.toString('ascii', 0, Math.min(buf.length, 256));

        // Pola CMSV6: $$dc...,xxx,xxx,xxx,<deviceId>
        const m1 = str.match(/\$\$dc\d+,[^,]+,[^,]+,[^,]+,(\d{10,})/);
        if (m1) return m1[1];

        // Pola 12 digit berurutan (IMEI / device ID umum)
        const m2 = str.match(/(\d{12})/);
        if (m2) return m2[1];

        // Pola JT808: phone number di header (byte 5-10)
        if (buf.length >= 11) {
            const phone = buf.slice(5, 11).toString('hex');
            if (/^[0-9a-f]{12}$/.test(phone) && phone !== '000000000000') {
                return phone;
            }
        }
    } catch (_) {}
    return null; // null = belum diketahui, akan dicoba lagi di packet berikutnya
}

// =============================================
// SESSION COUNTER
// =============================================

const _sessionCounters = {};

function nextSessionNum(deviceId, date) {
    const key = `${deviceId}:${date}`;
    if (!_sessionCounters[key]) _sessionCounters[key] = 0;
    _sessionCounters[key]++;
    return _sessionCounters[key];
}

// =============================================
// LOGGER
// =============================================

class Logger {
    constructor(deviceId, ip) {
        this.deviceId  = deviceId;
        this.ip        = ip;
        this.startTime = nowTs();
        this.count     = { dashcam: 0, cmsv6: 0 };
        this.dir       = null;
        this.rawDir    = null;
        this.metaPath  = null;

        this.dashcamLog = null;
        this.cmsv6Log   = null;
        this.mergedLog  = null;
    }

    init(sessionNum) {
        const date      = todayDate();
        const sessionId = 'session' + zeroPad(sessionNum);
        this.dir        = path.join(CONFIG.log.dir, this.deviceId, date, sessionId);
        this.rawDir     = path.join(this.dir, 'raw');

        fs.mkdirSync(this.dir,    { recursive: true });
        fs.mkdirSync(this.rawDir, { recursive: true });

        this.dashcamLog = path.join(this.dir, 'dashcam.log');
        this.cmsv6Log   = path.join(this.dir, 'cmsv6.log');
        this.mergedLog  = path.join(this.dir, 'merged.log');
        this.metaPath   = path.join(this.dir, 'meta.json');

        this._writeMeta('OPEN');
        console.log(`[LOG DIR] ${this.dir}`);
    }

    writeDashcam(buf) {
        this.count.dashcam++;
        const block = this._block('DASHCAM', buf);
        fs.appendFileSync(this.dashcamLog, block);
        fs.appendFileSync(this.mergedLog,  block);

        // Simpan raw binary
        const idx = zeroPad(this.count.dashcam);
        fs.writeFileSync(path.join(this.rawDir, `${idx}_IN.bin`), buf);
    }

    writeCmsv6(buf) {
        this.count.cmsv6++;
        const block = this._block('CMSV6', buf);
        fs.appendFileSync(this.cmsv6Log,  block);
        fs.appendFileSync(this.mergedLog, block);

        // Simpan raw binary
        const idx = zeroPad(this.count.cmsv6);
        fs.writeFileSync(path.join(this.rawDir, `${idx}_OUT.bin`), buf);
    }

    close() {
        this._writeMeta('CLOSED', nowTs());
    }

    _block(from, buf) {
        const ascii = toAsciiSafe(buf);
        const hex   = toHex(buf);
        return [
            '==================================================',
            `TIME   ${nowTs()}`,
            `FROM   ${from}`,
            `LEN    ${buf.length}`,
            '',
            'ASCII',
            ascii,
            '',
            'HEX',
            hex,
            '==================================================',
            ''
        ].join('\n');
    }

    _writeMeta(status, endTime = null) {
        const meta = {
            device_id  : this.deviceId,
            ip         : this.ip,
            start_time : this.startTime,
            end_time   : endTime || '-',
            status     : status,
            packets    : this.count
        };
        fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2));
    }
}

// =============================================
// TRANSPARENT PROXY — DUA ARAH
// =============================================

let connId = 0;

const server = net.createServer((dashcamSocket) => {
    connId++;
    const id       = connId;
    const remoteIp = dashcamSocket.remoteAddress || 'unknown';

    console.log('\n================================');
    console.log(`DASHCAM CONNECTED  #${id}`);
    console.log(`IP   : ${remoteIp}`);
    console.log(`TIME : ${nowTs()}`);
    console.log('================================');

    let logger         = null;
    let deviceId       = 'UNKNOWN';
    let deviceResolved = false;   // true setelah device ID berhasil diparse
    let packetCount    = 0;       // jumlah packet yang sudah diterima
    let cmsv6Ready     = false;
    let pendingBufs    = [];

    // ---- Buka koneksi ke CMSV6 ----
    const cmsv6Socket = net.createConnection({
        host : CONFIG.cmsv6.host,
        port : CONFIG.cmsv6.port
    });

    // Timeout CMSV6 30 detik — kalau CMSV6 hang proxy tidak ikut hang
    cmsv6Socket.setTimeout(30000);
    cmsv6Socket.on('timeout', () => {
        console.log(`[#${id}] CMSV6 timeout, closing`);
        cmsv6Socket.destroy();
    });

    cmsv6Socket.on('connect', () => {
        console.log(`[#${id}] CMSV6 connected → ${CONFIG.cmsv6.host}:${CONFIG.cmsv6.port}`);
        cmsv6Ready = true;

        // Flush packet yang datang sebelum CMSV6 siap
        if (pendingBufs.length > 0) {
            pendingBufs.forEach(b => cmsv6Socket.write(b));
            console.log(`[#${id}] Flushed ${pendingBufs.length} pending packet(s) ke CMSV6`);
            pendingBufs = [];
        }
    });

    // ---- DASHCAM → Node → CMSV6 ----
    dashcamSocket.on('data', (data) => {
        packetCount++;

        // Coba resolve device ID dari beberapa packet awal (tidak hanya packet pertama)
        if (!deviceResolved && packetCount <= 5) {
            const parsed = parseDeviceId(data);
            if (parsed) {
                deviceId       = parsed;
                deviceResolved = true;

                const date = todayDate();
                const num  = nextSessionNum(deviceId, date);
                logger     = new Logger(deviceId, remoteIp);
                logger.init(num);

                console.log(`[#${id}] DEVICE ID : ${deviceId}`);
            } else if (packetCount === 1) {
                // Packet pertama tapi belum bisa parse — init dengan UNKNOWN dulu
                // Logger akan di-rename saat device ID ditemukan
                const date = todayDate();
                const num  = nextSessionNum('UNKNOWN', date);
                logger     = new Logger('UNKNOWN', remoteIp);
                logger.init(num);
                console.log(`[#${id}] Device ID belum dikenali dari packet #${packetCount}, log sementara sebagai UNKNOWN`);
            }
        }

        // Catat dari dashcam
        if (logger) logger.writeDashcam(data);

        const preview = toAsciiSafe(data).slice(0, 68);
        console.log(`[#${id}] DASHCAM→  LEN=${String(data.length).padStart(5)}  ${preview}${data.length > 68 ? '...' : ''}`);

        // Forward ke CMSV6
        if (cmsv6Ready) {
            cmsv6Socket.write(data);
        } else {
            pendingBufs.push(data);
            console.log(`[#${id}] CMSV6 belum siap, di-buffer (${pendingBufs.length})`);
        }
    });

    // ---- CMSV6 → Node → DASHCAM ----
    cmsv6Socket.on('data', (data) => {

        // Edge case: CMSV6 kirim duluan sebelum dashcam
        if (!logger) {
            const date = todayDate();
            const num  = nextSessionNum(deviceId, date);
            logger     = new Logger(deviceId, remoteIp);
            logger.init(num);
        }

        // Catat dari CMSV6
        logger.writeCmsv6(data);

        const preview = toAsciiSafe(data).slice(0, 68);
        console.log(`[#${id}]  ←CMSV6  LEN=${String(data.length).padStart(5)}  ${preview}${data.length > 68 ? '...' : ''}`);

        // Forward ke dashcam
        try {
            dashcamSocket.write(data);
        } catch (e) {
            console.log(`[#${id}] Gagal forward ke dashcam: ${e.message}`);
        }
    });

    // ---- Close & Error handling ----
    dashcamSocket.on('close', () => {
        console.log(`[#${id}] DASHCAM disconnected  device=${deviceId}  in=${logger ? logger.count.dashcam : 0}  out=${logger ? logger.count.cmsv6 : 0}`);
        if (logger) logger.close();
        cmsv6Socket.destroy();
    });

    dashcamSocket.on('error', (err) => {
        console.log(`[#${id}] DASHCAM error: ${err.message}`);
        if (logger) logger.close();
        cmsv6Socket.destroy();
    });

    cmsv6Socket.on('close', () => {
        console.log(`[#${id}] CMSV6 disconnected`);
        if (logger) logger.close();
        dashcamSocket.destroy();
    });

    cmsv6Socket.on('error', (err) => {
        console.log(`[#${id}] CMSV6 error: ${err.message}`);
        if (logger) logger.close();
        dashcamSocket.destroy();
    });

    // Timeout 5 menit tidak ada data dari dashcam
    dashcamSocket.setTimeout(300000);
    dashcamSocket.on('timeout', () => {
        console.log(`[#${id}] DASHCAM timeout (5 menit tidak ada data)`);
        dashcamSocket.destroy();
    });
});

server.on('error', (err) => {
    console.error('[SERVER ERROR]', err.message);
});

server.listen(CONFIG.listen.port, CONFIG.listen.host, () => {
    console.log('================================');
    console.log('MRF700 TRANSPARENT PROXY');
    console.log(`LISTEN : ${CONFIG.listen.host}:${CONFIG.listen.port}`);
    console.log(`CMSV6  : ${CONFIG.cmsv6.host}:${CONFIG.cmsv6.port}`);
    console.log(`LOGS   : ./${CONFIG.log.dir}/`);
    console.log(`TIME   : ${nowTs()}`);
    console.log('================================');
});
