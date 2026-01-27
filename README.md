# ₿ Axel's Binance Trader Bot

A high-performance, automated algorithmic trading bot for Binance Spot, featuring a stunning Glassmorphism Dashboard and real-time execution logic.

## 🚀 Overview

Axel's Binance Trader is a professional-grade trading system designed for low-latency market analysis and execution. Unlike traditional bots that rely on slow polling, this system utilizes **WebSockets** for millisecond-accurate data processing and a multi-strategy engine to capture high-probability setups across multiple assets.

---

## ✨ Key Features

### 📡 Real-Time WebSocket Architecture
We moved beyond the standard REST API limits. The bot maintains a persistent, full-duplex connection to Binance:
- **Zero Latency**: Price updates are *pushed* to the bot the moment a trade occurs on the exchange.
- **Dynamic Charts**: The frontend dashboard updates multiple times per second, providing a "live-flicker" experience just like professional trading terminals.
- **Efficient Scaling**: Handles multiple symbols (**BTC, ETH, SOL, BNB, XRP, ADA**) simultaneously without hitting REST rate limits.

### 🧠 Multi-Strategy Intelligence
The bot analyzes the market using three concurrent technical strategies:
1.  **EMA Crossover (Trend Following)**: 20/50 EMA crosses combined with RSI filters to capture established trends.
2.  **Bollinger Bands Mean Reversion (Range Trading)**: Identifies overextended price action at the bands for "bounce" plays in sideways markets.
3.  **MACD Momentum (Impulse Trading)**: Tracks histogram shifts to catch the early stages of a momentum explosion.

### 🛡️ Institutional-Grade Risk Management
- **Automatic Position Sizing**: Risks exactly 2% of equity per trade.
- **Hard Stop-Loss**: Every order is immediately protected by a 5% SL.
- **Daily Drawdown Protection**: Automatically pauses trading if a 10% daily loss limit is reached.
- **Paper Trading Mode**: Default mode allows for risk-free strategy validation against live data.

### 💻 Modern Glassmorphism UI
Built with **React 18** and **Vite**, the dashboard features:
- **Live Candlestick Charts**: Integrated with `lightweight-charts` for technical visualization.
- **Signal Rationale**: A transparency layer that explains the *why* behind every trade signal.
- **Trade History**: Full ledger of closed positions with exact P&L tracking ($ and %).

---

## 🛠️ Tech Stack

-   **Backend**: Node.js, TypeScript, Express
-   **Frontend**: React 18, Vite, Glassmorphism CSS, Recharts
-   **Database**: PostgreSQL (Dockerized)
-   **API**: Binance Node SDK + WebSockets (`ws`)
-   **Automation**: macOS App Bundles (`osacompile`)

---

## 🚦 Quick Start

### 1. Configure Environment
Create a `.env` file based on `.env.example` and add your Binance API keys.
```bash
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
TRADING_MODE=paper
```

### 2. One-Click Start (macOS)
I've included custom macOS App bundles for your desktop:
- **Binance Trader.app**: Launches Docker, the Backend, the Frontend, and opens the dashboard.
- **Stop Trader.app**: Safely shuts down all processes and clears the memory.

### 3. Manual Startup
```bash
# Start Database
docker compose up -d

# Start Backend
cd backend && npm install && npm run dev

# Start Frontend
cd frontend && npm install && npm run dev
```

---

## 📈 Future Upgrades
- [ ] **AI Sentiment Analysis**: Integrating news/social media sentiment to filter technical signals.
- [ ] **Trailing Stop-Loss**: Locking in profits during strong trend moves.
- [ ] **Custom Symbol Selector**: UI to add/remove assets on the fly.
- [ ] **Mobile View Optimization**: Native-feel wrapper for monitoring on the go.

## ⚖️ Disclaimer
This software is for educational purposes only. Cryptocurrency trading involves high risk. Never trade with money you cannot afford to lose.

---
**Maintained by [Axel Fernandes](https://github.com/Axelfernandes)**