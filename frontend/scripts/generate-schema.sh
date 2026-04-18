#!/bin/bash
# Generate OpenAPI TypeScript schema for Second Voice frontend
# Reads NEXT_PUBLIC_API_BASE_URL from .env and pulls the backend's OpenAPI spec

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Generating OpenAPI TypeScript schema...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

API_URL="${NEXT_PUBLIC_API_BASE_URL:-}"
if [ -z "$API_URL" ]; then
  ENV_FILE="$PROJECT_ROOT/.env"
  if [ -f "$ENV_FILE" ]; then
    API_URL=$(grep -E "^NEXT_PUBLIC_API_BASE_URL=" "$ENV_FILE" | sed -E 's/^NEXT_PUBLIC_API_BASE_URL="?([^"]*)"?/\1/' | head -n 1)
  fi
fi

if [ -z "$API_URL" ]; then
  echo -e "${RED}NEXT_PUBLIC_API_BASE_URL not set in env or .env${NC}"
  exit 1
fi

DOCS_URL="${API_URL}/api/docs-json"
OUTPUT_FILE="$PROJECT_ROOT/src/schema.d.ts"

echo -e "${YELLOW}Fetching ${DOCS_URL}${NC}"

cd "$PROJECT_ROOT"
npx --yes openapi-typescript "$DOCS_URL" -o "$OUTPUT_FILE"
echo -e "${GREEN}Schema written to src/schema.d.ts${NC}"
