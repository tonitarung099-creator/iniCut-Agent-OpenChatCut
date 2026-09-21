# MiniCut Agent — Portable Indonesia

MiniCut Agent adalah turunan yang dimodifikasi dari [OpenChatCut](https://github.com/0xsline/OpenChatCut) untuk kebutuhan editor video lokal dengan AI Agent.

## Target proyek

- Windows **portable folder**: unduh ZIP/artifact, ekstrak seluruh folder, lalu jalankan `MiniCut.exe` tanpa installer.
- Antarmuka utama **Bahasa Indonesia**.
- Tidak ada pilihan bahasa Mandarin/Rusia/Italia di UI.
- Gemini dipertahankan sebagai provider AI utama dan akan dikembangkan lebih lanjut sebagai agent pengendali editor.
- Distribusi berisi banyak file/folder runtime di samping `MiniCut.exe`; ini sengaja agar lebih sederhana, cepat dibangun, dan mudah diperbaiki daripada single-file EXE.
- Data aplikasi portable disimpan di subfolder `data/` di folder aplikasi, bukan dipaksa ke Program Files.
- Fondasi editor tetap mengikuti OpenChatCut agar timeline, agent tools, media, caption, export, dan MCP tidak dibangun ulang dari nol.

## Cara kerja repository ini

Repository ini menggunakan model **overlay build**. GitHub Actions mengambil OpenChatCut pada commit upstream yang dipatok, lalu menjalankan modifikasi MiniCut dari folder `overrides/` dan `patches/`.

Upstream yang dipatok saat ini:

```
0xsline/OpenChatCut
commit 07437f60257a578745262359753bfccce337510c
```

Model ini membuat perubahan MiniCut terpisah dan mudah diaudit tanpa mencampur seluruh riwayat upstream.

## Build portable

Workflow: `.github/workflows/build-portable.yml`

Hasil yang diharapkan adalah artifact ZIP **MiniCut-Portable-Windows-x64**. Setelah diekstrak, strukturnya berbentuk folder aplikasi, bukan single-file EXE:

```text
MiniCut/
├── MiniCut.exe
├── resources/
├── locales/
├── data/
├── BACA_SAYA.txt
└── file runtime/DLL pendukung lainnya
```

Cara pakai: ekstrak ZIP sampai selesai, buka folder `MiniCut`, lalu jalankan `MiniCut.exe`. Jangan memisahkan EXE dari file pendukungnya dan jangan menjalankan aplikasi langsung dari dalam ZIP.

Folder `data/` berada di samping executable dan dipakai untuk konfigurasi, cache, log, project/runtime state, dan data portable lainnya. Untuk memindahkan MiniCut ke lokasi atau komputer lain, salin seluruh folder `MiniCut`.

## Bahasa

MiniCut mengunci UI ke Bahasa Indonesia. Sistem terjemahan MiniCut memakai kamus Inggris upstream hanya sebagai sumber makna internal; teks Mandarin tidak dipakai sebagai fallback tampilan. String yang belum memiliki padanan aman tidak boleh jatuh kembali ke Mandarin.

Istilah teknis/nama produk seperti Gemini, API, FFmpeg, FPS, SRT, MCP, GPU, JSON, MP4, dan nama model tetap dipertahankan.

## Lisensi dan atribusi

OpenChatCut berlisensi GNU AGPL v3 atau versi lebih baru. Modifikasi MiniCut mengikuti lisensi yang sama. Lihat `LICENSE` dan `NOTICE.md`.

> Status: fondasi portable-folder + penguncian Bahasa Indonesia sedang dibangun dan diuji otomatis. Fitur MiniCut khusus akan ditambahkan bertahap di atas basis ini.
