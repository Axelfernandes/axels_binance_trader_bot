import { CandleChartInterval } from 'binance-api-node';
import binanceService from './binance.service';
import logger from '../utils/logger';

export interface Signal {
    symbol: string;
    direction: 'LONG' | 'SHORT' | 'NO_TRADE';
    entryMax?: number;
    entryMin?: number;
    stopLoss?: number;
    takeProfit1?: number;
    maxRiskPercent?: number;
    rationale: string[];
}

class StrategyService {
    private candleData: { [symbol: string]: any[] } = {};

    constructor() {
        logger.info('StrategyService initialized');
    }

    /**
     * Entry point for analyzing market data and generating a signal.
     */
    async analyzeMarket(symbol: string): Promise<Signal> {
        // Fetch kline data
        const klines = await binanceService.getKlines(
            symbol,
            CandleChartInterval.FIFTEEN_MINUTES,
            50
        ); // Get 50 candles for 15-minute interval

        if (klines.length < 20) {
            logger.warn(`Not enough kline data for ${symbol}. Skipping analysis.`);
            return { symbol, direction: 'NO_TRADE', rationale: ['Not enough data'] };
        }

        this.candleData[symbol] = klines;

        // Implement your trading strategy here
        // For example, a simple Moving Average Crossover strategy
        return this.maCrossoverStrategy(symbol);
    }

    /**
     * Simple Moving Average (MA) Crossover Strategy.
     * Generates a LONG signal when short MA crosses above long MA, and SHORT when vice-versa.
     */
    private maCrossoverStrategy(symbol: string): Signal {
        const klines = this.candleData[symbol];
        if (!klines || klines.length === 0) {
            return { symbol, direction: 'NO_TRADE', rationale: ['No kline data'] };
        }

        // Calculate moving averages
        const shortPeriod = 5;
        const longPeriod = 20;

        const closes = klines.map((k) => k.close);

        const shortMA = this.calculateSMA(closes, shortPeriod);
        const longMA = this.calculateSMA(closes, longPeriod);

        if (shortMA.length < 2 || longMA.length < 2) {
            return { symbol, direction: 'NO_TRADE', rationale: ['Not enough MA data'] };
        }

        const lastShortMA = shortMA[shortMA.length - 1];
        const prevShortMA = shortMA[shortMA.length - 2];
        const lastLongMA = longMA[longMA.length - 1];
        const prevLongMA = longMA[longMA.length - 2];
        const currentPrice = klines[klines.length - 1].close;

        // Golden Cross (Bullish) - Short MA crosses above Long MA
        if (prevShortMA <= prevLongMA && lastShortMA > lastLongMA) {
            logger.info(`LONG signal for ${symbol}: Golden Cross detected.`);
            return {
                symbol,
                direction: 'LONG',
                entryMax: currentPrice * 1.005, // Entry slightly above current price
                entryMin: currentPrice * 0.995, // Entry slightly below current price
                stopLoss: currentPrice * 0.98, // 2% below current price
                takeProfit1: currentPrice * 1.04, // 4% above current price
                maxRiskPercent: 2,
                rationale: ['Golden Cross (5/20 MA)', 'Potential Uptrend'],
            };
        }

        // Death Cross (Bearish) - Short MA crosses below Long MA
        if (prevShortMA >= prevLongMA && lastShortMA < lastLongMA) {
            logger.info(`SHORT signal for ${symbol}: Death Cross detected.`);
            return {
                symbol,
                direction: 'SHORT',
                entryMax: currentPrice * 1.005,
                entryMin: currentPrice * 0.995,
                stopLoss: currentPrice * 1.02, // 2% above current price
                takeProfit1: currentPrice * 0.96, // 4% below current price
                maxRiskPercent: 2,
                rationale: ['Death Cross (5/20 MA)', 'Potential Downtrend'],
            };
        }

        return { symbol, direction: 'NO_TRADE', rationale: ['No clear MA crossover signal'] };
    }

    /**
     * Helper function to calculate Simple Moving Average (SMA).
     */
    private calculateSMA(data: number[], period: number): number[] {
        const sma: number[] = [];
        for (let i = 0; i < data.length; i++) {
            if (i >= period - 1) {
                const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                sma.push(sum / period);
            } else {
                sma.push(NaN); // Not enough data for the period
            }
        }
        return sma;
    }

    // You can add more complex strategies here (e.g., RSI, MACD, Bollinger Bands)
    // or combine multiple strategies for stronger signals.
}

const strategyService = new StrategyService();
export default strategyService;