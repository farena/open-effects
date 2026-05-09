#!/usr/bin/env bash
#
# End-to-end open-effects render driver.
#
# Usage:
#   bash render-video.sh <audio_file> <project_json>
#
# Arguments:
#   audio_file    path to an audio asset to upload (e.g. /tmp/song.mp3)
#                 — or pass "" to skip the upload + audioTracks substitution.
#   project_json  path to a ProjectJson template (e.g. docs/api/examples/minimal-project.json)
#
# Env overrides:
#   BASE_URL      defaults to http://localhost:3000
#   PROJECT_NAME  defaults to "Programmatic render"
#   WIDTH/HEIGHT/FPS  override the project canvas (defaults 1280/720/30)
#
# This script implements the 5-step pipeline documented in SKILL.md. It is
# intentionally short and copy-edit friendly — adapt rather than parameterize.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PROJECT_NAME="${PROJECT_NAME:-Programmatic render}"
WIDTH="${WIDTH:-1280}"
HEIGHT="${HEIGHT:-720}"
FPS="${FPS:-30}"

AUDIO_FILE="${1:-}"
PROJECT_JSON="${2:-}"

if [[ -z "${PROJECT_JSON}" || ! -f "${PROJECT_JSON}" ]]; then
  echo "Usage: $0 <audio_file_or_empty_string> <project_json_path>" >&2
  exit 2
fi

# ── 1. Upload asset (optional) ───────────────────────────────────────────────
ASSET_ID=""
ASSET_PATH=""
if [[ -n "${AUDIO_FILE}" ]]; then
  if [[ ! -f "${AUDIO_FILE}" ]]; then
    echo "audio file not found: ${AUDIO_FILE}" >&2
    exit 2
  fi
  echo "==> Uploading ${AUDIO_FILE}"
  ASSET=$(curl -fsS -X POST "${BASE_URL}/api/assets" -F "file=@${AUDIO_FILE}")
  ASSET_ID=$(jq -r '.id'   <<<"${ASSET}")
  ASSET_PATH=$(jq -r '.path' <<<"${ASSET}")
  echo "    asset id=${ASSET_ID}"
fi

# ── 2. Create project ────────────────────────────────────────────────────────
echo "==> Creating project (${WIDTH}x${HEIGHT}@${FPS}fps)"
CREATE_BODY=$(jq -nc \
  --arg n  "${PROJECT_NAME}" \
  --argjson w  "${WIDTH}" \
  --argjson h  "${HEIGHT}" \
  --argjson f  "${FPS}" \
  '{name:$n,width:$w,height:$h,fps:$f}')
PROJECT_ID=$(curl -fsS -X POST "${BASE_URL}/api/projects" \
  -H "Content-Type: application/json" -d "${CREATE_BODY}" | jq -r '.id')
echo "    project id=${PROJECT_ID}"

# ── 3. PATCH ProjectJson ────────────────────────────────────────────────────
echo "==> Patching ProjectJson from ${PROJECT_JSON}"
JQ_FILTER='.id = $pid'
if [[ -n "${ASSET_ID}" ]]; then
  JQ_FILTER+=' | (.scenes[0].audioTracks // []) as $t
                | if ($t | length) > 0 then
                    .scenes[0].audioTracks[0].assetId   = $aid
                    | .scenes[0].audioTracks[0].assetPath = $ap
                  else . end'
fi
jq \
  --arg pid "${PROJECT_ID}" \
  --arg aid "${ASSET_ID}" \
  --arg ap  "${ASSET_PATH}" \
  "${JQ_FILTER}" \
  "${PROJECT_JSON}" \
| curl -fsS -X PATCH "${BASE_URL}/api/projects/${PROJECT_ID}" \
    -H "Content-Type: application/json" --data-binary @- >/dev/null
echo "    patched"

# ── 4. Trigger render ───────────────────────────────────────────────────────
echo "==> Starting render"
RENDER_ID=$(curl -fsS -X POST "${BASE_URL}/api/render/${PROJECT_ID}" \
  | jq -r '.renderId')
echo "    render id=${RENDER_ID}"

# ── 5. Follow SSE ───────────────────────────────────────────────────────────
echo "==> Waiting for render"
OUTPUT_URL=""
while IFS= read -r line; do
  [[ "${line}" == data:* ]] || continue
  JOB="${line#data: }"
  STATUS=$(jq -r '.status' <<<"${JOB}")
  PCT=$(jq -r '((.progress // 0) * 100 | floor)' <<<"${JOB}")
  printf '    [%s] %s%%\n' "${STATUS}" "${PCT}"
  case "${STATUS}" in
    completed) OUTPUT_URL=$(jq -r '.outputUrl' <<<"${JOB}"); break ;;
    error)
      echo "render failed: $(jq -r '.error' <<<"${JOB}")" >&2
      exit 1
      ;;
  esac
done < <(curl -fsSN "${BASE_URL}/api/render/${PROJECT_ID}/${RENDER_ID}/events")

if [[ -z "${OUTPUT_URL}" ]]; then
  echo "SSE stream closed without a completed event" >&2
  exit 1
fi

# ── 6. Download MP4 ─────────────────────────────────────────────────────────
FILENAME=$(basename "${OUTPUT_URL}")
echo "==> Downloading ${FILENAME}"
curl -fsS -o "${FILENAME}" "${BASE_URL}${OUTPUT_URL}"
echo "Done — saved to ${FILENAME}"
