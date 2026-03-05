[中文](README.zh-CN.md) | English

# TinyVid

A cross-platform video batch compression desktop app built with Tauri 2, React 19 and Rust. Automatically detects and leverages hardware encoders (VideoToolbox, NVENC, QSV, AMF, VAAPI) for maximum performance, with intelligent software fallback.

## Features

- **Batch Compression** — Drag & drop multiple videos, compress them all at once with parallel processing
- **Hardware Acceleration** — Auto-detects GPU encoders and prioritizes them; falls back to software if hardware fails
- **Smart Concurrency** — Chip-aware limits for HW encoding (M4 Ultra: 4, Max: 3, default: 2); CPU cores / 2 for SW encoding
- **Pre-compression Estimation** — Predicts output file size and compression time before you start
- **Real-time Progress** — Live speed multiplier (e.g. 2.5x), ETA, percentage, and file size per task
- **Duplicate Detection** — Warns and auto-skips previously compressed files (files ending in `_compressed.mp4`)
- **Per-task Control** — Cancel individual tasks or all at once
- **Codec Support** — H.265/HEVC and H.264/AVC with configurable CRF quality (18-28)
- **Resolution Scaling** — Original, 1080p, 720p, 480p with GPU-accelerated scale filters
- **Audio Options** — Copy (passthrough) or re-encode to AAC at 320k/256k/128k/96k
- **Task History** — View and search all past compression tasks with status filtering
- **Dark/Light/System Theme** — Glassmorphism design, persisted across sessions
- **Bilingual UI** — English and Simplified Chinese (i18next)
- **Keyboard Shortcuts** — Space/Enter to start, Escape to cancel, R to retry, N for new batch
- **Disk Space Check** — Warns before compression if disk space is insufficient or tight
- **Bundled FFmpeg** — No need to install FFmpeg; binaries are shipped with the app

## Supported Platforms

| Platform | Hardware Encoders | Architecture |
|----------|------------------|--------------|
| macOS | VideoToolbox (H.265/H.264) | Apple Silicon, Intel |
| Windows | NVENC (NVIDIA), QSV (Intel), AMF (AMD) | x86_64 |
| Linux | NVENC (NVIDIA), VAAPI (Intel/AMD) | x86_64, aarch64 |

## Supported Video Formats

MP4, MKV, AVI, MOV, WMV, FLV, WebM, M4V, TS, MTS, M2TS, VOB, MPG, MPEG, 3GP (case-insensitive)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri 2](https://tauri.app/) |
| Frontend | React 19, TypeScript 5.8, Vite 7 |
| Styling | Tailwind CSS 4 (glassmorphism design system) |
| State | Zustand 5 |
| Virtualization | @tanstack/react-virtual |
| i18n | i18next + react-i18next |
| Icons | lucide-react |
| Backend | Rust (edition 2021) |
| Testing | Vitest (frontend), `cargo test` (backend) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- Platform-specific Tauri dependencies — see [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Setup

```bash
# Clone the repository
git clone https://github.com/no1coder/tinyvid.git
cd tinyvid

# Install frontend dependencies
pnpm install

# Download and bundle FFmpeg binaries
./scripts/download-ffmpeg.sh

# Start development
pnpm tauri dev
```

### FFmpeg Bundling

The `scripts/download-ffmpeg.sh` script handles FFmpeg binary preparation for each platform:

| Platform | Source | Notes |
|----------|--------|-------|
| macOS | Homebrew (`brew install ffmpeg`) | Copies binary + 14 dylibs, fixes rpaths, ad-hoc code signs |
| Linux | [johnvansickle.com](https://johnvansickle.com/ffmpeg/) | Static build, no dependencies |
| Windows | [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) | Static build, no dependencies |

```bash
# Auto-detect current platform
./scripts/download-ffmpeg.sh

# Or specify a target triple
./scripts/download-ffmpeg.sh aarch64-apple-darwin
./scripts/download-ffmpeg.sh x86_64-unknown-linux-gnu
./scripts/download-ffmpeg.sh x86_64-pc-windows-msvc
```

Binaries are placed in `src-tauri/binaries/` and bundled as Tauri sidecars.

## Development

```bash
# Frontend dev server only
pnpm dev

# Full Tauri dev (frontend + Rust hot-reload)
pnpm tauri dev

# Run frontend tests
pnpm test

# Run frontend tests in watch mode
pnpm test:watch

# Run Rust tests
cd src-tauri && cargo test

# Build for production
pnpm tauri build
```

## Project Structure

```
tinyvid/
├── src/                          # Frontend (React + TypeScript)
│   ├── App.tsx                   # Main app (4-phase state machine: empty → ready → running → done)
│   ├── components/
│   │   ├── layout/               # AppLayout, Sidebar, ThemeToggle, LanguageSwitch, ToastContainer
│   │   ├── import/               # DropZone, FileTable (virtualized)
│   │   ├── settings/             # SettingsPage, CodecSelector, CrfSlider, ResolutionSelector,
│   │   │                         # AudioBitrateSelector, HardwareToggle, OutputDirSelector,
│   │   │                         # ConcurrencySelector
│   │   └── task/                 # StatsBar, TaskHistoryPage
│   ├── hooks/                    # useCompression, useFileImport, useEstimation, useHardwareInfo,
│   │                             # useNotification, useDiskCheck, useKeyboardShortcuts
│   ├── stores/                   # Zustand stores (appStore, settingsStore, taskStore)
│   ├── lib/                      # Utilities (estimation, format, tauri IPC, constants, cn)
│   └── i18n/locales/             # en.json, zh-CN.json
│
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── commands/             # Tauri IPC command handlers (system, probe, compression)
│   │   ├── ffmpeg/               # FFmpeg args, encoder detection, process, progress parsing
│   │   ├── task/                 # Task manager (chip-aware concurrency), worker (HW→SW fallback)
│   │   └── utils/                # Error types, path resolution (4-step FFmpeg lookup), platform detection
│   ├── binaries/                 # Bundled FFmpeg + dylibs (gitignored)
│   └── tauri.conf.json
│
└── scripts/
    └── download-ffmpeg.sh        # FFmpeg download/bundle script
```

## How It Works

### Compression Pipeline

1. **Probe** — FFprobe extracts video metadata (resolution, codec, duration, bitrate, fps)
2. **Estimate** — CRF-based model predicts output size and time before compression starts
3. **Encode** — FFmpeg compresses with optimal encoder; hardware encoder auto-selected by priority
4. **Fallback** — If hardware encoder fails at runtime, automatically retries with software encoder
5. **Progress** — FFmpeg's `-progress pipe:1` output is parsed in real-time for live stats

### FFmpeg Resolution (4-step priority)

1. Bundled sidecar binary (verified runnable)
2. Executable directory fallback
3. System `PATH` lookup
4. Common install locations (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`)

### Hardware Acceleration Details

| Encoder | Decode | Output Format | Scale Filter |
|---------|--------|---------------|-------------|
| VideoToolbox | Software (faster than HW decode) | — | `scale` (CPU) |
| NVENC | CUDA | `cuda` | `scale_cuda` |
| QSV | QSV | `qsv` | `scale_qsv` |
| AMF | D3D11VA | `d3d11` | `scale` (CPU) |
| VAAPI | VAAPI | `vaapi` | `scale_vaapi` |

> **Why no `-hwaccel` for VideoToolbox?** Testing on M4 Max showed that Apple's HW decoder caps at ~180 fps for 4K HEVC, while multithreaded software decode reaches ~350 fps. Since the VT encoder is the bottleneck (~200 fps), feeding it faster via SW decode yields ~10% better overall throughput.

### Smart Concurrency

- **Hardware encoding**: Chip-aware limits — M4 Ultra: 4 tasks, M4 Max: 3 tasks, other Apple Silicon: 2 tasks
- **Software encoding**: `max(CPU cores / 2, 1)` tasks
- **User override**: Manual selection from Auto, 1, 2, 3, 4, 6, 8

## Tests

```bash
# Run all tests
cd src-tauri && cargo test && cd .. && pnpm test
```

## Build

```bash
# Production build (creates platform-specific installer)
pnpm tauri build
```

Output locations:
- **macOS**: `src-tauri/target/release/bundle/dmg/TinyVid_0.1.0_aarch64.dmg`
- **Windows**: `src-tauri/target/release/bundle/nsis/TinyVid_0.1.0_x64-setup.exe`
- **Linux**: `src-tauri/target/release/bundle/deb/tinyvid_0.1.0_amd64.deb`

## Installation Notes

### macOS — "TinyVid is damaged and can't be opened"

Since the app is not signed with an Apple Developer certificate, macOS Gatekeeper may block it. After installing, run the following command in Terminal:

```bash
sudo xattr -cr /Applications/TinyVid.app
```

Then open the app normally. This only needs to be done once.

### Windows

Run the `.exe` installer. If Windows SmartScreen shows a warning, click **"More info"** → **"Run anyway"**.

## License

MIT
