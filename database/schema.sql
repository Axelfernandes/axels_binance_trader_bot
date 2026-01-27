-- Binance Trading Bot Database Schema

-- Users table (single user for Phase 1)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account snapshots for equity tracking
CREATE TABLE IF NOT EXISTS account_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_equity DECIMAL(18, 8) NOT NULL,
    available_balance DECIMAL(18, 8) NOT NULL,
    locked_balance DECIMAL(18, 8) DEFAULT 0,
    daily_pnl DECIMAL(18, 8) DEFAULT 0
);

CREATE INDEX idx_snapshots_timestamp ON account_snapshots(timestamp DESC);
CREATE INDEX idx_snapshots_user ON account_snapshots(user_id);

-- Strategy parameters
CREATE TABLE IF NOT EXISTS strategy_params (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ma_short INTEGER DEFAULT 20,
    ma_long INTEGER DEFAULT 50,
    rsi_period INTEGER DEFAULT 14,
    rsi_overbought INTEGER DEFAULT 70,
    rsi_oversold INTEGER DEFAULT 30,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trading signals
CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- LONG, SHORT, NO_TRADE
    entry_min DECIMAL(18, 8),
    entry_max DECIMAL(18, 8),
    stop_loss DECIMAL(18, 8),
    take_profit_1 DECIMAL(18, 8),
    take_profit_2 DECIMAL(18, 8),
    take_profit_3 DECIMAL(18, 8),
    max_risk_percent DECIMAL(5, 2),
    rationale JSONB, -- Array of reasons
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed BOOLEAN DEFAULT FALSE,
    executed_at TIMESTAMP
);

CREATE INDEX idx_signals_timestamp ON signals(generated_at DESC);
CREATE INDEX idx_signals_symbol ON signals(symbol);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    signal_id INTEGER REFERENCES signals(id) ON DELETE SET NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL, -- BUY, SELL
    order_type VARCHAR(20) NOT NULL, -- MARKET, LIMIT, STOP_LOSS_LIMIT
    entry_price DECIMAL(18, 8) NOT NULL,
    exit_price DECIMAL(18, 8),
    quantity DECIMAL(18, 8) NOT NULL,
    stop_loss DECIMAL(18, 8),
    take_profit DECIMAL(18, 8),
    realized_pnl DECIMAL(18, 8),
    realized_pnl_percent DECIMAL(8, 4),
    fees DECIMAL(18, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, CLOSED, CANCELLED
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    is_paper_trade BOOLEAN DEFAULT TRUE,
    notes TEXT
);

CREATE INDEX idx_trades_timestamp ON trades(opened_at DESC);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_symbol ON trades(symbol);

-- Insert default user (for single-user setup)
INSERT INTO users (email, password_hash) 
VALUES ('trader@local.dev', 'default_hash_change_later')
ON CONFLICT (email) DO NOTHING;

-- Insert default strategy parameters
INSERT INTO strategy_params (user_id, ma_short, ma_long, rsi_period, rsi_overbought, rsi_oversold)
SELECT id, 20, 50, 14, 70, 30 FROM users WHERE email = 'trader@local.dev'
ON CONFLICT DO NOTHING;
