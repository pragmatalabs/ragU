#!/usr/bin/env bash
set -euo pipefail

# ragU Production Deployment Script
# Target: Digital Ocean droplet with Docker
# Domain: ragu.pragmata.cloud

COMPOSE_FILE="docker-compose.prod.yml"
PROJECT="ragu"

echo "=== ragU Production Deploy ==="
echo ""

# Check .env exists
if [ ! -f .env ]; then
  echo "No .env file found. Copying from .env.production..."
  cp .env.production .env
  echo ""
  echo "⚠  IMPORTANT: Edit .env and set strong passwords before continuing!"
  echo "   nano .env"
  echo ""
  exit 1
fi

# Build and start
echo "→ Building images..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" build --parallel

echo ""
echo "→ Starting services..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" up -d

echo ""
echo "→ Waiting for Ollama to be ready..."
until docker exec ragu-ollama curl -sf http://localhost:11434/ > /dev/null 2>&1; do
  sleep 2
  echo "  waiting..."
done

echo ""
echo "→ Pulling Ollama models (this may take a few minutes on first run)..."
docker exec ragu-ollama ollama pull llama3.2:3b
docker exec ragu-ollama ollama pull nomic-embed-text

echo ""
echo "→ Checking service health..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT" ps

echo ""
echo "=== Deploy complete ==="
echo ""
echo "  App:       https://ragu.pragmata.cloud"
echo "  Traefik:   https://traefik.ragu.pragmata.cloud (if auth configured)"
echo ""
echo "  Logs:      docker compose -f $COMPOSE_FILE -p $PROJECT logs -f"
echo "  Stop:      docker compose -f $COMPOSE_FILE -p $PROJECT down"
echo "  Restart:   docker compose -f $COMPOSE_FILE -p $PROJECT restart"
echo ""
