#!/usr/bin/env bash
# Download a CC0 pothole clip so the /test-photos demo + Gemini Files API
# branch have a real video to chew on. Pexels License is no-attribution-required,
# but we credit the photographer anyway.
#
#   File:        Traffic Navigating Pothole on Busy Street
#   Photographer: Christian Bardot
#   License:     Pexels License (free for commercial use, no attribution required)
#   Source:      https://www.pexels.com/video/traffic-navigating-pothole-on-busy-street-34218230/
#
# Usage:
#   ./scripts/fetch_pothole_video.sh
#
# Idempotent: skips download if the file already exists.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$ROOT/apps/web/public/test-videos"
DEST_FILE="$DEST_DIR/real_pothole_traffic.mp4"
URL="https://videos.pexels.com/video-files/34218230/14505599_1920_1080_25fps.mp4"

mkdir -p "$DEST_DIR"

if [[ -f "$DEST_FILE" ]]; then
  echo "✓ $DEST_FILE already present ($(du -h "$DEST_FILE" | cut -f1))"
  exit 0
fi

echo "→ Downloading pothole video from Pexels CDN..."
curl -L --fail --silent --show-error -o "$DEST_FILE" "$URL"
echo "✓ Saved $(du -h "$DEST_FILE" | cut -f1) to $DEST_FILE"
