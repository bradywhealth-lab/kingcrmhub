#!/usr/bin/env bash
# KingCRMhub deploy v4
# Builds before touching the live container, keeps a timestamped rollback anchor,
# and verifies the onboarding schema with Prisma 7's adapter-free CLI path.
set -Eeuo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/home/deployer}"
REPO_DIR="${REPO_DIR:-${DEPLOY_ROOT}/kingcrmhub}"
COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_ROOT}/docker-compose.apps.yml}"
SERVICE="${KINGCRM_SERVICE:-kingcrmhub}"
CONTAINER="${KINGCRM_CONTAINER:-kingcrmhub}"
ROLLBACK_CONTAINER="${CONTAINER}-old-$(date +%Y%m%d%H%M%S)"
ROLLBACK_ARMED=0

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "DOCKER_COMPOSE_NOT_FOUND" >&2
  exit 1
fi

compose() {
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" "$@"
}

container_get() {
  local container_name="$1"
  local request_path="$2"

  docker exec "$container_name" node -e '
    const requestPath = process.argv[1]
    const port = process.env.PORT || "3003"
    fetch(`http://127.0.0.1:${port}${requestPath}`)
      .then(async response => {
        const body = await response.text()
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 120)}`)
        process.stdout.write(body)
      })
      .catch(error => {
        console.error(error.message)
        process.exit(1)
      })
  ' "$request_path"
}

wait_for_health() {
  local container_name="$1"

  for _ in {1..12}; do
    if container_get "$container_name" /api/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

restore_old() {
  trap - ERR
  ROLLBACK_ARMED=0
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
  docker rm "$CONTAINER" >/dev/null 2>&1 || true
  docker rename "$ROLLBACK_CONTAINER" "$CONTAINER"
  docker start "$CONTAINER" >/dev/null
  if ! wait_for_health "$CONTAINER"; then
    echo "ROLLBACK_HEALTH_FAIL" >&2
    return 1
  fi
  container_get "$CONTAINER" /api/health
  echo
  echo "ROLLED_BACK_TO_ORIGINAL"
}

on_error() {
  local status=$?
  if [[ "$ROLLBACK_ARMED" == "1" ]]; then
    echo "DEPLOY_FAILED_ROLLING_BACK" >&2
    restore_old
  fi
  exit "$status"
}
trap on_error ERR

for required_path in "$REPO_DIR/.git" "$COMPOSE_FILE"; do
  if [[ ! -e "$required_path" ]]; then
    echo "MISSING_REQUIRED_PATH: $required_path" >&2
    exit 1
  fi
done

if [[ -n "$(git -C "$REPO_DIR" status --porcelain)" ]]; then
  echo "REPO_DIRTY_ABORTING: $REPO_DIR" >&2
  exit 1
fi

git -C "$REPO_DIR" pull --ff-only origin main
echo "REPO_SHA=$(git -C "$REPO_DIR" rev-parse --short HEAD)"

echo "=== BUILD (live container remains untouched) ==="
compose build "$SERVICE"

echo "=== SWAP (original retained as $ROLLBACK_CONTAINER) ==="
docker rename "$CONTAINER" "$ROLLBACK_CONTAINER"
ROLLBACK_ARMED=1
docker stop "$ROLLBACK_CONTAINER" >/dev/null
compose up -d "$SERVICE"

if ! wait_for_health "$CONTAINER"; then
  echo "NEW_HEALTH_FAIL" >&2
  restore_old
  exit 1
fi

echo "=== APPLY ONBOARDING MIGRATION (idempotent) ==="
if ! compose exec -T "$SERVICE" npx prisma db execute \
  --file prisma/migrations/20260426_add_onboarding_fields/migration.sql; then
  echo "MIGRATION_FAILED" >&2
  restore_old
  exit 1
fi

echo "=== VERIFY ORG SCHEMA ALIGNMENT ==="
if ! compose exec -T "$SERVICE" npx prisma db execute --stdin <<'SQL'
DO $$
DECLARE
  missing_columns text;
BEGIN
  SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
  INTO missing_columns
  FROM (
    VALUES
      ('onboardingCompleted'),
      ('onboardingCompletedAt'),
      ('onboardingStep')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS actual
    WHERE actual.table_schema = 'public'
      AND actual.table_name = 'Organization'
      AND actual.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required Organization columns: %', missing_columns;
  END IF;
END
$$;
SQL
then
  echo "VERIFY_FAILED" >&2
  restore_old
  exit 1
fi
echo "ORG_FIELDS_OK"

echo "=== FINAL EVIDENCE ==="
container_get "$CONTAINER" /api/health
echo
LANDING_HTML="$(container_get "$CONTAINER" /)"
if [[ "$LANDING_HTML" != *"Run your client pipeline"* ]]; then
  echo "LANDING_COPY_FAIL" >&2
  restore_old
  exit 1
fi
echo "LANDING_COPY_OK"
container_get "$CONTAINER" /sitemap.xml >/dev/null
echo "SITEMAP_OK"

ROLLBACK_ARMED=0
echo "ROLLBACK_CONTAINER=$ROLLBACK_CONTAINER"
echo "DEPLOY_V4_DONE"
