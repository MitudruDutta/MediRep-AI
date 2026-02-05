#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

set_kv() {
  local file="$1"
  local key="$2"
  local value="$3"

  mkdir -p "$(dirname "$file")"
  touch "$file"

  if rg -n "^${key}=" "$file" >/dev/null 2>&1; then
    # Replace existing
    sed -i -E "s|^${key}=.*$|${key}=${value}|" "$file"
  else
    # Append
    printf "\n%s=%s\n" "$key" "$value" >>"$file"
  fi
}

FRONTEND_ENV="${ROOT_DIR}/frontend/.env.local"
BACKEND_ENV="${ROOT_DIR}/backend/.env"

echo "Setting frontend localhost env in: ${FRONTEND_ENV}"
set_kv "$FRONTEND_ENV" "NEXT_PUBLIC_API_URL" "http://localhost:8000"
set_kv "$FRONTEND_ENV" "NEXT_PUBLIC_SITE_URL" "http://localhost:3000"

echo "Setting backend localhost env in: ${BACKEND_ENV}"
set_kv "$BACKEND_ENV" "ENV" "development"
set_kv "$BACKEND_ENV" "FRONTEND_URL" "http://localhost:3000"
set_kv "$BACKEND_ENV" "ALLOWED_ORIGINS" "http://localhost:3000,http://127.0.0.1:3000"

