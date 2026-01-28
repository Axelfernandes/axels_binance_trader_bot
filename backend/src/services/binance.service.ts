import Binance, { CandleChartInterval, OrderType } from 'binance-api-node';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

export interface OHLCV {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
}

export interface AccountBalance {
    asset: string;
    free: number;
    locked: number;
}

export interface Order {
    symbol: string;
    orderId: number;
    clientOrderId: string;
    price: string;
    origQty: string;
    executedQty: string;
    status: string;
    type: string;
    side: string;
}

class BinanceService {
    public client: ReturnType<typeof Binance>;
    private isPaperMode: boolean;

    constructor() {
        this.isPaperMode = process.env.TRADING_MODE === 'paper';

        this.client = Binance({
            apiKey: process.env.BINANCE_API_KEY || '',
            apiSecret: process.env.BINANCE_API_SECRET || '',
            // Use Binance global API endpoint
            httpBase: 'https://api.binance.com',
            wsBase: 'wss://stream.binance.com:9443/ws',
        });

        logger.info(`Binance service initialized in ${this.isPaperMode ? 'PAPER' : 'LIVE'} mode (using global Binance)`);
    }

    /**
     * Get account balance for all assets
     */
    async getAccountBalance(): Promise<AccountBalance[]> {
        try {
            const accountInfo = await this.client.accountInfo();
            const balances = accountInfo.balances
                .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
                .map((b) => ({
                    asset: b.asset,
                    free: parseFloat(b.free),
                    locked: parseFloat(b.locked),
                }));

            logger.info(`Fetched account balance: ${balances.length} assets`);
            return balances;
        } catch (error: any) {
            logger.error('Error fetching account balance:', error.message);
            throw error;
        }
    }

    /**
     * Get USDT balance specifically
     */
    async getUSDTBalance(): Promise<number> {
        const balances = await this.getAccountBalance();
        const usdt = balances.find((b) => b.asset === 'USDT');
        return usdt ? usdt.free : 0;
    }

    /**
     * Get historical OHLCV data (candlesticks)
     */
    async getKlines(
        symbol: string,
        interval: CandleChartInterval = CandleChartInterval.ONE_HOUR,
        limit: number = 100
    ): Promise<OHLCV[]> {
        try {
            const candles = await this.client.candles({ symbol, interval, limit });

            const ohlcv = candles.map((c) => ({
                openTime: c.openTime,
                open: parseFloat(c.open),
                high: parseFloat(c.high),
                low: parseFloat(c.low),
                close: parseFloat(c.close),
                volume: parseFloat(c.volume),
                closeTime: c.closeTime,
            }));

            logger.info(`Fetched ${ohlcv.length} candles for ${symbol} (${interval})`);
            return ohlcv;
        } catch (error: any) {
            logger.error(`Error fetching klines for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get current price for a symbol
     */
    async getCurrentPrice(symbol: string): Promise<number> {
        try {
            const ticker = await this.client.prices({ symbol });
            return parseFloat(ticker[symbol]);
        } catch (error: any) {
            logger.error(`Error fetching price for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Place a market order
     */
    async placeMarketOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number
    ): Promise<Order | null> {
        if (this.isPaperMode) {
            logger.info(`[PAPER] Market ${side} order: ${quantity} ${symbol}`);
            return null; // In paper mode, we don't actually place orders
        }

        try {
            const order = await this.client.order({
                symbol,
                side,
                type: OrderType.MARKET,
                quantity: quantity.toString(),
            });

            logger.info(`Market order placed: ${side} ${quantity} ${symbol}`, order);
            return order as any;
        } catch (error: any) {
            logger.error(`Error placing market order:`, error.message);
            throw error;
        }
    }

    /**
     * Place a stop-loss limit order
     */
    async placeStopLossOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number,
        stopPrice: number,
        limitPrice: number
    ): Promise<Order | null> {
        if (this.isPaperMode) {
            logger.info(
                `[PAPER] Stop-loss ${side} order: ${quantity} ${symbol} @ stop=${stopPrice}, limit=${limitPrice}`
            );
            return null;
        }

        try {
            const order = await this.client.order({
                symbol,
                side,
                type: OrderType.STOP_LOSS_LIMIT,
                quantity: quantity.toString(),
                stopPrice: stopPrice.toString(),
                price: limitPrice.toString(),
                timeInForce: 'GTC',
            });

            logger.info(`Stop-loss order placed: ${side} ${quantity} ${symbol}`, order);
            return order as any;
        } catch (error: any) {
            logger.error(`Error placing stop-loss order:`, error.message);
            throw error;
        }
    }

    /**
     * Get exchange info for a symbol (min notional, lot size, etc.)
     */
    async getExchangeInfo(symbol: string) {
        try {
            const info = await this.client.exchangeInfo();
            const symbolInfo = info.symbols.find((s) => s.symbol === symbol);

            if (!symbolInfo) {
                throw new Error(`Symbol ${symbol} not found`);
            }

            return symbolInfo;
        } catch (error: any) {
            logger.error(`Error fetching exchange info for ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Subscribe to real-time price tickers for multiple symbols
     */
    subscribeToTickers(symbols: string[], callback: (ticker: any) => void) {
        return this.client.ws.allTickers((tickers) => {
            const filtered = (Array.isArray(tickers) ? tickers : [tickers]).filter((t) => 
                symbols.includes(t.symbol)
            );
            if (filtered.length > 0) {
                callback(filtered);
            }
        });
    }

    /**
     * Subscribe to individual symbol mini-tickers (lower bandwidth)
     */
    subscribeToMiniTickers(symbols: string[], callback: (ticker: any) => void) {
        return this.client.ws.miniTicker(symbols, (ticker) => {
            callback(ticker);
        });
    }

    /**
     * Test connectivity
     */
    async testConnectivity(retries = 3, delay = 2000): Promise<boolean> {
        for (let i = 0; i < retries; i++) {
            try {
                await this.client.ping();
                logger.info('✅ Binance API connectivity test passed');
                return true;
            } catch (error: any) {
                logger.error(`❌ Binance API connectivity test failed (attempt ${i + 1}/${retries}):`, error.message);
                if (i < retries - 1) {
                    await new Promise(res => setTimeout(res, delay));
                }
            }
        }
        return false;
    }
}

export default new BinanceService();
