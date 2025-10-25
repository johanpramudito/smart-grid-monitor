# Smart Grid Monitor

#### Capstone A_03: Smart Grid Monitor

Smart Grid Monitor adalah prototipe platform pemantauan jaringan listrik berbasis Next.js. Aplikasi ini menyediakan dashboard untuk melihat status zona distribusi, menerima telemetri perangkat lapangan (STM32 + ESP-01), serta menjalankan perhitungan FLISR (Fault Location, Isolation, and Service Restoration) awal.

## Fitur Utama

- Dashboard interaktif untuk status zona, topologi jaringan, dan log kejadian.
- API REST untuk registrasi perangkat, pengiriman telemetri, statistik dashboard, serta layanan FLISR.
- Skema PostgreSQL yang mendukung agen zona, perangkat, pembacaan sensor, dan rencana restorasi.
- Skrip utilitas `register-device` untuk membuat API key perangkat lapangan.

## Prasyarat

1. Node.js 18 atau lebih baru.
2. npm (atau pnpm/bun, gunakan salah satu saja).
3. PostgreSQL 14+ dengan akses `psql`.
4. OpenSSL (opsional) bila ingin membangkitkan string acak dari CLI.

## Langkah Instalasi

1. **Kloning repositori**
   ```bash
   git clone https://github.com/johanpramudito/smart-grid-monitor/
   cd smart-grid-monitor
   ```
2. **Salin konfigurasi lingkungan**
   ```bash
   cp .env.example .env
   ```
   Isi variabel:
   - `DATABASE_URL` berisi connection string PostgreSQL.
   - `AUTH_SECRET` adalah string acak panjang untuk menandatangani cookie sesi.
3. **Pasang dependensi JavaScript**
   ```bash
   npm install
   ```
4. **Siapkan basis data**  
   Buat database kosong sesuai nama di `DATABASE_URL`, lalu jalankan skrip inisialisasi:
   ```bash
   psql "$DATABASE_URL" -f sql/init.sql
   ```

## Menjalankan Mode Pengembangan

```bash
npm run dev
```

Aplikasi akan tersedia di `http://localhost:3000`. Untuk build produksi gunakan `npm run build` diikuti `npm run start`. Jalankan pemeriksaan linting dengan `npm run lint`.

## Menggunakan Skrip register-device

Skrip `scripts/register-device.js` membantu operator membuat perangkat baru sekaligus API key yang akan dipasang pada firmware.

1. Pastikan database sudah terisi data zona (`ZoneAgent`) sehingga Anda memiliki `zone_agent_id`. Apabila belum ada, bisa coba jalankan
   ```bash
   psql "$DATABASE_URL" -f sql/prototype.sql
   ```
   untuk mendapatkan random `zone_agent_id`.
2. Pastikan variabel `DATABASE_URL` di `.env` mengarah ke database yang sama dengan aplikasi.
3. Jalankan skrip:
   ```bash
   node scripts/register-device.js
   ```
4. Ikuti prompt:
   - `ZoneAgent ID (UUID)`: masukkan UUID zona tempat perangkat berada.
   - `Device name (optional)`: isi nama perangkat atau biarkan kosong.
   - `Firmware version (optional)`: isi versi firmware atau kosongkan.
5. Skrip akan:
   - Membuat API key acak dengan format `sgm_<id>_<secret>`.
   - Meng-hash API key menggunakan scrypt, lalu menyimpannya pada tabel `"DeviceAgent"`.
   - Menampilkan informasi `device_id`, `zone_agent_id`, `name`, `firmware`, dan API key **sekali saja** di terminal.
6. Simpan API key tersebut pada perangkat/bridge STM32 Anda; kunci tidak akan ditampilkan ulang.

Jika terjadi kegagalan koneksi atau validasi (misalnya panjang password kurang dari 8 karakter), skrip akan menghentikan eksekusi dan menampilkan pesan galat.

## Menguji Telemetri Perangkat

Gunakan API key dari skrip di atas untuk mengirim telemetri percobaan:

```bash
curl -X POST http://localhost:3000/api/device/telemetry \
  -H "X-Api-Key: sgm_xxxx_xxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"status":"NORMAL","voltage":229.7,"current":8.12}'
```

Pembacaan akan muncul di dashboard zona (`/dashboard/zones/<id>`) dan memperbarui status perangkat.

## Dokumentasi Tambahan

- `sql/prototype.sql` dan `sql/delete-device.sql` menyediakan contoh query tambahan untuk eksperimen.
