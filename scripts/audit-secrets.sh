#!/usr/bin/env bash
# Section 8: no service_role key, database password, or committed .env — in the
# working tree or anywhere in history.
set -uo pipefail

status=0
SELF=':(exclude)scripts/audit-secrets.sh'

# Match key material, not prose: an env assignment, or a JWT whose payload decodes
# to a service_role claim (the three patterns are base64 at each byte offset).
PATTERNS=(
  -e 'SUPABASE_SERVICE[A-Z_]*='
  -e 'SUPABASE_DB_PASSWORD='
  -e 'SUPABASE_DB_URL=postgres'
  -e 'service_role["'\''[:space:]]*[:=][[:space:]]*["'\'']*ey[A-Za-z0-9_-]{20,}'
  -e 'c2VydmljZV9yb2xl'
  -e 'NlcnZpY2Vfcm9s'
  -e 'ZXJ2aWNlX3JvbGU'
)

echo "Scanning the working tree…"
if git grep -nIE "${PATTERNS[@]}" -- . "$SELF" ':(exclude).env.example'; then
  echo "  ^ secret-shaped values in tracked files."
  status=1
else
  echo "  clean"
fi

echo "Checking .env is ignored and untracked…"
if git check-ignore -q .env; then
  echo "  clean (.env is ignored)"
else
  echo "  .env is NOT ignored by git."
  status=1
fi
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "  .env is TRACKED. Remove it from the index and rotate every key it held."
  status=1
fi

echo "Scanning history (inherited upstream commits included)…"
HITS="$(git log -p --all -- .env.example | grep -c 'SUPABASE_DB_PASSWORD' || true)"
if [ "$HITS" -ne 0 ]; then
  echo "  NOTE: the inherited luma-clone history contains the upstream author's own"
  echo "  Supabase credentials in .env.example. They are already public in the"
  echo "  upstream repo and are not this project's to rotate — but do not reuse that"
  echo "  project, and treat any fork of this history as carrying them."
fi

exit "$status"
