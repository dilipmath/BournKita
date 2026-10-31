#!/usr/bin/env bash
# Tests the backups end to end, as the Kita would use them: starts the production stack (with
# test settings, as its own Compose project), records a Child with an Alert and a photo through
# the HTTPS API, runs the nightly and the weekly backup, then restores each into a fresh database
# and photo folder and checks through the API that everything is back. Removes it all afterwards.
#
#   bash backup/test-restore.sh
set -euo pipefail
cd "$(dirname "$0")/.."

work=$(mktemp -d)
# Docker on Windows (Git Bash) wants Windows paths for folders it mounts.
host_path() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
mkdir -p "$work/backups" "$work/offsite"

export COMPOSE_PROJECT_NAME=kita-restore-test
export KITA_HOSTNAME=localhost
export KITA_HTTP_PORT=8180
export KITA_HTTPS_PORT=8443
export KITA_DB_PASSWORD=restore-test-db-password
# Replaced below, once the images are built: the app makes this test its own key.
export KITA_ENCRYPTION_KEY=pending
export KITA_BACKUP_DIR; KITA_BACKUP_DIR=$(host_path "$work/backups")
export KITA_OFFSITE_DIR; KITA_OFFSITE_DIR=$(host_path "$work/offsite")
# Replaced below, once the backup image can make a key pair.
export KITA_BACKUP_AGE_RECIPIENT=pending

compose() { MSYS_NO_PATHCONV=1 docker compose -f compose.prod.yaml "$@"; }
cleanup() {
  # KEEP_STACK=1 leaves it running, e.g. to look into a failure.
  [ -n "${KEEP_STACK:-}" ] && return
  # The backups belong to the containers' root user, so a container deletes them.
  compose run --rm --no-deps -T backup sh -c 'rm -rf /backups/* /offsite/*' > /dev/null 2>&1 || true
  compose down --volumes --remove-orphans > /dev/null 2>&1 || true
  rm -rf "$work" 2> /dev/null || true
}
trap cleanup EXIT

step() { echo "== $*"; }
fail() { echo "FAILED: $*" >&2; exit 1; }

step "Making the keys"
compose build --quiet
KITA_ENCRYPTION_KEY=$(compose run --rm --no-deps -T api kita-admin generate-key 2> /dev/null | tail -n 1)
compose run --rm --no-deps -T backup age-keygen > "$work/identity.txt" 2> /dev/null
KITA_BACKUP_AGE_RECIPIENT=$(grep -o 'age1[0-9a-z]*' "$work/identity.txt" | head -n 1)
[ -n "$KITA_BACKUP_AGE_RECIPIENT" ] || fail "no age public key"

step "Starting the production stack"
compose up --detach --wait

PASSWORD="restore test password"
printf '%s\n%s\n' "$PASSWORD" "$PASSWORD" |
  compose exec -T api kita-admin create-admin --email leitung@kita.example > /dev/null

jar="$work/cookies"
# The Kita's own certificate authority signed the certificate, which curl does not know: -k.
api() { curl --fail-with-body --silent --show-error -k -b "$jar" -c "$jar" "https://localhost:$KITA_HTTPS_PORT$1" "${@:2}"; }
json() { api "$1" -X "$2" -H 'Content-Type: application/json' --data "$3"; }
id_of() { grep -o '"id":[0-9]*' | head -n 1 | cut -d: -f2; }
log_in() {
  rm -f "$jar"
  json /api/session POST "{\"email\":\"leitung@kita.example\",\"password\":\"$PASSWORD\"}" > /dev/null
}

step "Recording a Child with an Alert and a photo"
log_in
child=$(json /api/children POST '{"firstName":"Lena","lastName":"Weber"}' | id_of)
json "/api/children/$child/alerts" POST '{"kind":"allergy","name":"Peanuts"}' > /dev/null
json "/api/children/$child/consents/photo/given" POST '{"givenOn":"2026-09-01"}' > /dev/null
compose exec -T api python -c "
import io, sys
from PIL import Image
buffer = io.BytesIO()
Image.new('RGB', (64, 48), (200, 120, 40)).save(buffer, 'JPEG')
sys.stdout.buffer.write(buffer.getvalue())" > "$work/photo.jpg"
photo=$(api "/api/children/$child/photos" -X POST -F "photo=@$(host_path "$work/photo.jpg");type=image/jpeg" | id_of)

all_back() {
  log_in
  api "/api/children/$child" | grep -q '"name":"Peanuts"' || fail "the Child or its Alert is missing"
  api "/api/children/$child/photos/$photo/full" -o "$work/restored.jpg" || fail "the photo is missing"
  cmp -s "$work/stored.jpg" "$work/restored.jpg" || fail "the photo is not the one stored"
}
# The photo as the app keeps it (resized on upload), to compare with after each restore.
api "/api/children/$child/photos/$photo/full" -o "$work/stored.jpg"
all_back

step "Running the nightly and the weekly backup"
compose exec -T backup nightly
compose exec -T backup weekly
ls "$work/offsite"/*.age > /dev/null || fail "no off-site backup"

step "Restoring the nightly backup into a fresh database and photo folder"
compose down --volumes
compose up --detach --wait db
compose run --rm -T backup restore latest
compose up --detach --wait
all_back

step "Restoring the off-site backup, with the private key, into a fresh database and photo folder"
compose down --volumes
# Without the second drive: only the off-site copy and the private key are left. Deleted in a
# container: the backups belong to its root user, not to whoever runs this test.
compose run --rm --no-deps -T backup sh -c 'rm -rf /backups/*'
compose up --detach --wait db
offsite=$(basename "$(ls "$work/offsite"/*.age | tail -n 1)")
compose run --rm -T -v "$(host_path "$work/identity.txt"):/run/age-identity.txt:ro" backup \
  restore-offsite "/offsite/$offsite" /run/age-identity.txt
compose up --detach --wait
all_back

echo "Restore test passed."
