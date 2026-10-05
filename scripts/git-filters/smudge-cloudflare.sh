#!/usr/bin/env bash
# scripts/git-filters/smudge-cloudflare.sh
# Git Smudge Filter: Restores local Cloudflare Account ID and Database ID from .env into the working tree.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

ACCOUNT_ID=""
DATABASE_ID=""
if [[ -f "$REPO_ROOT/.env" ]]; then
  ACCOUNT_ID=$( (grep -E '^[[:space:]]*CLOUDFLARE_ACCOUNT_ID=' "$REPO_ROOT/.env" || true) | head -n1 | cut -d '=' -f2- | tr -d '"'\'' ' )
  DATABASE_ID=$( (grep -E '^[[:space:]]*CLOUDFLARE_DATABASE_ID=' "$REPO_ROOT/.env" || true) | head -n1 | cut -d '=' -f2- | tr -d '"'\'' ' )
fi
if [[ -z "$ACCOUNT_ID" && -f "$REPO_ROOT/.env.local" ]]; then
  ACCOUNT_ID=$( (grep -E '^[[:space:]]*CLOUDFLARE_ACCOUNT_ID=' "$REPO_ROOT/.env.local" || true) | head -n1 | cut -d '=' -f2- | tr -d '"'\'' ' )
fi
if [[ -z "$DATABASE_ID" && -f "$REPO_ROOT/.env.local" ]]; then
  DATABASE_ID=$( (grep -E '^[[:space:]]*CLOUDFLARE_DATABASE_ID=' "$REPO_ROOT/.env.local" || true) | head -n1 | cut -d '=' -f2- | tr -d '"'\'' ' )
fi

ACCOUNT_ID="${ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}"
DATABASE_ID="${DATABASE_ID:-${CLOUDFLARE_DATABASE_ID:-}}"

if [[ -n "$ACCOUNT_ID" && -n "$DATABASE_ID" ]]; then
  sed \
    -e "s/\"account_id\":[[:space:]]*\"<CLOUDFLARE_ACCOUNT_ID>\"/\"account_id\": \"${ACCOUNT_ID}\"/g" \
    -e "s/\"database_id\":[[:space:]]*\"00000000-0000-0000-0000-000000000000\"/\"database_id\": \"${DATABASE_ID}\"/g"
elif [[ -n "$ACCOUNT_ID" ]]; then
  sed -e "s/\"account_id\":[[:space:]]*\"<CLOUDFLARE_ACCOUNT_ID>\"/\"account_id\": \"${ACCOUNT_ID}\"/g"
else
  cat
fi
