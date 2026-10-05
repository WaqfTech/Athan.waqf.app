#!/usr/bin/env bash
# scripts/git-filters/clean-cloudflare.sh
# Git Clean Filter: Sanitizes Cloudflare Account ID and Database ID into placeholders for Git commits.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Read real values from .env or .env.local if present, or match general Cloudflare patterns
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

# If specific IDs are known, sanitize them; otherwise sanitize standard CF 32-hex and 36-char UUID formats
if [[ -n "$ACCOUNT_ID" && -n "$DATABASE_ID" ]]; then
  sed -E \
    -e "s/\"account_id\":[[:space:]]*\"${ACCOUNT_ID}\"/\"account_id\": \"<CLOUDFLARE_ACCOUNT_ID>\"/g" \
    -e "s/\"database_id\":[[:space:]]*\"${DATABASE_ID}\"/\"database_id\": \"00000000-0000-0000-0000-000000000000\"/g"
elif [[ -n "$ACCOUNT_ID" ]]; then
  sed -E \
    -e "s/\"account_id\":[[:space:]]*\"${ACCOUNT_ID}\"/\"account_id\": \"<CLOUDFLARE_ACCOUNT_ID>\"/g" \
    -e 's/"database_id":[[:space:]]*"[0-9a-fA-F-]{36}"/"database_id": "00000000-0000-0000-0000-000000000000"/g'
else
  sed -E \
    -e 's/"account_id":[[:space:]]*"[0-9a-fA-F]{32}"/"account_id": "<CLOUDFLARE_ACCOUNT_ID>"/g' \
    -e 's/"database_id":[[:space:]]*"[0-9a-fA-F-]{36}"/"database_id": "00000000-0000-0000-0000-000000000000"/g'
fi
