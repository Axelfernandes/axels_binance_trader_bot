import logger from '../utils/logger';

class RiskService {
    private MAX_DAILY_LOSS_PERCENT: number; // e.g., 0.05 for 5%
    private MAX_POSITION_RISK_PERCENT: number; // e.g., 0.01 for 1%
    private MIN_RISK_REWARD_RATIO: number; // e.g., 1.5

    constructor() {
        this.MAX_DAILY_LOSS_PERCENT = parseFloat(process.env.MAX_DAILY_LOSS_PERCENT || '0.50');
        this.MAX_POSITION_RISK_PERCENT = parseFloat(process.env.MAX_POSITION_RISK_PERCENT || '0.01');
        this.MIN_RISK_REWARD_RATIO = parseFloat(process.env.MIN_RISK_REWARD_RATIO || '1.5');
        logger.info('RiskService initialized');
    }

    /**
     * Check if a trade is within acceptable risk parameters.
     * @param entryPrice - The price at which the trade is entered.
     * @param stopLossPrice - The price at which the trade will be closed to limit losses.
     * @param takeProfitPrice - The price at which the trade will be closed to lock in profits.
     * @param currentEquity - The total capital in the trading account.
     * @param positionSize - The amount of currency being traded (e.g., in USDT).
     */
    isTradeRisky(
        entryPrice: number,
        stopLossPrice: number,
        takeProfitPrice: number,
        currentEquity: number,
        positionSize: number
    ): { risky: boolean; reason?: string } {
        const potentialLoss = Math.abs(entryPrice - stopLossPrice) * positionSize;
        const potentialProfit = Math.abs(takeProfitPrice - entryPrice) * positionSize;
        const riskRewardRatio = potentialProfit / potentialLoss;

        // 1. Check if potential loss exceeds maximum allowable risk per position
        const maxLossPerPosition = currentEquity * this.MAX_POSITION_RISK_PERCENT;
        if (potentialLoss > maxLossPerPosition) {
            logger.warn(
                `Trade is too risky: Potential loss ($${potentialLoss.toFixed(
                    2
                )}) exceeds max allowed ($${maxLossPerPosition.toFixed(2)})`
            );
            return { risky: true, reason: 'Exceeds max loss per position' };
        }

        // 2. Check Risk/Reward Ratio
        if (riskRewardRatio < this.MIN_RISK_REWARD_RATIO) {
            logger.warn(
                `Trade is too risky: Risk/Reward ratio (${riskRewardRatio.toFixed(
                    2
                )}) is below minimum (${this.MIN_RISK_REWARD_RATIO})`
            );
            return { risky: true, reason: 'Low Risk/Reward Ratio' };
        }

        logger.info(
            `Trade passed risk checks. Potential Loss: $${potentialLoss.toFixed(
                2
            )}, Potential Profit: $${potentialProfit.toFixed(2)}, R:R: ${riskRewardRatio.toFixed(2)}`
        );
        return { risky: false };
    }

    /**
     * Check if placing a new trade would exceed the daily loss limit.
     * @param dailyLoss - The total loss incurred today.
     * @param currentEquity - The total capital in the trading account.
     * @param potentialLossOfNewTrade - The calculated potential loss of the new trade.
     */
    wouldExceedDailyLossLimit(
        dailyLoss: number,
        currentEquity: number,
        potentialLossOfNewTrade: number
    ): boolean {
        const currentDailyLossPercent = (dailyLoss + potentialLossOfNewTrade) / currentEquity;
        if (currentDailyLossPercent > this.MAX_DAILY_LOSS_PERCENT) {
            logger.warn(
                `New trade would exceed daily loss limit. Current daily loss + new potential loss: $${(dailyLoss + potentialLossOfNewTrade).toFixed(2)} (${(currentDailyLossPercent * 100).toFixed(2)}%). Max allowed: ${(this.MAX_DAILY_LOSS_PERCENT * 100).toFixed(2)}%`
            );
            return true;
        }
        return false;
    }

    // You can add more risk management functions here, e.g.,
    // - checkMaxOpenPositions()
    // - enforceMaxExposure()
    // - calculateOptimalPositionSize() based on risk
}

const riskService = new RiskService();
export default riskService;