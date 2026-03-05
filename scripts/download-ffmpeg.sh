#!/usr/bin/env bash
# Download/bundle FFmpeg+FFprobe binaries for Tauri sidecar.
# Usage: ./scripts/download-ffmpeg.sh [target-triple]
#
# Binaries are placed in src-tauri/binaries/ with Tauri sidecar naming:
#   ffmpeg-<target-triple>[.exe]
#   ffprobe-<target-triple>[.exe]
#
# macOS: copies from Homebrew and bundles dylibs with fixed rpaths.
# Linux: downloads static builds from johnvansickle.com.
# Windows: downloads static builds from gyan.dev.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BIN_DIR="$PROJECT_DIR/src-tauri/binaries"

mkdir -p "$BIN_DIR"

# Determine target triple
if [ -n "${1:-}" ]; then
    TARGET="$1"
else
    case "$(uname -s)-$(uname -m)" in
        Darwin-arm64)   TARGET="aarch64-apple-darwin" ;;
        Darwin-x86_64)  TARGET="x86_64-apple-darwin" ;;
        Linux-x86_64)   TARGET="x86_64-unknown-linux-gnu" ;;
        Linux-aarch64)  TARGET="aarch64-unknown-linux-gnu" ;;
        MINGW*|MSYS*|CYGWIN*)
            TARGET="x86_64-pc-windows-msvc" ;;
        *)
            echo "ERROR: Unsupported platform: $(uname -s)-$(uname -m)"
            exit 1 ;;
    esac
fi

echo "Target: $TARGET"
echo "Output: $BIN_DIR"

EXT=""
[[ "$TARGET" == *windows* ]] && EXT=".exe"

FFMPEG_OUT="$BIN_DIR/ffmpeg-${TARGET}${EXT}"
FFPROBE_OUT="$BIN_DIR/ffprobe-${TARGET}${EXT}"

if [ -f "$FFMPEG_OUT" ] && [ -f "$FFPROBE_OUT" ]; then
    echo "FFmpeg binaries already exist for $TARGET. Delete them to re-download."
    ls -lh "$FFMPEG_OUT" "$FFPROBE_OUT"
    exit 0
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

bundle_macos() {
    # macOS FFmpeg is dynamically linked (required for VideoToolbox).
    # We copy the binary + all Homebrew dylibs, then rewrite rpaths
    # so everything is self-contained in the binaries/ directory.

    if ! command -v ffmpeg &>/dev/null; then
        echo "ERROR: FFmpeg not found. Install via: brew install ffmpeg"
        exit 1
    fi

    local FFMPEG_SRC FFPROBE_SRC CELLAR_LIB
    FFMPEG_SRC="$(which ffmpeg)"
    FFPROBE_SRC="$(which ffprobe)"

    # Resolve symlinks to get the real Cellar path
    FFMPEG_SRC="$(readlink -f "$FFMPEG_SRC" 2>/dev/null || realpath "$FFMPEG_SRC")"
    FFPROBE_SRC="$(readlink -f "$FFPROBE_SRC" 2>/dev/null || realpath "$FFPROBE_SRC")"
    CELLAR_LIB="$(dirname "$FFMPEG_SRC")/../lib"

    echo "Source: $FFMPEG_SRC"
    echo "Libs:   $CELLAR_LIB"

    # Copy binaries
    cp "$FFMPEG_SRC" "$FFMPEG_OUT"
    cp "$FFPROBE_SRC" "$FFPROBE_OUT"
    chmod +x "$FFMPEG_OUT" "$FFPROBE_OUT"

    # Copy and fix dylibs
    local LIB_DIR="$BIN_DIR/lib"
    mkdir -p "$LIB_DIR"

    # Collect all Homebrew dylibs needed by ffmpeg
    local dylibs
    dylibs=$(otool -L "$FFMPEG_OUT" | grep "/opt/homebrew\|/usr/local" | awk '{print $1}')

    for dylib in $dylibs; do
        local base
        base="$(basename "$dylib")"
        if [ ! -f "$LIB_DIR/$base" ]; then
            local real_path
            real_path="$(readlink -f "$dylib" 2>/dev/null || realpath "$dylib" 2>/dev/null || echo "$dylib")"
            if [ -f "$real_path" ]; then
                cp "$real_path" "$LIB_DIR/$base"
                chmod 755 "$LIB_DIR/$base"
                echo "  Bundled: $base"

                # Recursively find dylibs of this dylib
                local sub_dylibs
                sub_dylibs=$(otool -L "$LIB_DIR/$base" | grep "/opt/homebrew\|/usr/local" | awk '{print $1}')
                for sub in $sub_dylibs; do
                    local sub_base
                    sub_base="$(basename "$sub")"
                    if [ ! -f "$LIB_DIR/$sub_base" ]; then
                        local sub_real
                        sub_real="$(readlink -f "$sub" 2>/dev/null || realpath "$sub" 2>/dev/null || echo "$sub")"
                        if [ -f "$sub_real" ]; then
                            cp "$sub_real" "$LIB_DIR/$sub_base"
                            chmod 755 "$LIB_DIR/$sub_base"
                            echo "  Bundled (dep): $sub_base"
                        fi
                    fi
                done
            fi
        fi
    done

    # Fix rpaths in binaries: point to ./lib/
    for bin in "$FFMPEG_OUT" "$FFPROBE_OUT"; do
        # Remove existing rpaths
        local old_rpaths
        old_rpaths=$(otool -l "$bin" | grep -A2 "LC_RPATH" | grep "path " | awk '{print $2}') || true
        for rp in $old_rpaths; do
            install_name_tool -delete_rpath "$rp" "$bin" 2>/dev/null || true
        done
        # Add rpaths for both dev and production:
        # Dev: binary is in src-tauri/binaries/, libs in src-tauri/binaries/lib/
        install_name_tool -add_rpath "@executable_path/lib" "$bin" 2>/dev/null || true
        # Production: binary in Contents/MacOS/, libs in Contents/Resources/binaries/lib/
        install_name_tool -add_rpath "@executable_path/../Resources/binaries/lib" "$bin" 2>/dev/null || true

        # Rewrite dylib references from absolute to @rpath/
        for dylib in $dylibs; do
            local base
            base="$(basename "$dylib")"
            install_name_tool -change "$dylib" "@rpath/$base" "$bin" 2>/dev/null || true
        done
    done

    # Fix rpaths in dylibs themselves
    for lib_file in "$LIB_DIR"/*.dylib; do
        [ -f "$lib_file" ] || continue
        local lib_dylibs
        lib_dylibs=$(otool -L "$lib_file" | grep "/opt/homebrew\|/usr/local" | awk '{print $1}')
        for dylib in $lib_dylibs; do
            local base
            base="$(basename "$dylib")"
            install_name_tool -change "$dylib" "@rpath/$base" "$lib_file" 2>/dev/null || true
        done
        # Set id
        local this_base
        this_base="$(basename "$lib_file")"
        install_name_tool -id "@rpath/$this_base" "$lib_file" 2>/dev/null || true
        # Add rpath to find sibling dylibs
        install_name_tool -add_rpath "@loader_path" "$lib_file" 2>/dev/null || true
    done

    # Ad-hoc code sign everything (required on Apple Silicon)
    echo "Code signing dylibs and binaries..."
    for lib_file in "$LIB_DIR"/*.dylib; do
        [ -f "$lib_file" ] || continue
        codesign --force --sign - "$lib_file" 2>/dev/null || true
    done
    codesign --force --sign - "$FFMPEG_OUT" 2>/dev/null || true
    codesign --force --sign - "$FFPROBE_OUT" 2>/dev/null || true

    echo "macOS bundle complete. Verifying..."
    otool -L "$FFMPEG_OUT" | head -5
    echo "Lib count: $(ls "$LIB_DIR"/*.dylib 2>/dev/null | wc -l | tr -d ' ') dylibs"
}

case "$TARGET" in
    *apple-darwin*)
        bundle_macos
        ;;

    x86_64-unknown-linux-gnu|aarch64-unknown-linux-gnu)
        echo "Downloading static FFmpeg for Linux..."
        if [ "$TARGET" = "x86_64-unknown-linux-gnu" ]; then
            URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
        else
            URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
        fi
        curl -L "$URL" -o "$TMPDIR/ffmpeg.tar.xz"
        tar -xf "$TMPDIR/ffmpeg.tar.xz" -C "$TMPDIR"
        EXTRACTED=$(find "$TMPDIR" -maxdepth 1 -type d -name "ffmpeg-*" | head -1)
        cp "$EXTRACTED/ffmpeg" "$FFMPEG_OUT"
        cp "$EXTRACTED/ffprobe" "$FFPROBE_OUT"
        chmod +x "$FFMPEG_OUT" "$FFPROBE_OUT"
        ;;

    *windows*)
        echo "Downloading static FFmpeg for Windows..."
        URL="https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
        curl -L "$URL" -o "$TMPDIR/ffmpeg.zip"
        unzip -q "$TMPDIR/ffmpeg.zip" -d "$TMPDIR"
        EXTRACTED=$(find "$TMPDIR" -maxdepth 1 -type d -name "ffmpeg-*" | head -1)
        cp "$EXTRACTED/bin/ffmpeg.exe" "$FFMPEG_OUT"
        cp "$EXTRACTED/bin/ffprobe.exe" "$FFPROBE_OUT"
        ;;

    *)
        echo "ERROR: No FFmpeg download source for target: $TARGET"
        exit 1 ;;
esac

echo ""
echo "Done!"
ls -lh "$FFMPEG_OUT" "$FFPROBE_OUT"
