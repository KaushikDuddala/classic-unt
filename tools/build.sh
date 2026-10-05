#!/bin/sh
# Builds dist/classic-unt.crx (Chromium) and dist/classic-unt-firefox.zip (Firefox, for addons.mozilla.org). Both come from src/; only the manifest differs, since Firefox needs an add-on id and a background script list.
#
# Usage: tools/build.sh [chrome|firefox|all]
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/src"
OUT="$ROOT/dist"
KEY="$ROOT/keys/classic-unt.pem"
TARGET="${1:-all}"

# Chromium signs the crx, so that target needs it. Firefox does not.
CHROME=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(command -v chromium 2>/dev/null || true)" \
  "$(command -v google-chrome 2>/dev/null || true)" \
  "$(command -v chromium-browser 2>/dev/null || true)"
do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    CHROME="$candidate"
    break
  fi
done

mkdir -p "$OUT" "$ROOT/keys"

# stage <manifest> <destination>
stage() {
  _manifest="${1:-$SRC/manifest.json}"
  _dest="$2"
  rm -rf "$_dest"
  mkdir -p "$_dest"
  cp -R "$SRC"/. "$_dest"/
  cp "$_manifest" "$_dest/manifest.json"
}

# a key must never make it into a package
check_payload() {
  _dir="$1"
  if find "$_dir" -name '*.pem' -o -name '*.key' | grep -q .; then
    echo "error: a private key is inside $_dir" >&2
    exit 1
  fi
}

# ------------------------------------------------------------- chromium
build_chrome() {
  if [ -z "$CHROME" ]; then
    echo "skipping crx: no Chrome or Chromium found to sign with" >&2
    return
  fi
  echo "signing with: $CHROME"

  WORK=$(mktemp -d)
  STAGE="$WORK/classic-unt"
  stage "$SRC/manifest.json" "$STAGE"
  check_payload "$STAGE"

  if [ -f "$KEY" ]; then
    "$CHROME" --pack-extension="$STAGE" --pack-extension-key="$KEY" \
      --no-sandbox --disable-gpu >/dev/null 2>&1
  else
    echo "no key yet, generating one in keys/"
    "$CHROME" --pack-extension="$STAGE" --no-sandbox --disable-gpu >/dev/null 2>&1
  fi

  if [ ! -f "$WORK/classic-unt.crx" ]; then
    echo "error: packing produced no crx" >&2
    rm -rf "$WORK"
    exit 1
  fi

  cp "$WORK/classic-unt.crx" "$OUT/classic-unt.crx"
  if [ -f "$WORK/classic-unt.pem" ]; then
    cp "$WORK/classic-unt.pem" "$ROOT/keys/classic-unt.pem"
  fi
  rm -rf "$WORK"
  echo "built $OUT/classic-unt.crx"
}

# --------------------------------------------------------------- firefox
build_firefox() {
  if ! command -v zip >/dev/null 2>&1; then
    echo "skipping firefox zip: 'zip' not found" >&2
    return
  fi
  WORK=$(mktemp -d)
  STAGE="$WORK/classic-unt"
  stage "$ROOT/manifests/firefox.json" "$STAGE"
  check_payload "$STAGE"

  ( cd "$STAGE" && zip -q -r -X "$OUT/classic-unt-firefox.zip" . )

  rm -rf "$WORK"
  echo "built $OUT/classic-unt-firefox.zip"
}

case "$TARGET" in
  chrome)  build_chrome ;;
  firefox) build_firefox ;;
  all)     build_chrome; build_firefox ;;
  *)       echo "usage: $0 [chrome|firefox|all]" >&2; exit 2 ;;
esac
