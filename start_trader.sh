#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Absolute path to the project
PROJECT_DIR="/Users/axelfernandes/Desktop/applications/Binance_trader"

echo "🚀 Starting Binance Trader Project..."
cd "$PROJECT_DIR"

# 1. Start Docker Container (Database)
echo "📦 Starting Database..."
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop first."
    exit 1
fi
docker compose up -d

# 2. Start Backend
echo "⚙️  Starting Backend..."
# Kill any existing backend process on port 3001
lsof -ti:3001 | xargs kill -9 >/dev/null 2>&1
cd "$PROJECT_DIR/backend"
# Use direct node execution for stability
nohup node dist/index.js > "$PROJECT_DIR/backend.log" 2>&1 &

# 3. Start Frontend
echo "💻 Starting Frontend UI..."
# Kill any existing frontend process on port 3000
lsof -ti:3000 | xargs kill -9 >/dev/null 2>&1
cd "$PROJECT_DIR/frontend"
nohup npm run dev > "$PROJECT_DIR/frontend.log" 2>&1 &

# 4. Wait and Open Dashboard
echo "⏳ Waiting for servers to initialize..."
sleep 10
echo "🌐 Opening Dashboard: http://localhost:3000"
open "http://localhost:3000"

echo "✅ Done! Project is running in the background."
echo "📝 Logs available in backend.log and frontend.log"