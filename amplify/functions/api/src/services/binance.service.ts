import Binance from 'binance-api-node';
import { CandleChartInterval } from 'binance-api-node';
import logger from '../utils/logger';

export interface FuturesAccountBalance {
    asset: string;
    walletBalance: string;
    unrealizedProfit: string;
    marginBalance: string;
    maintMargin: string;
    initialMargin: string;
    positionInitialMargin: string;
    openOrderInitialMargin: string;
    maxWithdrawAmount: string;
    crossWalletBalance: string;
    crossUnPnl: string;
    availableBalance: string;
    updateTime: number;
}

export interface FuturesKline {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

class BinanceService {
    private client;

    constructor() {
        this.client = Binance({
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET,
            // Adjust to futures testnet or production base URL if needed
            // For production, the default should be fine, but specify if needed
            // httpBase: 'https://fapi.binance.com/fapi', // Example for Binance Futures API base URL
        });
        logger.info('BinanceService (Futures) initialized');
    }

    async getAccountBalance(): Promise<FuturesAccountBalance[]> {
        try {
            const accountInfo = await this.client.futuresAccountInfo();
            return accountInfo.assets.map(asset => ({
                asset: asset.asset,
                walletBalance: asset.walletBalance,
                unrealizedProfit: asset.unrealizedProfit,
                marginBalance: asset.marginBalance,
                maintMargin: asset.maintMargin,
                initialMargin: asset.initialMargin,
                positionInitialMargin: asset.positionInitialMargin,
                openOrderInitialMargin: asset.openOrderInitialMargin,
                maxWithdrawAmount: asset.maxWithdrawAmount,
                crossWalletBalance: asset.crossWalletBalance,
                crossUnPnl: asset.crossUnPnl,
                availableBalance: asset.availableBalance,
                updateTime: accountInfo.updateTime, // Assuming updateTime is from the accountInfo itself
            }));
        } catch (error) {
            logger.error('Error fetching futures account balance:', error);
            throw error;
        }
    }

    async getKlines(
        symbol: string,
        interval: CandleChartInterval,
        limit: number
    ): Promise<FuturesKline[]> {
        try {
            const klines = await this.client.futuresCandles({ symbol, interval, limit });
            return klines.map(kline => ({
                time: kline.openTime / 1000, // Convert ms to seconds
                open: parseFloat(kline.open),
                high: parseFloat(kline.high),
                low: parseFloat(kline.low),
                close: parseFloat(kline.close),
                volume: parseFloat(kline.volume),
            }));
        } catch (error) {
            logger.error(`Error fetching futures klines for ${symbol}:`, error);
            throw error;
        }
    }

    async getCurrentPrice(symbol: string): Promise<number> {
        try {
            const ticker = await this.client.futuresSymbolTicker({ symbol });
            return parseFloat(ticker.price);
        } catch (error) {
            logger.error(`Error fetching futures price for ${symbol}:`, error);
            throw error;
        }
    }

    async get24hrTickerPriceChange(symbol: string) {
        try {
            const ticker = await this.client.futures24hrTicker({ symbol });
            return {
                symbol: ticker.symbol,
                priceChange: parseFloat(ticker.priceChange),
                priceChangePercent: parseFloat(ticker.priceChangePercent),
                weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
                lastPrice: parseFloat(ticker.lastPrice),
                highPrice: parseFloat(ticker.highPrice),
                lowPrice: parseFloat(ticker.lowPrice),
                volume: parseFloat(ticker.volume),
                quoteVolume: parseFloat(ticker.quoteVolume),
                openTime: ticker.openTime,
                closeTime: ticker.closeTime,
                firstId: ticker.firstId,
                lastId: ticker.lastId,
                count: ticker.count,
            };
        } catch (error) {
            logger.error(`Error fetching futures 24hr ticker for ${symbol}:`, error);
            throw error;
        }
    }

    // Note: futures order placement is more complex and depends on specific strategies
    // This is a simplified example.
    async placeOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number,
        price: number, // Limit price for initial entry
        stopLoss: number,
        takeProfit: number
    ) {
        try {
            logger.info(
                `Placing ${side} order for ${quantity} ${symbol} at ${price} (SL: ${stopLoss}, TP: ${takeProfit})`
            );

            // 1. Place a LIMIT order for the initial entry
            const entryOrder = await this.client.futuresOrder({
                symbol,
                side,
                type: 'LIMIT',
                quantity: quantity.toFixed(3),
                price: price.toFixed(3),
                timeInForce: 'GTC',
            });
            logger.info(`Entry LIMIT order placed: ${JSON.stringify(entryOrder)}`);

            // This part is tricky for Lambda because these would typically be contingent orders
            // placed after the initial order fills. For a real trading bot, you'd monitor
            // the entry order's status and then place SL/TP.
            // For a simplified direct call, we'll place them as general orders.

            // 2. Place a STOP_MARKET order for Stop Loss
            await this.client.futuresOrder({
                symbol,
                side: side === 'BUY' ? 'SELL' : 'BUY', // Opposite side
                type: 'STOP_MARKET',
                quantity: quantity.toFixed(3),
                stopPrice: stopLoss.toFixed(3),
                closePosition: true, // Crucial for futures to close the position
            });
            logger.info(`Stop Loss STOP_MARKET order placed at ${stopLoss}`);

            // 3. Place a TAKE_PROFIT_MARKET order for Take Profit
            await this.client.futuresOrder({
                symbol,
                side: side === 'BUY' ? 'SELL' : 'BUY', // Opposite side
                type: 'TAKE_PROFIT_MARKET',
                quantity: quantity.toFixed(3),
                stopPrice: takeProfit.toFixed(3),
                closePosition: true, // Crucial for futures to close the position
            });
            logger.info(`Take Profit TAKE_PROFIT_MARKET order placed at ${takeProfit}`);

            return entryOrder;
        } catch (error) {
            logger.error('Error placing futures order:', error);
            throw error;
        }
    }
}

const binanceService = new BinanceService();
export default binanceService;