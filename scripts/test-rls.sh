#!/usr/bin/env bash
# Applies every migration to a scratch Postgres database and runs the RLS suite
# against it as a non-owner role. No Supabase project needed — but it exercises the
# same policy files that ship to one.
#
#   ./scripts/test-rls.sh                       # local postgres on :5432
#   PGURL=postgres://user:pw@host/postgres ./scripts/test-rls.sh
set -euo pipefail

PGURL="${PGURL:-postgres://postgres@localhost:5432/postgres}"
TEST_DB="${TEST_DB:-overlap_rls_test}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql -q "$PGURL" -c "DROP DATABASE IF EXISTS ${TEST_DB};" -c "CREATE DATABASE ${TEST_DB};"
TARGET="$(printf '%s' "$PGURL" | sed "s#/[^/?]*\(?\|$\)#/${TEST_DB}\1#")"

echo "Applying stub + migrations to ${TEST_DB}…"
psql -q -v ON_ERROR_STOP=1 "$TARGET" -f "$ROOT/supabase/tests/00_supabase_stub.sql" >/dev/null
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "  $(basename "$migration")"
  psql -q -v ON_ERROR_STOP=1 "$TARGET" -f "$migration" >/dev/null
done

echo
OUTPUT="$(psql -q -v ON_ERROR_STOP=1 "$TARGET" -f "$ROOT/supabase/tests/01_rls_test.sql")"
echo "$OUTPUT"

FAILED="$(printf '%s' "$OUTPUT" | grep -c 'FAIL' || true)"
PASSED="$(printf '%s' "$OUTPUT" | grep -c 'PASS' || true)"
echo
echo "${PASSED} passed, ${FAILED} failed."

psql -q "$PGURL" -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null

if [ "$FAILED" -ne 0 ]; then
  echo "RLS is not safe to launch with. Fix the policies above."
  exit 1
fi
