#!/usr/bin/env bash
set -euo pipefail

# scripts/make_fav.sh
# Usage: ./scripts/make_fav.sh /path/to/source.png
# If no path is provided, defaults to "$HOME/Downloads/fav.png"
# Requires: ImageMagick (magick or convert)

SRC=${1:-"$HOME/Downloads/fav.png"}

# Resolve project root relative to this script so it works on any machine.
SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

DEST_DIRS=("$ROOT_DIR/static/favicon" "$ROOT_DIR/src/favicon")

if [ ! -f "$SRC" ]; then
  echo "Source file not found: $SRC"
  echo "Please provide the path to your image, e.g.: npm run make-favicon -- /home/soham/Downloads/fav.png"
  exit 1
fi

# Find ImageMagick binary (prefer magick on newer installs)
if command -v magick >/dev/null 2>&1; then
  IMAGEMAGICK_CMD="magick"
elif command -v convert >/dev/null 2>&1; then
  IMAGEMAGICK_CMD="convert"
else
  echo "ImageMagick not found. Please install it (sudo apt install imagemagick) and retry."
  exit 1
fi

echo "Using ImageMagick: $IMAGEMAGICK_CMD"
echo "Source image: $SRC"

for dest in "${DEST_DIRS[@]}"; do
  if [ ! -d "$dest" ]; then
    echo "Creating directory: $dest"
    mkdir -p "$dest"
  fi

  echo "Generating icons into: $dest"

  # Android/Chrome icons
  $IMAGEMAGICK_CMD "$SRC" -resize 512x512^ -gravity center -extent 512x512 "$dest/android-chrome-512x512.png"
  $IMAGEMAGICK_CMD "$SRC" -resize 256x256^ -gravity center -extent 256x256 "$dest/android-chrome-256x256.png"
  $IMAGEMAGICK_CMD "$SRC" -resize 192x192^ -gravity center -extent 192x192 "$dest/android-chrome-192x192.png"

  # Apple touch
  $IMAGEMAGICK_CMD "$SRC" -resize 180x180^ -gravity center -extent 180x180 "$dest/apple-touch-icon.png"

  # Favicons
  $IMAGEMAGICK_CMD "$SRC" -resize 32x32^ -gravity center -extent 32x32 "$dest/favicon-32x32.png"
  $IMAGEMAGICK_CMD "$SRC" -resize 16x16^ -gravity center -extent 16x16 "$dest/favicon-16x16.png"

  # General favicon PNG (keep large so the browser can choose)
  $IMAGEMAGICK_CMD "$SRC" -resize 512x512^ -gravity center -extent 512x512 "$dest/favicon.png"

  # Create multi-resolution .ico (16,32,48)
  # ImageMagick can auto-resize when creating ico; provide multiple sizes.
  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_DIR"' EXIT
  $IMAGEMAGICK_CMD "$SRC" -resize 48x48^ -gravity center -extent 48x48 "$TMP_DIR/icon-48.png"
  $IMAGEMAGICK_CMD "$SRC" -resize 32x32^ -gravity center -extent 32x32 "$TMP_DIR/icon-32.png"
  $IMAGEMAGICK_CMD "$SRC" -resize 16x16^ -gravity center -extent 16x16 "$TMP_DIR/icon-16.png"
  $IMAGEMAGICK_CMD "$TMP_DIR/icon-48.png" "$TMP_DIR/icon-32.png" "$TMP_DIR/icon-16.png" -colors 256 "$dest/favicon.ico"

  # Keep a jpg variant (some places might reference it)
  $IMAGEMAGICK_CMD "$SRC" -resize 512x512^ -gravity center -extent 512x512 "$dest/favicon.jpg"

  echo "Wrote:"
  echo "  $dest/android-chrome-512x512.png"
  echo "  $dest/android-chrome-256x256.png"
  echo "  $dest/android-chrome-192x192.png"
  echo "  $dest/apple-touch-icon.png"
  echo "  $dest/favicon-32x32.png"
  echo "  $dest/favicon-16x16.png"
  echo "  $dest/favicon.png"
  echo "  $dest/favicon.ico"
  echo "  $dest/favicon.jpg"
done

echo "Favicon generation complete."
echo "If you serve from Vite dev server, restart it so the new assets are picked up."

exit 0
