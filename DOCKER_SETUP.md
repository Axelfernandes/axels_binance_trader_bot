# Docker Setup Instructions

## Issue
Docker Desktop is installed but the Docker daemon is not running yet.

## Solution

### Option 1: Start Docker Desktop (Recommended)

1. Open **Docker Desktop** from your Applications folder
2. Wait for it to fully start (the Docker icon in your menu bar should turn solid/active)
3. Once running, we can start the PostgreSQL database with:
   ```bash
   docker compose up -d
   ```

### Option 2: Use Local PostgreSQL (Alternative)

If you prefer not to use Docker, we can install PostgreSQL locally via Homebrew:

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database
createdb binance_trader

# Run schema
psql binance_trader < database/schema.sql
```

Then update `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=binance_trader
DB_USER=your_username
DB_PASSWORD=
```

## Next Steps

Once Docker is running (or PostgreSQL is installed locally), we can:
1. Test Binance API connectivity
2. Start the backend server
3. Start the frontend dashboard
4. Begin paper trading
