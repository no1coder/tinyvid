中文 | [English](README.md)

# TinyVid

跨平台视频批量压缩桌面应用，基于 Tauri 2、React 19 和 Rust 构建。自动检测并利用硬件编码器（VideoToolbox、NVENC、QSV、AMF、VAAPI）实现最佳性能，并具备智能软件回退机制。

## 功能特性

- **批量压缩** — 拖放多个视频，支持并行处理同时压缩
- **硬件加速** — 自动检测 GPU 编码器并优先使用；硬件不可用时回退至软件编码
- **智能并发** — 硬件编码时按芯片级别限制（M4 Ultra: 4、Max: 3、默认: 2）；软件编码时 CPU 核心数 / 2
- **压缩前预估** — 开始压缩前预测输出文件大小和压缩时间
- **实时进度** — 每个任务的实时倍速（如 2.5x）、预计剩余时间、百分比和文件大小
- **重复检测** — 自动识别并跳过已压缩的文件（文件名以 `_compressed.mp4` 结尾），弹出提示
- **单任务控制** — 可取消单个任务或全部取消
- **编码格式** — H.265/HEVC 和 H.264/AVC，可配置 CRF 质量（18–28）
- **分辨率缩放** — 原始、1080p、720p、480p，支持 GPU 加速缩放滤镜
- **音频选项** — 直通拷贝或重新编码为 AAC（320k/256k/128k/96k）
- **任务历史** — 查看和搜索所有历史压缩任务，支持按状态筛选
- **深色/浅色/系统主题** — 毛玻璃（Glassmorphism）设计风格，跨会话持久化
- **双语界面** — 英文和简体中文（i18next）
- **键盘快捷键** — 空格/回车开始、Escape 取消、R 重试、N 新批次
- **磁盘空间检查** — 压缩前检测磁盘空间，空间不足或紧张时弹出警告
- **内置 FFmpeg** — 无需单独安装 FFmpeg，二进制文件随应用打包

## 支持平台

| 平台 | 硬件编码器 | 架构 |
|------|-----------|------|
| macOS | VideoToolbox (H.265/H.264) | Apple Silicon、Intel |
| Windows | NVENC (NVIDIA)、QSV (Intel)、AMF (AMD) | x86_64 |
| Linux | NVENC (NVIDIA)、VAAPI (Intel/AMD) | x86_64、aarch64 |

## 支持的视频格式

MP4、MKV、AVI、MOV、WMV、FLV、WebM、M4V、TS、MTS、M2TS、VOB、MPG、MPEG、3GP（不区分大小写）

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Tauri 2](https://tauri.app/) |
| 前端 | React 19、TypeScript 5.8、Vite 7 |
| 样式 | Tailwind CSS 4（毛玻璃设计系统）|
| 状态管理 | Zustand 5 |
| 虚拟滚动 | @tanstack/react-virtual |
| 国际化 | i18next + react-i18next |
| 图标 | lucide-react |
| 后端 | Rust (edition 2021) |
| 测试 | Vitest（前端）、`cargo test`（后端）|

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- 平台特定的 Tauri 依赖 — 参见 [Tauri 前置条件](https://tauri.app/start/prerequisites/)

### 安装

```bash
# 克隆仓库
git clone https://github.com/no1coder/tinyvid.git
cd tinyvid

# 安装前端依赖
pnpm install

# 下载并打包 FFmpeg 二进制文件
./scripts/download-ffmpeg.sh

# 启动开发环境
pnpm tauri dev
```

### FFmpeg 打包

`scripts/download-ffmpeg.sh` 脚本负责为各平台准备 FFmpeg 二进制文件：

| 平台 | 来源 | 说明 |
|------|------|------|
| macOS | Homebrew (`brew install ffmpeg`) | 复制二进制文件 + 14 个动态库，修复 rpath，进行 ad-hoc 代码签名 |
| Linux | [johnvansickle.com](https://johnvansickle.com/ffmpeg/) | 静态构建，无依赖 |
| Windows | [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) | 静态构建，无依赖 |

```bash
# 自动检测当前平台
./scripts/download-ffmpeg.sh

# 或指定目标三元组
./scripts/download-ffmpeg.sh aarch64-apple-darwin
./scripts/download-ffmpeg.sh x86_64-unknown-linux-gnu
./scripts/download-ffmpeg.sh x86_64-pc-windows-msvc
```

二进制文件放置在 `src-tauri/binaries/` 目录下，作为 Tauri sidecar 打包。

## 开发

```bash
# 仅前端开发服务器
pnpm dev

# 完整 Tauri 开发（前端 + Rust 热重载）
pnpm tauri dev

# 运行前端测试
pnpm test

# 前端测试监听模式
pnpm test:watch

# 运行 Rust 测试
cd src-tauri && cargo test

# 生产构建
pnpm tauri build
```

## 项目结构

```
tinyvid/
├── src/                          # 前端（React + TypeScript）
│   ├── App.tsx                   # 主应用（4 阶段状态机：empty → ready → running → done）
│   ├── components/
│   │   ├── layout/               # AppLayout、Sidebar、ThemeToggle、LanguageSwitch、ToastContainer
│   │   ├── import/               # DropZone、FileTable（虚拟滚动）
│   │   ├── settings/             # SettingsPage、CodecSelector、CrfSlider、ResolutionSelector、
│   │   │                         # AudioBitrateSelector、HardwareToggle、OutputDirSelector、
│   │   │                         # ConcurrencySelector
│   │   └── task/                 # StatsBar、TaskHistoryPage
│   ├── hooks/                    # useCompression、useFileImport、useEstimation、useHardwareInfo、
│   │                             # useNotification、useDiskCheck、useKeyboardShortcuts
│   ├── stores/                   # Zustand 状态管理（appStore、settingsStore、taskStore）
│   ├── lib/                      # 工具函数（estimation、format、tauri IPC、constants、cn）
│   └── i18n/locales/             # en.json、zh-CN.json
│
├── src-tauri/                    # 后端（Rust）
│   ├── src/
│   │   ├── commands/             # Tauri IPC 命令处理器（system、probe、compression）
│   │   ├── ffmpeg/               # FFmpeg 参数、编码器检测、进程管理、进度解析
│   │   ├── task/                 # 任务管理器（芯片级别并发控制）、工作线程（硬件→软件回退）
│   │   └── utils/                # 错误类型、路径解析（4 步 FFmpeg 查找）、平台检测
│   ├── binaries/                 # 打包的 FFmpeg + 动态库（已加入 gitignore）
│   └── tauri.conf.json
│
└── scripts/
    └── download-ffmpeg.sh        # FFmpeg 下载/打包脚本
```

## 工作原理

### 压缩流水线

1. **探测** — FFprobe 提取视频元数据（分辨率、编码格式、时长、码率、帧率）
2. **预估** — 基于 CRF 的模型在压缩开始前预测输出大小和时间
3. **编码** — FFmpeg 使用最优编码器压缩；硬件编码器按优先级自动选择
4. **回退** — 如果硬件编码器在运行时失败，自动使用软件编码器重试
5. **进度** — 实时解析 FFmpeg 的 `-progress pipe:1` 输出以获取实时统计数据

### FFmpeg 查找策略（4 步优先级）

1. 打包的 sidecar 二进制文件（验证可运行）
2. 可执行文件目录回退
3. 系统 `PATH` 查找
4. 常见安装路径（`/opt/homebrew/bin`、`/usr/local/bin`、`/usr/bin`）

### 硬件加速详情

| 编码器 | 解码方式 | 输出格式 | 缩放滤镜 |
|--------|---------|---------|---------|
| VideoToolbox | 软件（比硬件解码更快）| — | `scale`（CPU）|
| NVENC | CUDA | `cuda` | `scale_cuda` |
| QSV | QSV | `qsv` | `scale_qsv` |
| AMF | D3D11VA | `d3d11` | `scale`（CPU）|
| VAAPI | VAAPI | `vaapi` | `scale_vaapi` |

> **为什么 VideoToolbox 不使用 `-hwaccel`？** 在 M4 Max 上的测试表明，Apple 的硬件解码器对 4K HEVC 最高约 180 fps，而多线程软件解码可达约 350 fps。由于 VT 编码器是瓶颈（约 200 fps），通过软件解码提供更快的数据流可获得约 10% 的整体吞吐量提升。

### 智能并发

- **硬件编码**: 按芯片级别限制 — M4 Ultra: 4 个任务、M4 Max: 3 个任务、其他 Apple Silicon: 2 个任务
- **软件编码**: `max(CPU 核心数 / 2, 1)` 个任务
- **用户覆盖**: 可手动选择 自动、1、2、3、4、6、8

## 测试

```bash
# 运行全部测试
cd src-tauri && cargo test && cd .. && pnpm test
```

## 构建

```bash
# 生产构建（生成平台特定的安装包）
pnpm tauri build
```

输出位置：
- **macOS**: `src-tauri/target/release/bundle/dmg/TinyVid_0.1.0_aarch64.dmg`
- **Windows**: `src-tauri/target/release/bundle/nsis/TinyVid_0.1.0_x64-setup.exe`
- **Linux**: `src-tauri/target/release/bundle/deb/tinyvid_0.1.0_amd64.deb`

## 安装说明

### macOS — 提示"TinyVid 已损坏，无法打开"

由于应用未使用 Apple 开发者证书签名，macOS Gatekeeper 可能会阻止打开。安装后，请在终端执行以下命令：

```bash
sudo xattr -cr /Applications/TinyVid.app
```

然后正常打开应用即可。此操作只需执行一次。

### Windows

运行 `.exe` 安装程序。如果 Windows SmartScreen 弹出警告，点击 **"更多信息"** → **"仍要运行"**。

## 许可证

MIT
