# ₿ Binance Trader Operator

![Build Status](https://img.shields.io/badge/Amplify-Live_Deployment-success?style=for-the-badge&logo=aws-amplify)
![AI Status](https://img.shields.io/badge/AI_Engine-Gemini_Flash-blue?style=for-the-badge&logo=google-gemini)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge&logo=opensourceinitiative)

> **The next generation of algorithmic trading.** A pro-grade, WebSocket-powered execution engine with institutional risk management and a stunning glassmorphism dashboard.

---

## ⚡ Live Intelligence
Axel's Binance Trader isn't just a bot; it's a **real-time execution terminal**. Deployed on **AWS Amplify**, it leverages a serverless backend and a low-latency WebSocket architecture to capture market moves as they happen.

### 🧩 Strategic Core
- **Hybrid Strategy Engine**: Multi-timeframe EMA Crossover, Bollinger Bands Mean Reversion, and MACD Momentum histograms.
- **AI Validation Layer**: Every signal is cross-referenced with Google Gemini for high-conviction filtering.
- **Microsecond Precision**: No polling. 100% WebSocket-driven price discovery and candle formation.

---

## 🛡️ Security & Access
This installation is **Locked & Hardened**. 

- **Single-User Restriction**: Exclusive access via AWS Cognito, restricted to one authorized developer email.
- **Zero Public Sign-ups**: Self-registration is disabled at the infrastructure level.
- **Secure Secret Vault**: All API keys and trading secrets are managed via AWS Secrets Manager / environment encryption.

---

## 🎨 Professional Dashboard
A state-of-the-art **Glassmorphism UI** provides a 360-degree view of your operations:
- **Live TradingView Charts**: High-performance kline visualization.
- **Real-time P&L Ledger**: Instant tracking of realized and unrealized gains.
- **Bot Rationale**: AI-generated explanations for every entry and exit.

---

## 🚀 Deployment Snapshot
| Flow | Tech |
| :--- | :--- |
| **Frontend** | React 18 + Vite (Deployed on Amplify) |
| **Backend** | Node.js + TypeScript (Amplify Functions / Serverless) |
| **Database** | **Amazon DynamoDB** (Amplify Gen 2 Data) |
| **Auth** | Amazon Cognito + Custom Single-User Middleware |

---

## 🚦 Quick Start with Amplify Gen 2

1. **Clone & Config**:
   ```bash
   git clone https://github.com/Axelfernandes/Binance_trader
   cp .env.example .env
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Amplify Sandbox (Local Dev)**:
   ```bash
   npx amplify sandbox
   ```
   *This starts a local development environment with your DynamoDB tables.*

4. **Production Deployment**:
   Push to the `main` branch to trigger the Amplify console deployment:
   ```bash
   git push origin main
   ```

### 🔑 Environment Variables (Amplify Console)
Ensure these are set in your Amplify App settings:
- `VITE_API_URL`: Your backend API URL
- `ALLOWED_EMAIL`: The authorized user email
- `GEMINI_API_KEY`: Google Gemini API Key
- `BINANCE_API_KEY` & `BINANCE_API_SECRET`: Trading credentials

---

*Educational purposes only. Maximize your edge, manage your risk.*
