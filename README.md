# 🚛 MRF700 Open Telematics Platform

Platform telematika open-source untuk dashcam **MRF700** berbasis protokol **JT808-2019**.

Dibangun dengan tujuan memiliki backend dan dashboard sendiri — **bukan clone CMSV6**.

---

## 📐 Arsitektur

```
MRF700 (SIM Card)
      │
      ▼ TCP :9088 (JT808-2019)
┌─────────────────┐
│  Backend        │  Node.js + Express
│  ├─ TCP Server  │  Terima & parse packet JT808
│  ├─ REST API    │  :3501
│  └─ WebSocket   │  Realtime push ke frontend
└────────┬────────┘
         │
    PostgreSQL
         │
┌────────▼────────┐
│  Frontend       │  Next.js + Leaflet
│  ├─ Peta GPS    │  :3500
│  ├─ Status      │
│  └─ Event log   │
└─────────────────┘
```

---

## 🧰 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14, TailwindCSS, Leaflet.js |
| Backend | Node.js, Express.js, WebSocket (ws) |
| Database | PostgreSQL 16 |
| Protocol | JT808-2019-M1 |
| Container | Docker, Docker Compose |

---

## 📦 Struktur Project

```
dashcam-mrf700/
├── README.md
├── context.md              # Catatan R&D dan progress
├── web/
│   ├── docker-compose.yml  # Orchestration semua service
│   ├── .env                # Konfigurasi environment
│   ├── database/
│   │   └── init.sql        # Schema PostgreSQL
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.js           # Entry point
│   │       ├── db.js               # Koneksi PostgreSQL
│   │       ├── tcp/server.js       # TCP server JT808
│   │       ├── parser/jt808.js     # JT808 packet parser
│   │       └── routes/
│   │           ├── devices.js      # API devices & GPS
│   │           └── packets.js      # API raw packet log
│   └── frontend/
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── pages/index.tsx     # Dashboard utama
│           ├── components/         # UI components
│           └── lib/api.ts          # API client
```

---

## ⚙️ Konfigurasi `.env`

Buat file `.env` di folder `web/`:

```bash
cp web/.env web/.env.local  # opsional, atau edit langsung
```

Isi `web/.env`:

```env
# ─── PostgreSQL ───────────────────────────────────────────
POSTGRES_DB=mrf700
POSTGRES_USER=mrf700
POSTGRES_PASSWORD=mrf700pass          # Ganti dengan password kuat
DATABASE_URL=postgresql://mrf700:mrf700pass@db:5432/mrf700

# ─── Backend ──────────────────────────────────────────────
PORT=3501                             # Port REST API & WebSocket
TCP_PORT=9088                         # Port terima packet dari device
NODE_ENV=production

# ─── Frontend ─────────────────────────────────────────────
# Ganti localhost dengan IP publik server jika diakses dari luar
NEXT_PUBLIC_API_URL=http://localhost:3501
NEXT_PUBLIC_WS_URL=ws://localhost:3501
```

> **Penting:** Jika dashboard diakses dari browser di luar server (bukan localhost), ganti `localhost` di `NEXT_PUBLIC_API_URL` dan `NEXT_PUBLIC_WS_URL` dengan IP publik atau domain server kamu.

---

## 🚀 Getting Started

### Prasyarat

- Docker Engine ≥ 24.x
- Docker Compose v2
- Port `3500`, `3501`, `9088` tidak terpakai di host

Cek port:
```bash
ss -tlnp | grep -E '3500|3501|9088'
```

---

### 1. Clone repository

```bash
git clone https://github.com/dhomanhuri/dashcam-mrf700.git
cd dashcam-mrf700
```

---

### 2. Buat file `.env`

```bash
cd web
cp .env .env.backup   # backup default
nano .env             # edit sesuai kebutuhan
```

Minimal yang perlu diganti:
- `POSTGRES_PASSWORD` → password PostgreSQL
- `DATABASE_URL` → sesuaikan dengan password di atas
- `NEXT_PUBLIC_API_URL` → IP server jika diakses dari luar

---

### 3. Build & jalankan

```bash
cd web
docker compose up -d --build
```

Proses build pertama kali ±2–3 menit (download image + compile Next.js).

---

### 4. Verifikasi

```bash
# Cek semua container berjalan
docker compose ps

# Cek API backend
curl http://localhost:3501/health

# Cek list device
curl http://localhost:3501/api/devices
```

Output health check:
```json
{"status":"ok","timestamp":"2026-06-25T..."}
```

---

### 5. Buka Dashboard

Buka browser:
```
http://localhost:3500
```

Atau jika diakses dari luar server:
```
http://<IP_SERVER>:3500
```

---

## 📡 Konfigurasi Device MRF700

Di menu konfigurasi dashcam MRF700, isi:

| Field | Value |
|-------|-------|
| Protocol | `JT808-2019-M1` |
| Server IP | `<IP_SERVER_KAMU>` |
| Port | `9088` |

Setelah device connect, akan otomatis muncul di dashboard.

---

## 🔌 API Endpoints

Base URL: `http://localhost:3501`

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/api/devices` | List semua device |
| GET | `/api/devices/:id` | Detail device |
| GET | `/api/devices/:id/gps/latest` | GPS posisi terakhir |
| GET | `/api/devices/:id/gps/history` | History GPS (query: `from`, `to`, `limit`) |
| GET | `/api/devices/:id/events` | List event & alarm |
| GET | `/api/packets` | Raw packet log (query: `device_id`, `limit`) |
| GET | `/api/packets/stats` | Statistik packet per tipe |

### Contoh request

```bash
# GPS terakhir
curl http://localhost:3501/api/devices/663065697201/gps/latest

# History GPS 1 jam terakhir
curl "http://localhost:3501/api/devices/663065697201/gps/history?from=2026-06-25T00:00:00Z&limit=200"

# Statistik packet
curl http://localhost:3501/api/packets/stats
```

---

## 🔄 WebSocket Realtime

Koneksi WebSocket ke `ws://localhost:3501`

Event yang dikirim ke client:

```json
// GPS update realtime
{
  "type": "GPS_UPDATE",
  "deviceId": "663065697201",
  "data": {
    "lat": -6.208763,
    "lng": 106.845123,
    "speed": 45.5,
    "direction": 90,
    "accOn": true,
    "timestamp": "2026-06-25T14:00:00Z"
  }
}

// Device offline
{
  "type": "DEVICE_OFFLINE",
  "deviceId": "663065697201"
}
```

---

## 🛠️ Manajemen Container

```bash
# Lihat status
docker compose ps

# Lihat log realtime
docker compose logs -f backend
docker compose logs -f frontend

# Restart service tertentu
docker compose restart backend

# Stop semua
docker compose down

# Stop + hapus volume (reset database)
docker compose down -v

# Update setelah ada perubahan kode
docker compose up -d --build
```

---

## 🗺️ Roadmap

| Phase | Status | Deskripsi |
|-------|--------|-----------|
| V1 - Raw Logger | ✅ Done | Terima & simpan packet mentah |
| V2 - Parser | ✅ Done | Parse JT808 → JSON (GPS, heartbeat, register) |
| V3 - Backend | ✅ Done | REST API + WebSocket |
| V4 - Dashboard | ✅ Done | Peta GPS realtime + event log |
| V5 - Classifier | 🔄 Next | Klasifikasi event: ADAS, DMS, alarm |
| V6 - Media | 📋 Plan | Live stream, snapshot, playback video |
| V7 - Analytics | 📋 Plan | Grafik kecepatan, trip history, laporan |

---

## 📝 Catatan Protokol

Device MRF700 mendukung beberapa pilihan protokol:
- `Close`
- `CMSV6` — protokol proprietary
- `JT808-2013-M1`
- `JT808-2019-M1` ← **yang digunakan project ini**

JT808 adalah standar terbuka Tiongkok untuk telematics kendaraan. Dokumentasi lengkap tersedia di berbagai sumber publik.

---

## ⚠️ Disclaimer

Project ini murni untuk keperluan R&D dan pembelajaran teknis.
Bukan untuk tujuan komersial, bukan clone vendor, bukan serangan terhadap sistem siapapun.

---

## 📄 License

MIT
