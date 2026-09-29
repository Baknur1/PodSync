# PodSync

<p align="center">
  <img src="https://images.unsplash.com/photo-1514525253361-b83f859b73c0?w=1200" alt="PodSync Banner" width="100%" style="border-radius: 14px;" />
</p>

<p align="center">
  <strong>The ultimate high-performance desktop bridge connecting Apple Music, YouTube, and classic hardware Apple iPods.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-41.x-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Audio-Apple_AAC_256k-FA2D48?style=for-the-badge&logo=apple-music&logoColor=white" alt="Apple AAC" />
  <img src="https://img.shields.io/badge/Hardware-Apple_iPod-8E8E93?style=for-the-badge&logo=apple&logoColor=white" alt="Apple iPod" />
  <img src="https://img.shields.io/badge/Database-SQLite_WAL-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite WAL" />
</p>

---

## ⚡ Performance Benchmark (Real-World Test)

During full stress testing on large Apple Music libraries:
> **325 songs were matched, downloaded, converted to Apple AAC (256 kbps), tagged with HD covers & lyrics, and synchronized to a hardware iPod in just 11 minutes.**

### Processing Pipeline:
1. **Track Matching:** Second-by-second duration matching against official YouTube Music studio releases (*Topic* & *VEVO*).
2. **Multithreaded Downloader:** Parallel download streams (4 to 16 concurrent workers) extracting highest-fidelity audio streams.
3. **Studio-Grade Transcoding:** Real-time encoding into pristine Apple AAC (256 kbps) or MP3 (320 kbps) using an optimized `ffmpeg` binary.
4. **Metadata & Lyrics Tagging:** Embedding complete ID3/MP4 tags (Artist, Title, Album, Album Artist, Year, Track/Disc numbers, Genre, 600x600 HD artwork, and synced lyrics).
5. **iTunes & iPod Synchronization:** Automated COM integration and native `iTunesDB` binary updates with zero duplicate files.

---

## ✨ Complete Feature Breakdown

### 🎵 1. Apple Music Cloud Integration
* **1-Click Official Web Login:** Securely log in with your Apple ID via an official embedded web modal (`music.apple.com`). Tokens (`media-user-token` and Developer Bearer token) are captured and persisted automatically — **no `.env` file or developer keys required**.
* **Full Library Sync:** Browse your Apple Music songs, curated playlists, albums, and favorite tracks.
* **Atomic Session Storage:** Safe multi-layer session persistence with atomic JSON store, backup recovery, and SQLite caching.
* **DNS Fallback Dispatcher:** Custom `undici` agent with public DNS fallback (Google `8.8.8.8`, Cloudflare `1.1.1.1`, Yandex `77.88.8.8`) ensures reliable connectivity even on restricted corporate or university networks.

### 🔍 2. Smart YouTube & YouTube Music Engine
* **Direct YouTube Search:** Search and audition any track on YouTube in real time and add it directly to the sync queue.
* **Studio Releases Priority:** Automatically filters out live concerts, acoustic covers, slowed/reverb edits, and 10-hour loop videos.
* **Exact Duration Matching:** Compares Apple Music duration against audio streams with second-level precision.
* **Automated `yt-dlp` Lifecycle:** Built-in auto-download and update manager for the `yt-dlp` binary.

### 🎙️ 3. LRCLIB Lyrics Engine
* **Automated Lyrics Fetching:** Queries the open-source LRCLIB database for synchronized and plain-text lyrics.
* **Hardware iPod Scrolling:** Embeds lyrics into M4A/MP3 tags so they can be read directly on iPod screens by pressing the Center Click Wheel button during playback.
* **In-App Lyrics Viewer:** Apple Music-style lyrics overlay modal with stanza highlighting, one-click copy to clipboard, and manual refresh.

### 📱 4. Deep Hardware iPod Support & Reverse Export
* **Wide Device Support:** Compatible with iPod Classic (5th, 5.5th, 6th, 7th Gen), iPod Video, iPod nano (1st–6th Gen), iPod Mini, and iPod Shuffle.
* **Native `iTunesDB` Binary Parser:** High-speed parsing of `mhbd`, `mhsd`, `mhlt`, `mhlp`, and `mhit` chunk records directly from the iPod's filesystem.
* **Hash58 Checksum Engine:** Native SHA-1 cryptographic signature computation for 5th/6th Gen iPod firmware validation to prevent database corruption.
* **iPod Reverse Export (iPod → PC):** Export tracks and playlists from an attached iPod back to your PC with clean directory organization (`Artist / Album / Track - Title.m4a`) and preserved HD artwork.
* **Interactive Capacity Bar:** Segmented storage indicator (*Audio*, *Other*, *Free Space*) with precise tooltip hover metrics and safe device ejection.

### ⚡ 5. Sync Queue & Batch Management
* **Configurable Concurrency:**
  * **4 Streams:** Standard / Low CPU mode for laptops.
  * **8 Streams (Default):** Fast and balanced mode for everyday syncing.
  * **12 Streams ⚡:** Turbo mode for batch syncing hundreds of tracks.
  * **16 Streams ⚡:** Maximum performance for multicore systems.
* **Smart Deduplication:** Songs shared across multiple playlists are downloaded once and mapped to all respective iPod playlists.
* **Playlist Group Controls:** Collapsible queue groups, batch playlist renaming, and individual track management.
* **Batch Selection Floating Island:** Multi-track checkbox selection bar with 1-click queue export and instant deselect.

### 🎧 6. Built-in Retro LCD Player
* **0ms Latency Playback:** Stream local cached files, attached iPod audio, and YouTube previews instantly.
* **Queue-Bound Navigation:** Next, Previous, Shuffle, and Repeat controls bound strictly to the active playlist or album context.
* **HD Artwork Resolution:** Dynamic resolution of official 600x600 album artwork with smooth gradient backdrops.

### 🌐 7. Internationalization (i18n)
* **Full Multi-Language Support:** Seamlessly switch between **English** and **Русский** in Settings with reactive UI updates across all views.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Shell & Runtime** | Electron 41 | Cross-platform desktop runtime with native filesystem, COM automation, and privileged schemes |
| **Frontend** | React 19 + Vite | Ultra-fast reactive single-page application with sub-second hot reload |
| **Styling** | Tailwind CSS v4 + Vanilla CSS | Dark mode UI inspired by Apple Music, macOS Tahoe, and vintage iPod LCD displays |
| **Database** | SQLite (`better-sqlite3`) | WAL-mode local database for lightning-fast caching, song indices, and state tracking |
| **Downloader** | `yt-dlp` | Audio extraction pipeline capturing the highest available audio stream |
| **Transcoder** | `ffmpeg` | Apple AAC (256/320 kbps) encoding, faststart atom optimization, and metadata tagging |
| **iPod Sync** | PowerShell + iTunes COM + `iTunesDB` | Direct synchronization into iTunes, local directories, and hardware iPod filesystems |
| **Lyrics API** | LRCLIB | Open-source lyrics database integration with auto-tagging |
| **Cloud API** | Apple Music API (MusicKit) | Accessing user cloud libraries, personal playlists, and album metadata |

---

## 🚀 Getting Started

### Prerequisites
* **Windows 10 / 11**
* **Node.js** (v18+ or v20+)
* **iTunes for Windows** (Official desktop version for COM automation)

### 1. Clone the repository
```bash
git clone https://github.com/Baknur1/PodSync.git
cd PodSync
```

### 2. Install dependencies
```bash
npm install
```

### 3. Launch in development mode
```bash
npm run dev
```

### 4. Build for production
```bash
npm run build
```

---

## 📁 Project Structure

```
PodSync/
├── src/
│   ├── main/
│   │   ├── index.js                  # Electron main process, IPC handlers, DNS dispatcher
│   │   ├── preload.js                # Secure context bridge API
│   │   ├── db.js                     # SQLite WAL schema, queries, and cache migrations
│   │   └── modules/
│   │       ├── apple-music.js        # Apple Music API integration (catalog, library, search)
│   │       ├── converter.js          # FFmpeg transcode pipeline & metadata injection
│   │       ├── downloader.js         # yt-dlp downloader management & audio stream extractor
│   │       ├── hash58.js             # iPod Hash58 firmware checksum generator
│   │       ├── ipod-db.js            # Binary parser & reader for iPod iTunesDB
│   │       ├── ipod-detector.js      # Hardware drive scanner and iPod model identification
│   │       ├── ipod-export.js        # Reverse sync engine (iPod → Computer)
│   │       ├── itunes-sync.js        # PowerShell iTunes COM sync automation
│   │       ├── lyrics-service.js     # LRCLIB API client and lyrics tagger
│   │       └── session-manager.js    # Atomic session persistence & cookie interception
│   └── renderer/
│       ├── App.jsx                   # Main React application component
│       ├── i18n.js                   # English & Russian localization dictionaries
│       ├── main.jsx                  # React DOM entry point
│       └── index.css                 # Apple dark theme, custom scrollbars, animations
├── package.json
└── vite.config.js
```

---

## 📄 License

MIT License © 2026 PodSync. Crafted with precision for vintage sound enthusiasts and hardware Apple iPod collectors.
