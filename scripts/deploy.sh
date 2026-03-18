#!/usr/bin/env bash
set -euo pipefail

# ragU Production Deployment Script
# Target: Digital Ocean droplet (67.205.136.61)
# Domain: ragu.pragmata.cloud
# Assumes: Traefik already running via /opt/infra on traefik-public network

COMPOSE_FILE="docker-compose.prod.yml"

echo "=== ragU Deploy ==="
echo ""

# Check .env exists
if [ ! -f .env ]; then
  echo "No .env file found. Copying from .env.production..."
  cp .env.production .env
  echo ""
  echo "  IMPORTANT: Edit .env and set strong passwords before continuing!"
  echo "  nano .env"
  echo ""
  exit 1
fi

# Verify traefik-public network exists
if ! docker network inspect traefik-public > /dev/null 2>&1; then
  echo "ERROR: traefik-public network not found."
  echo "Make sure Traefik is running from /opt/infra first."
  exit 1
fi

# Build and start
echo "-> Building images..."
docker compose -f "$COMPOSE_FILE" build --parallel

echo ""
echo "-> Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "-> Waiting for Ollama to be ready..."
until docker exec ragu-ollama curl -sf http://localhost:11434/ > /dev/null 2>&1; do
  sleep 2
  printf "."
done
echo " ready"

echo ""
echo "-> Pulling Ollama models (first run may take a few minutes)..."
docker exec ragu-ollama ollama pull llama3.2:3b
docker exec ragu-ollama ollama pull nomic-embed-text

echo ""
echo "-> Service health:"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}"

echo ""
echo "=== Deploy complete ==="
echo ""
echo "  App:     https://ragu.pragmata.cloud"
echo "  Logs:    docker compose -f $COMPOSE_FILE logs -f"
echo "  Stop:    docker compose -f $COMPOSE_FILE down"
echo ""
