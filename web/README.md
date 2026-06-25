# MRF700 Telematics Dashboard

Open Telematics Platform untuk dashcam MRF700.

## Ports

| Service | Port | Keterangan |
|---------|------|-----------|
| Web Dashboard | 3500 | Frontend Next.js |
| REST API / WebSocket | 3501 | Backend Express.js |
| TCP Device | 9088 | Terima packet dari MRF700 |
| PostgreSQL | internal | Tidak expose ke host |

## Cara Deploy

```bash
cd /root/.openclaw/workspace/hobby/mrf700/web
docker compose up -d --build
```

## Cara Stop

```bash
docker compose down
```

## Cara Lihat Log

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Konfigurasi Device

Arahkan device MRF700 ke:
- Server IP: <IP_SERVER>
- Port: 9088
- Protocol: JT808-2019-M1

## API Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | /health | Health check |
| GET | /api/devices | List semua device |
| GET | /api/devices/:id | Detail device |
| GET | /api/devices/:id/gps/latest | GPS terakhir |
| GET | /api/devices/:id/gps/history | History GPS |
| GET | /api/devices/:id/events | List event/alarm |
| GET | /api/packets | Raw packet log |
| GET | /api/packets/stats | Statistik packet |

## WebSocket Events

Koneksi ke `ws://localhost:3501`

| Event | Payload |
|-------|---------|
| GPS_UPDATE | `{ type, deviceId, data: { lat, lng, speed, direction, accOn, timestamp } }` |
| DEVICE_OFFLINE | `{ type, deviceId }` |
