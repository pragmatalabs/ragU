#!/usr/bin/env bash
set -euo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11440}"

echo "Waiting for Ollama to be ready..."
until curl -sf "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; do
  sleep 2
  echo "  Still waiting..."
done
echo "Ollama is ready!"

echo ""
echo "Pulling llama3.2:3b (chat model)..."
curl -sf "$OLLAMA_HOST/api/pull" -d '{"name": "llama3.2:3b", "stream": false}' | head -c 200
echo ""

echo ""
echo "Pulling nomic-embed-text (embedding model)..."
curl -sf "$OLLAMA_HOST/api/pull" -d '{"name": "nomic-embed-text", "stream": false}' | head -c 200
echo ""

echo ""
echo "Models ready:"
curl -sf "$OLLAMA_HOST/api/tags" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('models', []):
    size = m.get('size', 0) / 1e9
    print(f\"  - {m['name']} ({size:.1f}GB)\")
" 2>/dev/null || curl -sf "$OLLAMA_HOST/api/tags"

echo ""
echo "Done! You can now start the playground."
