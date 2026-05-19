#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# SOC Copilot — daily encrypted Postgres backup.
#
# Dumps the running Postgres container, gzips, encrypts with age, applies
# retention, and (optionally) pushes to an offsite rclone remote.
#
# Install + schedule via scripts/install_backup_timer.sh.
#
# Required env in /opt/soc-copilot/.env:
#   POSTGRES_USER, POSTGRES_DB           (already there for the app)
#   BACKUP_AGE_RECIPIENT                 age public key (recipient) for encryption
#
# Optional env:
#   BACKUP_DIR                 (default /var/backups/soc-copilot)
#   BACKUP_RCLONE_REMOTE       e.g. "b2:soc-copilot-backups/postgres"
#                              If set, pushes the encrypted dump there.
#   BACKUP_RETENTION_DAILY     (default 7)
#   BACKUP_RETENTION_WEEKLY    (default 4)
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="/opt/soc-copilot"
ENV_FILE="${REPO_DIR}/.env"
COMPOSE_FILE="${REPO_DIR}/infra/docker-compose.prod.yml"

# shellcheck disable=SC1090
set -a; . "${ENV_FILE}"; set +a

: "${POSTGRES_USER:?missing in .env}"
: "${POSTGRES_DB:?missing in .env}"
: "${BACKUP_AGE_RECIPIENT:?missing in .env — generate with: age-keygen -o ~/.age-key.txt}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/soc-copilot}"
RETAIN_DAILY="${BACKUP_RETENTION_DAILY:-7}"
RETAIN_WEEKLY="${BACKUP_RETENTION_WEEKLY:-4}"

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"
chmod 700 "${BACKUP_DIR}"

TS="$(date +%Y%m%d-%H%M%S)"
DOW="$(date +%u)"   # 1 = Mon ... 7 = Sun. We snapshot a weekly on Sundays.
DEST="${BACKUP_DIR}/daily/postgres-${TS}.sql.gz.age"

echo "==> dump + encrypt → ${DEST}"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --clean --if-exists \
  | gzip -9 \
  | age -r "${BACKUP_AGE_RECIPIENT}" -o "${DEST}"

chmod 600 "${DEST}"
echo "==> size: $(du -h "${DEST}" | cut -f1)"

# Weekly snapshot every Sunday (hardlink to save space).
if [[ "${DOW}" == "7" ]]; then
  WEEKLY="${BACKUP_DIR}/weekly/postgres-${TS}.sql.gz.age"
  ln "${DEST}" "${WEEKLY}"
  echo "==> weekly snapshot: ${WEEKLY}"
fi

# Retention.
echo "==> retention: keeping ${RETAIN_DAILY} daily, ${RETAIN_WEEKLY} weekly"
find "${BACKUP_DIR}/daily"  -type f -name '*.sql.gz.age' -printf '%T@ %p\n' \
  | sort -rn | awk -v keep="${RETAIN_DAILY}"  'NR>keep {print $2}' | xargs -r rm -v
find "${BACKUP_DIR}/weekly" -type f -name '*.sql.gz.age' -printf '%T@ %p\n' \
  | sort -rn | awk -v keep="${RETAIN_WEEKLY}" 'NR>keep {print $2}' | xargs -r rm -v

# Offsite (optional).
if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  if ! command -v rclone >/dev/null; then
    echo "WARN: BACKUP_RCLONE_REMOTE set but rclone not installed; skipping offsite." >&2
  else
    echo "==> offsite: rclone copy → ${BACKUP_RCLONE_REMOTE}"
    rclone copy "${DEST}" "${BACKUP_RCLONE_REMOTE}/daily/" \
      --transfers=2 --checkers=2 --quiet
    # Mirror retention to the remote (cheap; only deletes >N days old).
    rclone delete "${BACKUP_RCLONE_REMOTE}/daily/" --min-age "${RETAIN_DAILY}d" --quiet || true
  fi
fi

echo "==> backup OK"
