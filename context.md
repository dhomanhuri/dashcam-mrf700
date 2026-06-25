# MRF700 - Open Telematics Platform

## Project Goal

R&D AI Dashcam MRF700 untuk membangun **backend telematika sendiri** dan **dashboard sendiri**.

Bukan clone CMSV6. Bukan serangan ke vendor.

Target arsitektur:
```
MRF700
 │
 ▼
Adapter / Parser
 │
 ▼
Core Backend
 │
 ├── GPS
 ├── AI Event
 ├── Alarm
 ├── Live Stream
 ├── Playback
 ├── Voice
 ├── Snapshot
 ├── Video
 ├── Analytics
 └── REST API
```

---

## Device Info

| Field | Value |
|-------|-------|
| Model | MRF700 |
| Device Name | DT35115XC |
| Device ID / IMEI | 663065697201 |
| Firmware | AO24030151.24566 |
| Software | V6.1.54 20200928 |
| Platform | Linux 4.19.73 |
| Bootloader | U-Boot 2016.11 |
| CPU | ARMv7 Dual Core |
| RAM | 256MB |
| Flash | SPI NAND ±256MB |

---

## Progress

### ✅ UART
- Header ditemukan: G / T / R
- TTL 3.3V
- Boot log berhasil dibaca

### ✅ Streaming WiFi Internal
- Output: H264 Raw
- Berhasil via ffplay, Browser, JMuxer
- Dual camera CH1 + CH2
- Delay ±1 detik
- Tanpa ffmpeg

### ✅ CMSV6 Database Access
- Engine: gpsmysqld.exe port 3311
- Database: 1010gps, information_schema, mysql
- Login MySQL berhasil

### ✅ Reverse Javascript
- Framework: BabelStar
- Encryption ditemukan
- Function: `window.enEncrycrypt()` / `window.deEncrycrypt()`
- Response berhasil didecrypt

### ✅ GSM RAW
- NodeJS menerima koneksi langsung dari SIM Card
- Port: 9088
- Packet pertama: `$$dc0269...`
- Root cause awal gagal: port public belum dibuka (NAT)

### ✅ Logger V1
- Terima packet
- Simpan ASCII, HEX, RAW Binary
- Session log
- Struktur: `logs/device/date/session/` + `merged.log`, `dashcam.log`, `cmsv6.log`, `meta.json`
- **Belum parsing, belum decode**

---

## Keputusan Arsitektur

### Protocol CMSV6
- Proprietary, packet awal `$$dc0269`
- Bukan JT808
- **Tidak menjadi fokus lagi**

### Protocol JT808
- Firmware native mendukung pilihan:
  - Close
  - CMSV6
  - JT808-2013-M1
  - **JT808-2019-M1** ← fokus saat ini
- Standar lebih baru, terdokumentasi, mudah dikembangkan

---

## Hipotesis Aktif

Jika protocol diubah ke `JT808-2019-M1`:

- **Kemungkinan A:** Packet masih `$$dc0269` → firmware hanya ganti label
- **Kemungkinan B:** Packet jadi `7E ...` → benar-benar JT808

Eksperimen berikutnya: ganti protocol → jalankan Logger → lihat packet pertama.

---

## Urutan Capture Target (setelah connect JT808)

Jangan parsing dulu. Kumpulkan semua packet dulu:

1. Login
2. Heartbeat
3. GPS
4. ACC ON
5. Vehicle Running
6. Alarm
7. ADAS
8. DMS
9. Snapshot
10. Video
11. Playback
12. Voice
13. OTA
14. Remote Config

Semua disimpan sebagai **library packet**.

---

## Roadmap

| Phase | Nama | Target |
|-------|------|--------|
| V1 | Raw Logger | Kumpulkan seluruh packet (done sebagian) |
| V2 | Classifier | Kelompokkan by tipe (Login, GPS, Alarm, Video, dll) |
| V3 | Parser | Ubah packet → JSON |
| V4 | Backend | Core Telematics Platform |
| V5 | Dashboard | Dashboard sendiri, bukan CMSV6 |

---

## Arsitektur Target (Modular)

```
Adapter Layer
├── MRF700 (JT808)
├── Future Device A
└── Future Device B
        │
        ▼
   Core Backend
        │
        ▼
      REST API
        │
        ▼
    Dashboard
```

Core backend tidak berubah saat tambah device baru — cukup tambah adapter.

---

## Status Saat Ini

**Fokus:** Verifikasi apakah mode JT808-2019-M1 menghasilkan frame JT808 standar.

Jika iya → seluruh pengembangan mengikuti standar JT808, bukan proprietary CMSV6.
