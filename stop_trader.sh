#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
# Stop script for Binance Trader
PROJECT_DIR="/Users/axelfernandes/Desktop/applications/Binance_trader"
echo "🛑 Stopping Binance Trader..."

# Stop Docker
cd "$PROJECT_DIR"
docker compose down

# Kill Node processes
lsof -ti:3000,3001 | xargs kill -9 >/dev/null 2>&1

echo "✅ All processes stopped."
