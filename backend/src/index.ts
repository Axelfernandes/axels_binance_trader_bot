import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';
import { CandleChartInterval } from 'binance-api-node';
import client from './config/database'; // Amplify Client
import tradingService from './services/trading.service';
import binanceService from './services/binance.service';
import logger from './utils/logger';
import geminiService from './services/gemini.service';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });
// ... existing WS code ...
// (I will need to be careful not to delete WS code by matching too much)

// ...
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply Auth Middleware to all subsequent API routes
app.use('/api', authMiddleware);

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
        const { data: snapshots } = await client.models.AccountSnapshot.list({
            limit: 100,
            sortDirection: 'DESC' // Note: creation time sort depends on schema keys, usually listed naturally or needs index
            // For now assuming list returns unordered or default order, frontend might need sorting
        });

        // Manual sort if needed since DynamoDB scan/query order varies without index
        const sorted = snapshots.sort((a: any, b: any) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        res.json(sorted);
    } catch (error: any) {
        logger.error('Error fetching snapshots:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get recent signals
app.get('/api/signals', async (req, res) => {
    try {
        // limit is ignored in basic list unless implemented, fetching default page
        const { data: signals } = await client.models.Signal.list({
            limit: 20
        });

        // Parse rationale string back to JSON if stored as string
        const formatted = signals.map((s: any) => ({
            ...s,
            rationale: typeof s.rationale === 'string' ? JSON.parse(s.rationale) : s.rationale
        })).sort((a: any, b: any) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());

        res.json(formatted);
    } catch (error: any) {
        logger.error('Error fetching signals:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get trades
app.get('/api/trades', async (req, res) => {
    try {
        const status = req.query.status as string;
        let filter: any = {};

        if (status) {
            filter.status = { eq: status.toUpperCase() };
        }

        const { data: trades } = await client.models.Trade.list({
            filter,
            limit: 50
        });

        const sorted = trades.sort((a: any, b: any) =>
            new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
        );

        res.json(sorted);
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
        // Get account snapshots
        const { data: snapshots } = await client.models.AccountSnapshot.list({ limit: 100 }); // List some to find latest
        const latestSnapshot = snapshots.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        // Get open positions
        const { data: openTrades } = await client.models.Trade.list({
            filter: { status: { eq: 'OPEN' } }
        });

        // Get current day's closed trades for PnL
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: allTrades } = await client.models.Trade.list({}); // Warning: Scan operation
        const closedTrades = allTrades.filter((t: any) => t.status === 'CLOSED');

        const dailyTrades = closedTrades.filter((t: any) => new Date(t.closed_at) >= today);
        const dailyPnl = dailyTrades.reduce((sum: number, t: any) => sum + (t.realized_pnl || 0), 0);

        // Win Rate
        const wins = closedTrades.filter((t: any) => (t.realized_pnl || 0) > 0).length;
        const totalClosed = closedTrades.length;
        const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;

        res.json({
            totalEquity: latestSnapshot?.total_equity || 0,
            availableBalance: latestSnapshot?.available_balance || 0,
            openPositions: openTrades.length,
            dailyPnl: dailyPnl,
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
    // pool.end(); // No connection pool to close with Amplify client
    process.exit(0);
});