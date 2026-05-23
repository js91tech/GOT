#!/bin/sh
set -e

echo "Westeros Bot starting (SERVICE=${SERVICE:-web})"
echo "DATABASE_PATH=${DATABASE_PATH:-/data/westeros.db}"

npm run db:init -w @westeros/game-core || true

if [ "$SERVICE" = "bot" ]; then
  echo "Starting Discord bot..."
  exec npm run start -w @westeros/discord-bot
fi

if [ "$SERVICE" = "api" ]; then
  echo "Starting game API..."
  exec npm run start -w @westeros/api
fi

echo "Starting web UI..."
exec npm run start -w @westeros/web
