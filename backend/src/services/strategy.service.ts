import { OHLCV } from './binance.service';
import logger from '../utils/logger';

export interface Signal {
    symbol: string;
    direction: 'LONG' | 'SHORT' | 'NO_TRADE';
    entryMin?: number;
    entryMax?: number;
    stopLoss?: number;
    takeProfit1?: number;
    takeProfit2?: number;
    takeProfit3?: number;
    maxRiskPercent?: number;
    rationale: string[];
    aiConfidence?: number;
    aiComment?: string;
}

class StrategyService {
    /**
     * Calculate Standard Deviation
     */
    calculateStandardDeviation(prices: number[], period: number): number[] {
        if (prices.length < period) return [];
        const stdDev: number[] = [];
        for (let i = period - 1; i < prices.length; i++) {
            const window = prices.slice(i - period + 1, i + 1);
            const avg = window.reduce((a, b) => a + b, 0) / period;
            const squareDiffs = window.map(p => Math.pow(p - avg, 2));
            const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / period;
            stdDev[i] = Math.sqrt(avgSquareDiff);
        }
        return stdDev;
    }

    /**
     * Calculate Bollinger Bands
     */
    calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2): { upper: number[], middle: number[], lower: number[] } {
        const middle = this.calculateSMA(prices, period);
        const stdDev = this.calculateStandardDeviation(prices, period);
        const upper: number[] = [];
        const lower: number[] = [];

        for (let i = 0; i < prices.length; i++) {
            if (middle[i] === undefined || stdDev[i] === undefined) continue;
            upper[i] = middle[i] + multiplier * stdDev[i];
            lower[i] = middle[i] - multiplier * stdDev[i];
        }

        return { upper, middle, lower };
    }

    /**
     * Calculate Simple Moving Average (SMA)
     */
    calculateSMA(prices: number[], period: number): number[] {
        if (prices.length < period) return [];
        const sma: number[] = [];
        for (let i = period - 1; i < prices.length; i++) {
            const window = prices.slice(i - period + 1, i + 1);
            sma[i] = window.reduce((a, b) => a + b, 0) / period;
        }
        return sma;
    }

    /**
     * Calculate MACD
     */
    calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): { macd: number[], signal: number[], histogram: number[] } {
        const fastEMA = this.calculateEMA(prices, fastPeriod);
        const slowEMA = this.calculateEMA(prices, slowPeriod);
        const macd: number[] = [];

        for (let i = 0; i < prices.length; i++) {
            if (fastEMA[i] === undefined || slowEMA[i] === undefined) continue;
            macd[i] = fastEMA[i] - slowEMA[i];
        }

        const signal = this.calculateEMA(macd.filter(v => v !== undefined), signalPeriod);
        const histogram: number[] = [];

        // Adjust indices for signal line
        const offset = prices.length - signal.length;
        for (let i = 0; i < signal.length; i++) {
            const fullIdx = i + offset;
            histogram[fullIdx] = macd[fullIdx] - signal[i];
        }

        return { macd, signal, histogram };
    }

    /**
     * Calculate Exponential Moving Average (EMA)
     */
    calculateEMA(prices: number[], period: number): number[] {
        if (prices.length < period) {
            return [];
        }

        const k = 2 / (period + 1);
        const ema: number[] = [];

        // Start with SMA for the first value
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += prices[i];
        }
        ema[period - 1] = sum / period;

        // Calculate EMA for remaining values
        for (let i = period; i < prices.length; i++) {
            ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
        }

        return ema;
    }

    /**
     * Calculate Relative Strength Index (RSI)
     */
    calculateRSI(prices: number[], period: number = 14): number[] {
        if (prices.length < period + 1) {
            return [];
        }

        const rsi: number[] = [];
        let gains = 0;
        let losses = 0;

        // Calculate initial average gain and loss
        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        rsi[period] = 100 - 100 / (1 + avgGain / avgLoss);

        // Calculate RSI for remaining values
        for (let i = period + 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            rsi[i] = 100 - 100 / (1 + avgGain / avgLoss);
        }

        return rsi;
    }

    /**
     * Generate trading signal based on multiple strategies
     */
    async generateSignal(
        symbol: string,
        ohlcv: OHLCV[]
    ): Promise<Signal> {
        const closePrices = ohlcv.map((c) => c.close);
        const currentPrice = closePrices[closePrices.length - 1];
        const rationale: string[] = [];

        // Strategy 1: MA Crossover (Trend Following)
        const ema20 = this.calculateEMA(closePrices, 20);
        const ema50 = this.calculateEMA(closePrices, 50);
        const rsi = this.calculateRSI(closePrices, 14);
        
        const currEMA20 = ema20[ema20.length - 1];
        const currEMA50 = ema50[ema50.length - 1];
        const prevEMA20 = ema20[ema20.length - 2];
        const prevEMA50 = ema50[ema50.length - 2];
        const currRSI = rsi[rsi.length - 1];

        const bullishCross = prevEMA20 <= prevEMA50 && currEMA20 > currEMA50;
        const bearishCross = prevEMA20 >= prevEMA50 && currEMA20 < currEMA50;

        if (bullishCross && currRSI > 45 && currRSI < 70) {
            rationale.push("Strategy: EMA Crossover Detected (20/50)");
            rationale.push(`RSI is at ${currRSI.toFixed(2)} confirming trend`);
            
            return this.createLongSignal(symbol, currentPrice, rationale);
        } else if (bearishCross && currRSI < 55 && currRSI > 30) {
            rationale.push("Strategy: EMA Crossover Detected (20/50)");
            rationale.push(`RSI is at ${currRSI.toFixed(2)} confirming downtrend`);

            return this.createShortSignal(symbol, currentPrice, rationale);
        }

        // Strategy 2: Bollinger Bands Mean Reversion (Range Trading)
        const bb = this.calculateBollingerBands(closePrices, 20, 2);
        const currLowerBB = bb.lower[bb.lower.length - 1];
        const currUpperBB = bb.upper[bb.upper.length - 1];

        if (currentPrice <= currLowerBB && currRSI < 35) {
            rationale.push("Strategy: Bollinger Bands Mean Reversion");
            rationale.push(`Price ($${currentPrice.toFixed(2)}) touched lower band ($${currLowerBB.toFixed(2)})`);
            rationale.push(`RSI is oversold (${currRSI.toFixed(2)})`);
            
            return this.createLongSignal(symbol, currentPrice, rationale);
        } else if (currentPrice >= currUpperBB && currRSI > 65) {
            rationale.push("Strategy: Bollinger Bands Mean Reversion");
            rationale.push(`Price ($${currentPrice.toFixed(2)}) touched upper band ($${currUpperBB.toFixed(2)})`);
            rationale.push(`RSI is overbought (${currRSI.toFixed(2)})`);

            return this.createShortSignal(symbol, currentPrice, rationale);
        }

        // Strategy 3: MACD Momentum
        const macdData = this.calculateMACD(closePrices);
        const currHist = macdData.histogram[macdData.histogram.length - 1];
        const prevHist = macdData.histogram[macdData.histogram.length - 2];

        if (prevHist < 0 && currHist > 0 && currRSI > 50) {
            rationale.push("Strategy: MACD Histogram Crossover");
            rationale.push(`Momentum shifted to positive`);
            
            return this.createLongSignal(symbol, currentPrice, rationale);
        } else if (prevHist > 0 && currHist < 0 && currRSI < 50) {
            rationale.push("Strategy: MACD Histogram Crossover");
            rationale.push(`Momentum shifted to negative`);

            return this.createShortSignal(symbol, currentPrice, rationale);
        }

        // Default: No trade
        rationale.push(`No strong signal for ${symbol}`);
        rationale.push(`Indicators: RSI=${currRSI.toFixed(2)}, BB Spread=${((currUpperBB - currLowerBB) / currentPrice * 100).toFixed(2)}%`);

        return {
            symbol,
            direction: 'NO_TRADE',
            rationale,
        };
    }

    private createLongSignal(symbol: string, currentPrice: number, rationale: string[]): Signal {
        const stopLoss = currentPrice * 0.95; // 5% stop loss
        const riskAmount = currentPrice - stopLoss;
        const takeProfit1 = currentPrice + riskAmount * 2; // 2:1 RR

        return {
            symbol,
            direction: 'LONG',
            entryMin: currentPrice * 0.998,
            entryMax: currentPrice * 1.002,
            stopLoss,
            takeProfit1,
            maxRiskPercent: 5.0,
            rationale,
        };
    }

    private createShortSignal(symbol: string, currentPrice: number, rationale: string[]): Signal {
        const stopLoss = currentPrice * 1.05; // 5% stop loss
        const riskAmount = stopLoss - currentPrice;
        const takeProfit1 = currentPrice - riskAmount * 2; // 2:1 RR

        return {
            symbol,
            direction: 'SHORT',
            entryMin: currentPrice * 1.002,
            entryMax: currentPrice * 0.998,
            stopLoss,
            takeProfit1,
            maxRiskPercent: 5.0,
            rationale,
        };
    }

    /**
     * Check if we should exit an open position
     */
    shouldExitPosition(
        entryPrice: number,
        currentPrice: number,
        stopLoss: number,
        takeProfit: number,
        ohlcv: OHLCV[],
        maShort: number = 20,
        maLong: number = 50,
        direction: 'LONG' | 'SHORT' // Added direction to function signature
    ): { shouldExit: boolean; reason: string } {
        // Stop-loss hit
        if (direction === 'LONG' && currentPrice <= stopLoss) {
            return { shouldExit: true, reason: 'Stop-loss triggered' };
        }
        if (direction === 'SHORT' && currentPrice >= stopLoss) {
            return { shouldExit: true, reason: 'Stop-loss triggered' };
        }

        // Take-profit hit
        if (direction === 'LONG' && currentPrice >= takeProfit) {
            return { shouldExit: true, reason: 'Take-profit target reached' };
        }
        if (direction === 'SHORT' && currentPrice <= takeProfit) {
            return { shouldExit: true, reason: 'Take-profit target reached' };
        }

        // Trend reversal check
        const closePrices = ohlcv.map((c) => c.close);
        const emaShort = this.calculateEMA(closePrices, maShort);
        const emaLong = this.calculateEMA(closePrices, maLong);

        const currentEMAShort = emaShort[emaShort.length - 1];
        const currentEMALong = emaLong[emaLong.length - 1];
        const prevEMAShort = emaShort[emaShort.length - 2];
        const prevEMALong = emaLong[emaLong.length - 2];

        // Bearish crossover (exit long position)
        const bearishCrossover = prevEMAShort >= prevEMALong && currentEMAShort < currentEMALong;
        // Bullish crossover (exit short position)
        const bullishCrossover = prevEMAShort <= prevEMALong && currentEMAShort > currentEMALong;

        if (direction === 'LONG' && bearishCrossover) {
            return { shouldExit: true, reason: 'Trend reversal detected (bearish crossover)' };
        }
        if (direction === 'SHORT' && bullishCrossover) {
            return { shouldExit: true, reason: 'Trend reversal detected (bullish crossover)' };
        }

        return { shouldExit: false, reason: '' };
    }
}

export default new StrategyService();
