import { Signal } from './strategy.service';
import client from '../config/database';
import logger from '../utils/logger';

export interface RiskValidation {
    valid: boolean;
    reason?: string;
    positionSize?: number;
}

class RiskService {
    private riskPerTrade: number;
    private maxDailyLoss: number;
    private stopLossPercent: number;

    constructor() {
        this.riskPerTrade = parseFloat(process.env.RISK_PER_TRADE || '0.02');
        this.maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS || '0.10');
        this.stopLossPercent = parseFloat(process.env.STOP_LOSS_PERCENT || '0.05');
    }

    /**
     * Calculate position size based on risk management rules
     */
    calculatePositionSize(
        equity: number,
        entryPrice: number,
        stopLoss: number
    ): number {
        // Risk amount in dollars
        const riskAmount = equity * this.riskPerTrade;

        // Price distance to stop-loss
        const stopDistance = Math.abs(entryPrice - stopLoss);

        // Position size = risk amount / stop distance
        const positionSize = riskAmount / stopDistance;

        logger.info(
            `Position sizing: Equity=$${equity}, Risk=$${riskAmount.toFixed(2)}, Stop distance=$${stopDistance.toFixed(2)}, Position size=${positionSize.toFixed(6)}`
        );

        return positionSize;
    }

    /**
     * Validate if a trade signal meets risk requirements
     */
    async validateTrade(
        signal: Signal,
        currentEquity: number
    ): Promise<RiskValidation> {
        // No trade signal
        if (signal.direction === 'NO_TRADE') {
            return { valid: false, reason: 'No trade signal generated' };
        }

        // Check if stop-loss is set
        if (!signal.stopLoss || !signal.entryMax) {
            return { valid: false, reason: 'Missing stop-loss or entry price' };
        }

        // Check if risk percent exceeds 5%
        if (signal.maxRiskPercent && signal.maxRiskPercent > 5) {
            return {
                valid: false,
                reason: `Risk ${signal.maxRiskPercent}% exceeds maximum 5%`,
            };
        }

        // Check daily loss limit
        const dailyLossExceeded = await this.checkDailyLossLimit();
        if (dailyLossExceeded) {
            return {
                valid: false,
                reason: 'Daily loss limit exceeded, trading halted for 24h',
            };
        }

        // Check if we already have an open position for this symbol
        const hasOpenPosition = await this.hasOpenPosition(signal.symbol);
        if (hasOpenPosition) {
            return {
                valid: false,
                reason: `Already have an open position for ${signal.symbol}`,
            };
        }

        // Calculate position size
        const positionSize = this.calculatePositionSize(
            currentEquity,
            signal.entryMax,
            signal.stopLoss
        );

        // Check minimum notional (Binance typically requires ~10 USDT minimum)
        const notionalValue = positionSize * signal.entryMax;
        if (notionalValue < 10) {
            return {
                valid: false,
                reason: `Position size too small (${notionalValue.toFixed(2)} USDT < 10 USDT minimum)`,
            };
        }

        // Check if we have enough equity
        if (notionalValue > currentEquity * 0.5) {
            return {
                valid: false,
                reason: `Position size (${notionalValue.toFixed(2)} USDT) exceeds 50% of equity`,
            };
        }

        return {
            valid: true,
            positionSize,
        };
    }

    /**
     * Check if daily loss limit has been exceeded
     */
    async checkDailyLossLimit(): Promise<boolean> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data: allTrades } = await client.models.Trade.list({});
            const closedTrades = allTrades.filter((t: any) => t.status === 'CLOSED');

            const dailyTrades = closedTrades.filter((t: any) => new Date(t.closed_at) >= today);
            const dailyPnl = dailyTrades.reduce((sum: number, t: any) => sum + (t.realized_pnl || 0), 0);

            // Get initial capital
            const initialCapital = parseFloat(process.env.INITIAL_CAPITAL || '100');
            const maxLoss = initialCapital * this.maxDailyLoss;

            if (dailyPnl < -maxLoss) {
                logger.warn(
                    `Daily loss limit exceeded: ${dailyPnl.toFixed(2)} < -${maxLoss.toFixed(2)}`
                );
                return true;
            }

            return false;
        } catch (error: any) {
            logger.error('Error checking daily loss limit:', error.message);
            return false;
        }
    }

    /**
     * Check if there's an open position for a symbol
     */
    async hasOpenPosition(symbol: string): Promise<boolean> {
        try {
            const { data: openTrades } = await client.models.Trade.list({
                filter: {
                    symbol: { eq: symbol },
                    status: { eq: 'OPEN' }
                }
            });

            return openTrades.length > 0;
        } catch (error: any) {
            logger.error('Error checking open positions:', error.message);
            return false;
        }
    }

    /**
     * Get current open positions count
     */
    async getOpenPositionsCount(): Promise<number> {
        try {
            const { data: openTrades } = await client.models.Trade.list({
                filter: { status: { eq: 'OPEN' } }
            });

            return openTrades.length;
        } catch (error: any) {
            logger.error('Error getting open positions count:', error.message);
            return 0;
        }
    }
}

export default new RiskService();
