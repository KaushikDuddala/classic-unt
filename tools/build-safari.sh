#!/bin/sh
# Builds an Xcode project for the Safari web extension.
#
# Safari cannot load a Chromium extension directly; Apple's converter reads one and emits a project you then build and run. Needs Xcode.
#
# Usage: tools/build-safari.sh [output-dir]
#
# Defaults to dist/. Pass a directory if the checkout sits somewhere Xcode's asset compiler cannot read -- see the warning below.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/src"
OUT="${1:-${SAFARI_OUT:-$ROOT/dist}}"
BUNDLE_ID="com.duddala.classic-unt"

# macOS protects ~/Documents, ~/Desktop and ~/Downloads from other apps. Xcode's actool is sandboxed and gets EPERM there, which surfaces as a confusing "failed to read asset tags".
case "$(cd "$(dirname "$OUT")" 2>/dev/null && pwd || echo "$OUT")" in
  "$HOME"/Documents/*|"$HOME"/Desktop/*|"$HOME"/Downloads/*)
    echo "warning: $OUT is inside a macOS privacy-protected folder." >&2
    echo "         Xcode's asset compiler cannot read it and the build will" >&2
    echo "         fail with 'failed to read asset tags'." >&2
    echo >&2
    echo "         Either pass a different output directory, for example:" >&2
    echo "           tools/build-safari.sh \"\$HOME/Developer/classic-unt-safari\"" >&2
    echo >&2
    echo "         or grant Xcode Full Disk Access in System Settings >" >&2
    echo "         Privacy & Security > Full Disk Access, then restart Xcode." >&2
    echo >&2
    ;;
esac

if ! command -v xcrun >/dev/null 2>&1; then
  echo "error: xcrun not found. Install Xcode and its command line tools:" >&2
  echo "       xcode-select --install" >&2
  exit 1
fi

if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "error: safari-web-extension-converter not available in this Xcode." >&2
  echo "       Safari 16.4 or newer is required for Manifest V3 support." >&2
  exit 1
fi

# The converter does not copy the extension into the project, it writes file references pointing back here with relative paths. So this directory has to survive alongside the project, which is why it is not a temp dir.
STAGE="$OUT/stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R "$SRC"/. "$STAGE"/
cp "$ROOT/manifests/safari.json" "$STAGE/manifest.json"

if find "$STAGE" -name '*.pem' -o -name '*.key' | grep -q .; then
  echo "error: a private key is inside the staging copy" >&2
  exit 1
fi

rm -rf "$OUT/safari"
mkdir -p "$OUT/safari"

echo "converting with: $(xcrun --find safari-web-extension-converter)"
CONV_LOG="$OUT/convert.log"
xcrun safari-web-extension-converter "$STAGE" \
  --project-location "$OUT/safari" \
  --app-name "classic-unt" \
  --bundle-identifier "$BUNDLE_ID" \
  --swift \
  --no-open \
  --force >"$CONV_LOG" 2>&1

# The converter warns about unsupported manifest keys but still exits 0.
#
# "Persistent background pages are not supported on iOS" always appears with background.scripts. Adding "persistent": false just trades it for a warning about that key, since MV3 background scripts are already non-persistent. Only the macOS scheme is built, so the iOS half does not apply.
if grep -q '^Warning:' "$CONV_LOG"; then
  echo "the converter reported warnings:"
  grep '^Warning:' "$CONV_LOG" | sed 's/^/  /'
  echo "(full log: $CONV_LOG)"
fi
rm -f "$CONV_LOG"

PROJECT="$OUT/safari/classic-unt/classic-unt.xcodeproj"

# The converter can emit a project that references nothing, which looks like a success but builds an empty extension. Check before claiming it worked.
missing=0
for f in manifest.json content.js content.css popup.html options.html; do
  if ! grep -q "$f" "$PROJECT/project.pbxproj" 2>/dev/null; then
    echo "error: the generated project does not reference $f" >&2
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo "the Xcode project would build an empty extension; not reporting success" >&2
  exit 1
fi

echo "built $PROJECT"
echo
echo "Keep this folder next to the project -- the project points at it:"
echo "  $STAGE"
echo
echo "To run it:"
echo "  open '$PROJECT'"
echo "  then in Xcode: select the 'classic-unt Extension (macOS)' scheme and press Run."
echo "  Safari needs Develop > Allow Unsigned Extensions to be enabled."
