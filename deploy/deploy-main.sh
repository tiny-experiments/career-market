#!/bin/sh
# Deploy origin/main to /srv/projects/career-market: pull, build, migrate, restart api+worker, then
# check the API from inside Caddy's container. Run from a machine that can `ssh mide-cloud`.
set -e
ssh "${CM_DEPLOY_HOST:-mide-cloud}" 'set -e
cd /srv/projects/career-market
test -f deploy/.env || { echo "deploy/.env is missing; see Production in README.md" >&2; exit 1; }
git fetch -q origin main && git checkout -q main && git merge --ff-only -q origin/main && git log --oneline -1
dc() { docker compose -f deploy/docker-compose.yml "$@"; }
dc build -q
dc up -d --wait postgres
dc run --rm migrate
dc up -d --wait api
dc up -d worker
docker exec kurso-caddy-1 wget -qO- http://cm-api:4100/health; echo
meta=$(docker exec kurso-caddy-1 wget -qO- http://cm-api:4100/api/meta)
echo "$meta" | cut -c1-200
dc ps --format "{{.Service}} {{.Status}}"'
