#!/usr/bin/env bash
# Build, tag, and push Nobonir images to Docker Hub.
#
# Usage:
#   DOCKER_USER=<your-dockerhub-username> ./docker-push.sh
#   # or pass as arg: ./docker-push.sh <your-dockerhub-username>
#
# Prereqs:
#   - Docker Desktop running
#   - `docker login` already completed (browser flow)

set -euo pipefail

DOCKER_USER="${1:-${DOCKER_USER:-}}"
if [ -z "$DOCKER_USER" ]; then
    echo "error: set DOCKER_USER env var or pass as first arg" >&2
    echo "example: DOCKER_USER=aliensarmy ./docker-push.sh" >&2
    exit 1
fi

TAG="${TAG:-latest}"
BACKEND_IMAGE="${DOCKER_USER}/nobonir-backend:${TAG}"
FRONTEND_IMAGE="${DOCKER_USER}/nobonir-frontend:${TAG}"

echo "==> verifying docker login"
docker info >/dev/null 2>&1 || {
    echo "docker engine not reachable. Is Docker Desktop running?" >&2
    exit 1
}

echo "==> building backend → ${BACKEND_IMAGE}"
docker build -t "$BACKEND_IMAGE" ./backend

echo "==> building frontend → ${FRONTEND_IMAGE}"
docker build -t "$FRONTEND_IMAGE" ./frontend

echo "==> pushing backend"
docker push "$BACKEND_IMAGE"

echo "==> pushing frontend"
docker push "$FRONTEND_IMAGE"

echo
echo "done. images on Docker Hub:"
echo "  https://hub.docker.com/r/${DOCKER_USER}/nobonir-backend"
echo "  https://hub.docker.com/r/${DOCKER_USER}/nobonir-frontend"
