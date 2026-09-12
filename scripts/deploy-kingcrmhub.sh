#!/usr/bin/env bash
# KingCRMhub deploy v4
# Builds before touching the live container, keeps a timestamped rollback image,
# and verifies the onboarding schema with Prisma 7's adapter-free CLI path.
set -Eeuo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/home/deployer}"
REPO_DIR="${REPO_DIR:-${DEPLOY_ROOT}/kingcrmhub}"
COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_ROOT}/docker-compose.apps.yml}"
SERVICE="${KINGCRM_SERVICE:-kingcrmhub}"
CONTAINER="${KINGCRM_CONTAINER:-kingcrmhub}"
# Unique per-process rollback tag: timestamp alone collides when two deploys
# overlap within the same second (cubic P1). $$ (PID) makes the tag unique.
ROLLBACK_IMAGE="kingcrmhub-rollback:$(date +%Y%m%d%H%M%S)-$$"
SERVICE_IMAGE_REF=""
ROLLBACK_ARMED=0
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-${DEPLOY_ROOT}/kingcrmhub-deploy.lock}"

# Serialize deployments: only one deploy process may hold this lock.
exec 9>"$DEPLOY_LOCK_FILE"
if ! flock -n 9; then
  echo "DEPLOY_ALREADY_RUNNING: another deploy holds $DEPLOY_LOCK_FILE" >&2
  exit 75
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "DOCKER_COMPOSE_NOT_FOUND" >&2
  exit 1
fi

# Run Docker Compose with the production compose file selected explicitly.
compose() {
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" "$@"
}

# Fetch an internal HTTP endpoint from inside a named app container.
container_get() {
  local container_name="$1"
  local request_path="$2"

  docker exec "$container_name" node -e '
    const requestPath = process.argv[1]
    const port = process.env.PORT || "3003"
    fetch(`http://127.0.0.1:${port}${requestPath}`, { signal: AbortSignal.timeout(10_000) })
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

# Wait up to one minute for the app and its database connection to be ready.
wait_for_health() {
  local container_name="$1"

  for _ in {1..12}; do
    if container_get "$container_name" /api/ready >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

# Re-tag the preserved image and recreate the service from the Compose source of truth.
restore_old() {
  trap - ERR
  ROLLBACK_ARMED=0
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
  docker rm "$CONTAINER" >/dev/null 2>&1 || true
  if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
    echo "ROLLBACK_NAME_CONFLICT: $CONTAINER still exists" >&2
    return 2
  fi
  docker tag "$ROLLBACK_IMAGE" "$SERVICE_IMAGE_REF"
  compose up -d --no-deps --force-recreate "$SERVICE"
  if ! wait_for_health "$CONTAINER"; then
    echo "ROLLBACK_HEALTH_FAIL" >&2
    return 1
  fi
  container_get "$CONTAINER" /api/ready
  echo
  echo "ROLLED_BACK_TO_ORIGINAL"
}

# Roll back unexpected failures that occur after the original container is parked.
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

OLD_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$CONTAINER")"
SERVICE_IMAGE_REF="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER")"
if [[ -z "$OLD_IMAGE_ID" || -z "$SERVICE_IMAGE_REF" ]]; then
  echo "ROLLBACK_IMAGE_DISCOVERY_FAILED" >&2
  exit 1
fi
docker tag "$OLD_IMAGE_ID" "$ROLLBACK_IMAGE"
echo "ROLLBACK_IMAGE=$ROLLBACK_IMAGE"

echo "=== BUILD (live container remains untouched) ==="
compose build "$SERVICE"

echo "=== SWAP (original image retained as $ROLLBACK_IMAGE) ==="
ROLLBACK_ARMED=1
docker stop "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null
compose up -d "$SERVICE"

if ! wait_for_health "$CONTAINER"; then
  echo "NEW_HEALTH_FAIL" >&2
  restore_old
  exit 1
fi

echo "=== APPLY ALL PENDING MIGRATIONS (idempotent) ==="
# prisma migrate deploy applies every pending migration tracked in
# _prisma_migrations — new migrations no longer need a manual per-file step
# here (the Tasks Hub migration was missed this way on 2026-09-11).
#
# Baseline guard (cubic P1, PR #176): databases created via `prisma db push`
# (like prod) have no _prisma_migrations table, so migrate deploy fails with
# P3005 "database schema is not empty". In that case, baseline the DB: mark
# every existing migration as applied (the db-push schema already matches
# them) so only FUTURE migrations deploy.
MIG_OUT="$(compose exec -T "$SERVICE" npx prisma migrate deploy 2>&1)" || {
  if printf '%s' "$MIG_OUT" | grep -q 'P3005'; then
    echo "=== BASELINE database without _prisma_migrations (db-push legacy) ==="
    for dir in "$REPO_DIR"/prisma/migrations/*/; do
      name="$(basename "$dir")"
      compose exec -T "$SERVICE" npx prisma migrate resolve --applied "$name" \
        || { echo "MIGRATE_BASELINE_FAILED $name" >&2; restore_old; exit 1; }
    done
    MIG_OUT="$(compose exec -T "$SERVICE" npx prisma migrate deploy 2>&1)" \
      || { printf '%s\n' "$MIG_OUT" >&2; echo "MIGRATE_DEPLOY_FAILED" >&2; restore_old; exit 1; }
  else
    printf '%s\n' "$MIG_OUT" >&2
    echo "MIGRATE_DEPLOY_FAILED" >&2
    restore_old
    exit 1
  fi
}
printf '%s\n' "$MIG_OUT" | tail -3
# The onboarding SQL stays as belt-and-braces for pre-migrations databases.
if ! compose exec -T "$SERVICE" npx prisma db execute \
  --file prisma/migrations/20260426_add_onboarding_fields/migration.sql; then
  echo "MIGRATION_FAILED" >&2
  restore_old
  exit 1
fi
echo "MIGRATIONS_APPLIED"

echo "=== VERIFY ORG SCHEMA ALIGNMENT ==="
if ! compose exec -T "$SERVICE" npx prisma db execute --stdin <<'SQL'
DO $$
DECLARE
  schema_errors text;
BEGIN
  SELECT string_agg(expected.column_name, ', ' ORDER BY expected.column_name)
  INTO schema_errors
  FROM (
    VALUES
      ('onboardingCompleted', 'boolean', 'NO', 'false'),
      ('onboardingCompletedAt', 'timestamp without time zone', 'YES', NULL),
      ('onboardingStep', 'integer', 'NO', '0')
  ) AS expected(column_name, data_type, is_nullable, column_default)
  LEFT JOIN information_schema.columns AS actual
    ON actual.table_schema = 'public'
   AND actual.table_name = 'Organization'
   AND actual.column_name = expected.column_name
  WHERE actual.column_name IS NULL
     OR actual.data_type IS DISTINCT FROM expected.data_type
     OR actual.is_nullable IS DISTINCT FROM expected.is_nullable
     OR actual.column_default IS DISTINCT FROM expected.column_default;

  IF schema_errors IS NOT NULL THEN
    RAISE EXCEPTION 'Missing or mismatched Organization columns: %', schema_errors;
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
container_get "$CONTAINER" /api/ready
echo
LANDING_HTML="$(container_get "$CONTAINER" /)"
if [[ "$LANDING_HTML" != *'data-deploy-marker="public-landing-v1"'* ]]; then
  echo "LANDING_MARKER_FAIL" >&2
  restore_old
  exit 1
fi
echo "LANDING_MARKER_OK"
container_get "$CONTAINER" /sitemap.xml >/dev/null
echo "SITEMAP_OK"

ROLLBACK_ARMED=0
echo "ROLLBACK_IMAGE=$ROLLBACK_IMAGE"
echo "DEPLOY_V4_DONE"
