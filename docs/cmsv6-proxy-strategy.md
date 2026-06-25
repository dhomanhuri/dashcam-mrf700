# Strategi CMSV6 Proxy — Intercept & Log

## Latar Belakang

Sebelum bisa membangun backend sendiri yang berbicara langsung dengan MRF700, kita perlu memahami protokol komunikasi yang digunakan. Salah satu cara paling efektif dan non-destruktif adalah dengan **menempatkan Node.js sebagai proxy transparan** di antara device dan server CMSV6 yang sudah berjalan.

---

## Konsep

Teknik ini secara umum disebut **TCP Transparent Proxy** atau **MITM Proxy** (Man-in-the-Middle).

```
MRF700 (device)
      │
      │ TCP connect ke IP proxy
      ▼
┌─────────────────────────────┐
│        Node.js Proxy        │
│                             │
│  ┌─ Terima dari device      │
│  ├─ Simpan ke log ──────────┼──► logs/
│  ├─ Forward ke CMSV6        │
│  │                          │
│  ├─ Terima response CMSV6   │
│  ├─ Simpan ke log ──────────┼──► logs/
│  └─ Forward balik ke device │
└─────────────────────────────┘
      │
      │ Forward ke CMSV6 original
      ▼
  CMSV6 Server (port asli)
```

**Device** tidak tahu ada perantara — tetap berjalan normal.  
**CMSV6** tidak tahu ada perantara — tetap menerima data.  
**Node.js** diam-diam membaca dan mencatat semua yang lewat.

---

## Alur Komunikasi Detail

```
1. Device boot → connect TCP ke IP proxy (Node.js)

2. Node.js terima koneksi dari device
   └─ Buka koneksi baru ke CMSV6

3. Device kirim packet (login, GPS, alarm, dll)
   └─ Node.js simpan ke log (hex + ascii + binary)
   └─ Node.js forward byte-for-byte ke CMSV6

4. CMSV6 kirim response
   └─ Node.js simpan ke log
   └─ Node.js forward balik ke device

5. Siklus berlanjut: heartbeat, GPS interval, event...
   └─ Semua lewat proxy, semua dicatat
```

---

## Keuntungan Metode Ini

### Non-Destructive
Tidak ada perubahan pada operasional dashcam. Device tetap connect ke server, data GPS tetap masuk ke CMSV6, semua fitur existing tetap berjalan.

### Capture Context Lengkap
Berbeda dengan hanya listen di port kosong, proxy menangkap **siklus request-response** secara utuh:
- Tahu packet apa yang dikirim device
- Tahu response apa yang diharapkan device dari server
- Tahu urutan komunikasi yang benar (login → auth → GPS → heartbeat)

### Passive Logging
Node.js hanya **membaca dan meneruskan** — tidak memodifikasi byte apapun. Ini penting agar device tidak disconnect karena response yang salah.

### Trigger Event Secara Natural
Karena device tetap berjalan normal, semua jenis packet bisa tertangkap secara alami:
- Packet GPS setiap interval
- Packet alarm saat ada event (benturan, ADAS, DMS)
- Packet video/snapshot saat diminta dari CMSV6
- Packet OTA jika ada update
- Packet voice call

---

## Persiapan

### 1. Setup CMSV6
CMSV6 tetap berjalan di mesin yang sama atau mesin lain. Catat IP dan port aslinya.

Contoh konfigurasi umum CMSV6:
```
IP   : 192.168.1.100  (atau IP publik)
Port : 6688           (port default CMSV6)
```

### 2. Konfigurasi Device
Di menu konfigurasi MRF700, ubah server tujuan ke Node.js proxy:

```
Protocol : CMSV6
Server IP: <IP_PROXY_NODE>
Port     : 6688           (sama dengan port yang di-listen proxy)
```

### 3. Jalankan Proxy
Node.js proxy listen di port yang sama, lalu forward ke CMSV6 asli.

---

## Struktur Log yang Dihasilkan

```
logs/
└── device/
    └── 663065697201/
        └── 2026-06-25/
            └── session-001/
                ├── meta.json          # Info sesi (device, IP, waktu)
                ├── merged.log         # Semua packet berurutan (IN + OUT)
                ├── device.log         # Packet dari device saja
                ├── server.log         # Response dari CMSV6 saja
                └── raw/
                    ├── 0001_IN.bin    # Binary mentah
                    ├── 0001_IN.hex    # Hex dump
                    ├── 0002_OUT.bin
                    └── ...
```

Format setiap entry di log:

```
[2026-06-25T14:00:00.123Z] [IN ] [663065697201] HEX: 2424dc0269...
[2026-06-25T14:00:00.456Z] [OUT] [663065697201] HEX: 202000...
```

---

## Posisi dalam Roadmap

Metode proxy ini adalah **strategi optimal untuk fase V1 dan V2**:

| Phase | Metode | Output |
|-------|--------|--------|
| **V1 Raw Logger** | Proxy CMSV6 | Library packet lengkap semua tipe |
| **V2 Classifier** | Analisis log V1 | Kelompokkan packet by tipe |
| **V3 Parser** | Bangun dari V2 | Decode packet → JSON |
| **V4 Backend** | Tanpa CMSV6 | Backend sendiri handle semua |
| **V5 Dashboard** | Tanpa CMSV6 | Dashboard sendiri |

Setelah V3 selesai dan kamu sudah paham seluruh struktur packet, proxy tidak diperlukan lagi. Backend kamu sendiri yang menggantikan peran CMSV6.

---

## Perbedaan dengan Pendekatan JT808

| Aspek | CMSV6 Proxy | JT808-2019 Langsung |
|-------|-------------|---------------------|
| CMSV6 masih jalan? | ✅ Ya | ❌ Tidak perlu |
| Perlu decode manual? | ❌ Belum perlu | ✅ Langsung decode |
| Cocok untuk fase | V1 (capture) | V3+ (production) |
| Risiko | Sangat rendah | Perlu validasi dulu |
| Kualitas data capture | Sangat tinggi | - |

**Rekomendasi:** Gunakan CMSV6 Proxy untuk **membangun library packet** dulu. Setelah library lengkap, pindah ke JT808 langsung untuk production backend.

---

## Catatan Keamanan

- Proxy berjalan di jaringan sendiri / server sendiri
- Tidak ada modifikasi pada device atau server CMSV6
- Log berisi data operasional kendaraan — simpan dengan aman
- Jangan expose port proxy ke publik tanpa firewall

---

## Kesimpulan

CMSV6 Proxy adalah jembatan yang paling efisien menuju kemandirian backend. Dengan metode ini, kamu mendapatkan **dataset packet yang lengkap dan valid** tanpa risiko mengganggu operasional, yang kemudian menjadi fondasi untuk membangun parser dan backend sendiri.

> **Proxy ini bukan tujuan akhir — ini adalah alat pengumpul data untuk fase R&D.**
