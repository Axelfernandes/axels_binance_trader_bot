import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';
import { CandleChartInterval } from 'binance-api-node';
import type { Query } from 'firebase-admin/firestore';
import { db } from './config/database';
import tradingService from './services/trading.service';
import binanceService from './services/binance.service';
import logger from './utils/logger';
import geminiService from './services/gemini.service';
import { authMiddleware } from './middleware/firebaseAuth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4500;
const server = http.createServer(app);

type TradingConfig = {
    id: string;
    cadence: string;
    enabled: boolean;
    updated_at: string;
};

const CONFIG_ID = 'main';
const DEFAULT_CONFIG = {
    cadence: 'STANDARD_1M',
    enabled: true,
};

async function getOrCreateConfig(): Promise<TradingConfig> {
    const ref = db.collection('tradingConfig').doc(CONFIG_ID);
    const snap = await ref.get();
    if (!snap.exists) {
        const payload = { ...DEFAULT_CONFIG, updated_at: new Date().toISOString() };
        await ref.set(payload);
        return { id: ref.id, ...payload };
    }
    const data = snap.data() as Omit<TradingConfig, 'id'> | undefined;
    return {
        id: snap.id,
        cadence: data?.cadence || DEFAULT_CONFIG.cadence,
        enabled: typeof data?.enabled === 'boolean' ? data.enabled : DEFAULT_CONFIG.enabled,
        updated_at: data?.updated_at || new Date().toISOString(),
    };
}

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
// app.use('/api', authMiddleware);

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
        const snapshotsSnap = await db
            .collection('accountSnapshots')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        const sorted = snapshotsSnap.docs.map(d => d.data());
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
        const signalsSnap = await db.collection('signals').orderBy('generated_at', 'desc').limit(20).get();
        const formatted = signalsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
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
        let query: Query = db.collection('trades');
        if (status) {
            query = query.where('status', '==', status.toUpperCase());
        }
        const tradesSnap = await query.orderBy('opened_at', 'desc').limit(50).get();
        const sorted = tradesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json(sorted);
    } catch (error: any) {
        logger.error('Error fetching trades:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Close a trade manually
app.post('/api/trades/:id/close', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get the trade
        const tradeDoc = await db.collection('trades').doc(id).get();
        if (!tradeDoc.exists) {
            return res.status(404).json({ error: 'Trade not found' });
        }
        
        const trade = tradeDoc.data();
        if (trade?.status !== 'OPEN') {
            return res.status(400).json({ error: 'Trade is not open' });
        }
        
        // Get current price
        const currentPrice = await binanceService.getCurrentPrice(trade.symbol);
        
        // Place sell order (in paper mode, this just logs)
        await binanceService.placeMarketOrder(
            trade.symbol,
            'SELL',
            trade.quantity
        );
        
        // Calculate PnL
        const realizedPnl = (currentPrice - trade.entry_price) * trade.quantity;
        const realizedPnlPercent = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;
        
        // Update trade in database
        await db.collection('trades').doc(id).update({
            status: 'CLOSED',
            exit_price: currentPrice,
            realized_pnl: realizedPnl,
            realized_pnl_percent: realizedPnlPercent,
            closed_at: new Date().toISOString(),
            close_reason: 'MANUAL'
        });
        
        logger.info(`✅ Trade closed manually: ${trade.symbol} | PnL: $${realizedPnl.toFixed(2)} (${realizedPnlPercent.toFixed(2)}%)`);
        
        res.json({
            message: 'Trade closed successfully',
            tradeId: id,
            realizedPnl,
            realizedPnlPercent
        });
    } catch (error: any) {
        logger.error('Error closing trade:', error.message);
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

// Get trading config
app.get('/api/trading/config', async (req, res) => {
    try {
        const config = await getOrCreateConfig();
        res.json(config);
    } catch (error: any) {
        logger.error('Error fetching trading config:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Update trading config (cadence + enabled)
app.post('/api/trading/config', async (req, res) => {
    try {
        const { cadence, enabled } = req.body || {};
        const ref = db.collection('tradingConfig').doc(CONFIG_ID);
        const current = await getOrCreateConfig();

        const next = {
            cadence: cadence || current.cadence,
            enabled: typeof enabled === 'boolean' ? enabled : current.enabled,
            updated_at: new Date().toISOString(),
        };

        await ref.set(next, { merge: true });
        res.json({ id: CONFIG_ID, ...next });
    } catch (error: any) {
        logger.error('Error updating trading config:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Run a single trading cycle (for Cloud Scheduler)
app.post('/api/trading/run', async (req, res) => {
    try {
        const cadence = (req.query.cadence as string) || req.body?.cadence;
        const config = await getOrCreateConfig();

        if (!config.enabled) {
            return res.json({ skipped: 'disabled' });
        }

        if (cadence && config.cadence !== cadence) {
            return res.json({ skipped: `cadence mismatch (${config.cadence} vs ${cadence})` });
        }

        await tradingService.runOnce();
        res.json({ ok: true, cadence: config.cadence });
    } catch (error: any) {
        logger.error('Error running trading cycle:', error.message);
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
        const snapshotsSnap = await db.collection('accountSnapshots').orderBy('timestamp', 'desc').limit(1).get();
        const latestSnapshot = snapshotsSnap.docs[0]?.data();

        // Get open positions
        const openTradesSnap = await db.collection('trades').where('status', '==', 'OPEN').get();
        const openTrades = openTradesSnap.docs.map(d => d.data());

        // Get current day's closed trades for PnL
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const closedTradesSnap = await db.collection('trades').where('status', '==', 'CLOSED').get();
        const closedTrades = closedTradesSnap.docs.map(d => d.data());

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

    const shouldAutoStart = process.env.AUTO_START_TRADING === 'true';
    if (shouldAutoStart) {
        setTimeout(async () => {
            logger.info('Auto-starting trading engine...');
            await tradingService.start();
        }, 2000);
    } else {
        logger.info('Auto-start trading is disabled. Use /api/trading/start to start manually.');
    }
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
