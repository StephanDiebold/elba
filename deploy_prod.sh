#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.prod"
COMPOSE="docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml"

echo "🚀 Build images…"
${COMPOSE} build --progress=plain pag-backend pag-frontend

echo "⬆️  Start containers…"
${COMPOSE} up -d

echo "🔎 ps:"
${COMPOSE} ps

# optionale, kurze Health-Waits mit Timeout
wait_http() {
  local name="$1" url="$2" secs="${3:-40}"
  echo "⏳ Wait for ${name} (${url}) up to ${secs}s…"
  local i=0
  until docker run --rm --network infra_net curlimages/curl:8.9.1 -fsS -m 3 "$url" >/dev/null; do
    i=$((i+1))
    if [ "$i" -ge "$secs" ]; then
      echo "❌ ${name} not healthy after ${secs}s"
      return 1
    fi
    sleep 1
  done
  echo "✅ ${name} ready"
}

# Backend-Health optional (wenn Health-Endpoint offen ist)
wait_http "backend" "http://pag-backend:8000/health" 40 || true
# Frontend-Root
wait_http "frontend" "http://pag-frontend" 40 || true

echo "🎉 Done."
