#!/bin/bash
set -e

REPO="hongliangzhang07/claude_code_hub"
APP_NAME="Claude Code Hub"

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  PATTERN="arm64.dmg"
else
  PATTERN="[0-9].dmg"
fi

echo "==> Detecting architecture: $ARCH"

# Get latest release download URL
echo "==> Fetching latest release from GitHub..."
DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep "browser_download_url" \
  | grep "$PATTERN" \
  | head -1 \
  | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Error: Could not find a DMG for your architecture ($ARCH)."
  echo "Please check: https://github.com/${REPO}/releases"
  exit 1
fi

TMPDIR=$(mktemp -d)
DMG_PATH="${TMPDIR}/claude-code-hub.dmg"

echo "==> Downloading: $DOWNLOAD_URL"
curl -L -o "$DMG_PATH" "$DOWNLOAD_URL"

echo "==> Mounting DMG..."
MOUNT_POINT=$(hdiutil attach "$DMG_PATH" -nobrowse -quiet | grep "/Volumes" | awk '{print $3}')

if [ -z "$MOUNT_POINT" ]; then
  # Fallback: try to find the mount point
  MOUNT_POINT="/Volumes/${APP_NAME}"
fi

echo "==> Installing to /Applications..."
if [ -d "/Applications/${APP_NAME}.app" ]; then
  echo "    Removing old version..."
  rm -rf "/Applications/${APP_NAME}.app"
fi

cp -R "${MOUNT_POINT}/${APP_NAME}.app" /Applications/

echo "==> Cleaning up..."
hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
rm -rf "$TMPDIR"

# Remove quarantine flag (unsigned app)
echo "==> Removing quarantine flag..."
xattr -cr "/Applications/${APP_NAME}.app"

echo ""
echo "==> Done! ${APP_NAME} has been installed to /Applications."
echo "    Run it from Launchpad or: open '/Applications/${APP_NAME}.app'"
