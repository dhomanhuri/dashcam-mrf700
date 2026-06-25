# MRF700 CMSV6 Transparent Proxy

Proxy transparan untuk intercept dan log komunikasi antara MRF700 dan server CMSV6.

## Cara Pakai

### 1. Edit config di `server.js`

```js
const CONFIG = {
    listen: {
        host : '0.0.0.0',
        port : 9088          // Port yang di-listen, arahkan device ke sini
    },
    cmsv6: {
        host : '10.10.0.53', // IP server CMSV6 asli
        port : 6608          // Port server CMSV6 asli
    },
    log: {
        dir : 'logs'         // Folder output log
    }
};
```

### 2. Jalankan

```bash
node server.js
```

### 3. Arahkan device ke proxy

Di konfigurasi MRF700:
- Protocol: `CMSV6`
- Server IP: `<IP_MESIN_PROXY>`
- Port: `9088`

## Struktur Log

```
logs/
└── <device_id>/
    └── <tanggal>/
        └── session0001/
            ├── meta.json       # Info sesi
            ├── merged.log      # Semua packet (IN + OUT) kronologis
            ├── dashcam.log     # Packet dari device saja
            ├── cmsv6.log       # Response dari CMSV6 saja
            └── raw/
                ├── 0001_IN.bin   # Binary mentah dari device
                ├── 0001_OUT.bin  # Binary mentah dari CMSV6
                └── ...
```

## Dependencies

Tidak ada — hanya menggunakan Node.js built-in (`net`, `fs`, `path`).
