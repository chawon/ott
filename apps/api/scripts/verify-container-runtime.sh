#!/usr/bin/env bash
set -euo pipefail

: "${API_RUNTIME_EXPECTED_VERSION:?Set the expected APP_VERSION for this image}"

prefix="ott-api-verify-${GITHUB_RUN_ID:-local}-${RANDOM}"
api_name="${prefix}-app"
db_name="${prefix}-db"
network_name="${prefix}-network"
responses="$(mktemp -d)"
base_url="http://127.0.0.1:18080"

cleanup() {
  docker logs "$api_name" 2>&1 || true
  docker rm -f "$api_name" "$db_name" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
  rm -rf "$responses"
}
trap cleanup EXIT

docker network create "$network_name" >/dev/null
docker run --detach --name "$db_name" --network "$network_name" \
  --env POSTGRES_DB=watchlog --env POSTGRES_USER=watchlog \
  --env POSTGRES_PASSWORD=verification postgres:16-alpine >/dev/null

db_ready=false
for attempt in {1..60}; do
  if docker exec "$db_name" pg_isready -U watchlog -d watchlog >/dev/null 2>&1; then
    db_ready=true
    break
  fi
  sleep 1
done
if [[ "$db_ready" != true ]]; then
  docker logs "$db_name"
  exit 1
fi

start_api() {
  local image="$1" database="$2" version="$3"
  docker run --detach --name "$api_name" --network "$network_name" \
    --publish 127.0.0.1:18080:8080 \
    --env "DB_URL=jdbc:postgresql://${db_name}:5432/${database}" \
    --env DB_USER=watchlog --env DB_PASSWORD=verification \
    --env "APP_VERSION=${version}" "$image" >/dev/null
}

wait_for_api() {
  local expected_version="$1"
  for attempt in {1..120}; do
    if curl --fail --silent --max-time 2 "$base_url/actuator/health" \
      --output "$responses/health.json" && \
      python3 -c 'import json, sys; sys.exit(json.load(open(sys.argv[1])).get("status") != "UP")' \
        "$responses/health.json"; then
      curl --fail --silent --show-error --max-time 5 "$base_url/actuator/info" \
        --output "$responses/info.json"
      python3 -c 'import json, sys; actual = json.load(open(sys.argv[1])).get("app", {}).get("version"); assert actual == sys.argv[2], (actual, sys.argv[2])' \
        "$responses/info.json" "$expected_version"
      return
    fi
    if [[ "$(docker inspect --format '{{.State.Running}}' "$api_name")" != true ]]; then
      return 1
    fi
    sleep 1
  done
  return 1
}

migration_history() {
  docker exec "$db_name" psql -U watchlog -d "$1" --tuples-only --no-align \
    --set ON_ERROR_STOP=1 --command \
    "SELECT string_agg(coalesce(version, '') || ':' || coalesce(checksum::text, '') || ':' || success::text, ',' ORDER BY installed_rank) FROM flyway_schema_history;"
}

start_api ott-api:verify watchlog "$API_RUNTIME_EXPECTED_VERSION"
wait_for_api "$API_RUNTIME_EXPECTED_VERSION"
first_history="$(migration_history watchlog)"
[[ -n "$first_history" ]]
echo "PASS API startup, PostgreSQL migrations, JPA validation and APP_VERSION"
python3 scripts/verify-api-contracts.py --snapshot "$responses/fresh-api.json" --seed

docker restart "$api_name" >/dev/null
wait_for_api "$API_RUNTIME_EXPECTED_VERSION"
second_history="$(migration_history watchlog)"
[[ "$first_history" == "$second_history" ]]
python3 scripts/verify-api-contracts.py --snapshot "$responses/fresh-api.json"
echo "PASS API restart with existing PostgreSQL database and unchanged Flyway history"

if [[ -n "${API_RUNTIME_BASELINE_IMAGE:-}" ]]; then
  : "${API_RUNTIME_BASELINE_VERSION:?Set the baseline APP_VERSION}"
  docker logs "$api_name"
  docker rm -f "$api_name" >/dev/null
  docker exec "$db_name" createdb -U watchlog watchlog_upgrade

  start_api "$API_RUNTIME_BASELINE_IMAGE" watchlog_upgrade "$API_RUNTIME_BASELINE_VERSION"
  wait_for_api "$API_RUNTIME_BASELINE_VERSION"
  baseline_history="$(migration_history watchlog_upgrade)"
  [[ -n "$baseline_history" ]]
  python3 scripts/verify-api-contracts.py --snapshot "$responses/baseline-api.json" --seed

  docker logs "$api_name"
  docker rm -f "$api_name" >/dev/null
  start_api ott-api:verify watchlog_upgrade "$API_RUNTIME_EXPECTED_VERSION"
  wait_for_api "$API_RUNTIME_EXPECTED_VERSION"
  upgraded_history="$(migration_history watchlog_upgrade)"
  [[ "$upgraded_history," == "$baseline_history,"* ]]
  [[ "$upgraded_history" == "$first_history" ]]
  python3 scripts/verify-api-contracts.py --snapshot "$responses/baseline-api.json"
  echo "PASS API upgrade from baseline image with preserved records and Flyway history"

  docker restart "$api_name" >/dev/null
  wait_for_api "$API_RUNTIME_EXPECTED_VERSION"
  [[ "$upgraded_history" == "$(migration_history watchlog_upgrade)" ]]
  python3 scripts/verify-api-contracts.py --snapshot "$responses/baseline-api.json"
  echo "PASS upgraded API restart with preserved records and Flyway history"
fi
