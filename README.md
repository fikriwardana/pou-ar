# POU AR SOLO

POU AR SOLO adalah permainan web *Virtual Pet AR* (Augmented Reality) sisi klien yang dibangun menggunakan Vanilla JavaScript, HTML, CSS, dan MediaPipe. Game ini memungkinkan Anda memelihara Pou dan bermain mini-games seru yang dikendalikan sepenuhnya melalui gerakan wajah dan kepala menggunakan kamera perangkat Anda.

## Fitur Utama

- **AR Tracking:** Menggunakan MediaPipe Face Mesh dan Hands untuk melacak gerakan Anda secara *real-time* langsung di *browser* (tanpa pengiriman data ke server).
- **Care Mode:** Pelihara Pou Anda! Beri makan, perhatikan suasana hatinya (mood), tingkat kelaparan (hunger), energi, dan kesenangannya (fun).
- **Mini Games Berbasis Gestur:**
  - **Sky Climber:** Miringkan kepala Anda ke **kiri/kanan** untuk menggerakkan Pou dan memanjat setinggi mungkin.
  - **Head Racing:** Gerakkan **hidung** Anda untuk berbelok dan **angkat alis** Anda untuk *boost* (percepatan)!
  - **Food Fall:** Gerakkan **hidung** Anda untuk memposisikan Pou agar dapat menangkap makanan yang jatuh. **Buka mulut** Anda untuk memperbesar radius tangkapan!
- **Voice Chat:** Integrasi *Gemini API* memungkinkan Anda berinteraksi menggunakan fitur percakapan suara (memerlukan API Key Gemini).
- **Photo Booth:** Abadikan momen bersama Pou Anda! Terdapat fitur hitung mundur, pratinjau, unduh, dan bagikan foto.
- **PWA Ready:** Dibangun sebagai Progressive Web App, sehingga dapat diinstal di perangkat Anda untuk pengalaman seperti aplikasi *native*.

## Teknologi yang Digunakan

- **Frontend:** Vanilla JavaScript, HTML5, CSS3.
- **AR Engine:** MediaPipe (Face Mesh, Hands, Camera Utils, Drawing Utils) diload melalui CDN.
- **Integrasi Pihak Ketiga:** html2canvas (untuk Photo Booth), Google Gemini API (opsional, untuk Voice Chat).
- **Font:** Google Fonts (Outfit).

## Cara Menjalankan Secara Lokal (Development)

Untuk menjalankan proyek ini di perangkat lokal Anda, direkomendasikan menggunakan *local server* agar MediaPipe dan *Service Worker* dapat berjalan dengan baik.

1. Pastikan Anda telah menginstal [Node.js](https://nodejs.org/).
2. Kloning repositori ini.
3. Jalankan *http-server* di direktori *root* repositori:
   ```bash
   npx http-server -p 8080
   ```
4. Buka browser dan kunjungi `http://localhost:8080`.

## Pengujian Headless (untuk CI/CD atau Scripting)

Jika Anda ingin menguji fitur AR/Kamera secara *headless* menggunakan Puppeteer, luncurkan *browser* dengan menambahkan parameter *flag* berikut untuk melakukan *bypass* pada izin kamera dan menyediakan *stream* media tiruan:
```javascript
'--use-fake-ui-for-media-stream',
'--use-fake-device-for-media-stream'
```

## Konvensi Kode (Memori Proyek)

Beberapa prinsip yang diterapkan pada kode ini:
- Menggunakan `addEventListener` alih-alih *inline HTML event handlers* (`onclick`) untuk memisahkan UI dan logika.
- Menyimpan status permainan menggunakan `localStorage` dengan pembatasan (*bounds*) berdasarkan `Date.now()` untuk mencegah *drift* status yang ekstrim saat aplikasi di-*suspend* di latar belakang.
- Menyertakan *deadzones* untuk input gestur dan batasan minimum (*thresholds*) untuk perubahan sebelum menerapkan transformasi CSS demi menghindari *layout thrashing*.
- Pembatasan memori yang ketat pada objek dinamis (seperti partikel dan elemen DOM) untuk mencegah kebocoran memori (memory leak).
- Penanganan khusus untuk koordinat MediaPipe: Menggunakan `1 - x` saat *parsing* data raw *landmarks* karena kanvas visual dicerminkan (*mirrored*).
- Menjaga keandalan kinerja: Memeriksa nilai `null/undefined` dari *landmarks* MediaPipe, membatasi (cap) `deltaTime`, dan menghindari penyalinan (*deep clone*) yang berat di *animation frame*.

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).
Hak Cipta (c) 2026 fikriwardana.
