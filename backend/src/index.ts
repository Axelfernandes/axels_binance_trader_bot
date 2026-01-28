import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';
import { CandleChartInterval } from 'binance-api-node';
import pool from './config/database';
import tradingService from './services/trading.service';
import binanceService from './services/binance.service';
import logger from './utils/logger';
import geminiService from './services/gemini.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });

const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
    'PEPEUSDT', 'DOGEUSDT', 'SHIBUSDT', 'WIFUSDT', 'BONKUSDT', 'FETUSDT'
];

// Subscribe to Binance WebSockets
binanceService.subscribeToMiniTickers(symbols, (ticker) => {
    const data = JSON.stringify({
        type: 'PRICE_UPDATE',
        symbol: ticker.symbol,
        price: ticker.curDayClose,
    });
    
    wss.clients.forEach((client: any) => {
        if (client.readyState === 1) { // OPEN
            client.send(data);
        }
    });
});

wss.on('connection', (ws: any) => {
    logger.info('New WebSocket client connected');
    
    ws.on('close', () => {
        logger.info('WebSocket client disconnected');
    });
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get account balance
app.get('/api/account/balance', async (req, res) => {
    try {
        const balance = await binanceService.getAccountBalance();
        res.json(balance);
    } catch (error: any) {
        logger.error('Error fetching balance:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get account snapshots (equity over time)
app.get('/api/account/snapshots', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM account_snapshots 
       ORDER BY timestamp DESC 
       LIMIT 100`
        );
        res.json(result.rows);
    } catch (error: any) {
        logger.error('Error fetching snapshots:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get recent signals
app.get('/api/signals', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await pool.query(
            `SELECT * FROM signals 
       ORDER BY generated_at DESC 
       LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (error: any) {
        logger.error('Error fetching signals:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get trades
app.get('/api/trades', async (req, res) => {
    try {
        const status = req.query.status as string;
        let query = 'SELECT * FROM trades';
        const params: any[] = [];

        if (status) {
            query += ' WHERE status = $1';
            params.push(status.toUpperCase());
        }

        query += ' ORDER BY opened_at DESC LIMIT 50';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        logger.error('Error fetching trades:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get current price for a symbol
app.get('/api/price/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const price = await binanceService.getCurrentPrice(symbol.toUpperCase());
        res.json({ symbol, price });
    } catch (error: any) {
        logger.error('Error fetching price:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get OHLCV data
app.get('/api/klines/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const intervalStr = (req.query.interval as string) || '1h';
        const limit = parseInt(req.query.limit as string) || 100;

        // Map string interval to enum
        const intervalMap: Record<string, CandleChartInterval> = {
            '1m': CandleChartInterval.ONE_MINUTE,
            '5m': CandleChartInterval.FIVE_MINUTES,
            '15m': CandleChartInterval.FIFTEEN_MINUTES,
            '1h': CandleChartInterval.ONE_HOUR,
            '4h': CandleChartInterval.FOUR_HOURS,
            '1d': CandleChartInterval.ONE_DAY,
        };

        const interval = intervalMap[intervalStr] || CandleChartInterval.ONE_HOUR;

        const klines = await binanceService.getKlines(
            symbol.toUpperCase(),
            interval,
            limit
        );
        res.json(klines);
    } catch (error: any) {
        logger.error('Error fetching klines:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start trading engine
app.post('/api/trading/start', async (req, res) => {
    try {
        await tradingService.start();
        res.json({ message: 'Trading engine started' });
    } catch (error: any) {
        logger.error('Error starting trading engine:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Stop trading engine
app.post('/api/trading/stop', (req, res) => {
    try {
        tradingService.stop();
        res.json({ message: 'Trading engine stopped' });
    } catch (error: any) {
        logger.error('Error stopping trading engine:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get Market Brief
app.get('/api/market-brief', async (req, res) => {
    try {
        const mainSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'];
        const marketDataPromises = mainSymbols.map(symbol => binanceService.get24hrTickerPriceChange(symbol));
        const allMarketStats = await Promise.all(marketDataPromises);

        const formattedMarketData = allMarketStats.map(stats => {
            return `${stats.symbol}: Current Price: $${stats.lastPrice}, 24h Change: ${stats.priceChangePercent.toFixed(2)}%, High: $${stats.highPrice}, Low: $${stats.lowPrice}, Volume: ${stats.volume.toFixed(0)}`;
        }).join('\n');

        const brief = await geminiService.getMarketBrief(formattedMarketData);
        res.json({ brief });
    } catch (error: any) {
        logger.error('Error fetching market brief:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        // Get latest account snapshot
        const snapshotResult = await pool.query(
            `SELECT * FROM account_snapshots ORDER BY timestamp DESC LIMIT 1`
        );

        // Get open positions count
        const openPositionsResult = await pool.query(
            `SELECT COUNT(*) as count FROM trades WHERE status = 'OPEN'`
        );

        // Get today's PnL
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dailyPnlResult = await pool.query(
            `SELECT SUM(realized_pnl) as daily_pnl 
       FROM trades 
       WHERE closed_at >= $1 AND status = 'CLOSED'`,
            [today]
        );

        // Get win rate
        const winRateResult = await pool.query(
            `SELECT 
         COUNT(*) FILTER (WHERE realized_pnl > 0) as wins,
         COUNT(*) as total
       FROM trades 
       WHERE status = 'CLOSED'`
        );

        const snapshot = snapshotResult.rows[0];
        const wins = parseInt(winRateResult.rows[0]?.wins || '0');
        const total = parseInt(winRateResult.rows[0]?.total || '0');
        const winRate = total > 0 ? (wins / total) * 100 : 0;

        res.json({
            totalEquity: parseFloat(snapshot?.total_equity || '0'),
            availableBalance: parseFloat(snapshot?.available_balance || '0'),
            openPositions: parseInt(openPositionsResult.rows[0]?.count || '0'),
            dailyPnl: parseFloat(dailyPnlResult.rows[0]?.daily_pnl || '0'),
            winRate: winRate.toFixed(2),
            tradingMode: process.env.TRADING_MODE || 'paper',
        });
    } catch (error: any) {
        logger.error('Error fetching dashboard stats:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start server
server.listen(Number(PORT), '0.0.0.0', () => {
    logger.info(`🚀 Server running on http://0.0.0.0:${PORT}`);
    logger.info(`Trading mode: ${process.env.TRADING_MODE || 'paper'}`);

    // Auto-start trading engine
    setTimeout(async () => {
        logger.info('Auto-starting trading engine...');
        await tradingService.start();
    }, 2000);
});

// Global Error Handlers
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    tradingService.stop();
    pool.end();
    process.exit(0);
});