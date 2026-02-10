import binanceService from './binance.service';
import strategyService, { Signal } from './strategy.service';
import riskService from './risk.service';
import geminiService from './gemini.service';
import client from '../config/database'; // Amplify Client
import logger from '../utils/logger';

// Store last known equity for daily PnL calculation
let lastKnownEquity: number = parseFloat(process.env.INITIAL_CAPITAL || '100');
// Store daily trades to calculate daily PnL
let dailyTrades: any[] = [];
let tradingCycleInterval: NodeJS.Timeout | null = null;

class TradingService {
    private isRunning: boolean = false;
    private TRADING_MODE: string;

    constructor() {
        this.TRADING_MODE = process.env.TRADING_MODE || 'paper';
        logger.info(`TradingService initialized in ${this.TRADING_MODE} mode`);
    }

    public async start() {
        if (this.isRunning) {
            logger.info('Trading engine is already running.');
            return;
        }

        this.isRunning = true;
        logger.info('Starting trading engine...');

        // Initialize daily trades and last known equity on start
        await this.initializeDailyMetrics();

        // Run trading cycle periodically
        tradingCycleInterval = setInterval(async () => {
            await this.tradingCycle();
        }, 1000 * 60 * 5); // Run every 5 minutes

        // Run immediately on start
        await this.tradingCycle();
    }

    public stop() {
        if (!this.isRunning) {
            logger.info('Trading engine is not running.');
            return;
        }

        this.isRunning = false;
        if (tradingCycleInterval) {
            clearInterval(tradingCycleInterval);
            tradingCycleInterval = null;
        }
        logger.info('Trading engine stopped.');
    }

    public getStatus(): boolean {
        return this.isRunning;
    }

    private async initializeDailyMetrics() {
        try {
            // Fetch initial equity
            const balance = await binanceService.getAccountBalance();
            const usdtBalance = balance.find(asset => asset.asset === 'USDT');
            if (usdtBalance) {
                lastKnownEquity = parseFloat(usdtBalance.availableBalance);
            }
            logger.info(`Initial equity set to: ${lastKnownEquity}`);

            // Fetch today's closed trades for daily PnL calculation
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data: allTrades } = await client.models.Trade.list({ limit: 1000 }); // Fetch more for historical
            dailyTrades = allTrades.filter(
                trade => trade.status === 'CLOSED' && new Date(trade.closed_at) >= today
            );
            logger.info(`Initialized with ${dailyTrades.length} closed trades for today.`);
        } catch (error) {
            logger.error('Error initializing daily metrics:', error);
        }
    }

    private async tradingCycle() {
        logger.info('Starting new trading cycle...');
        try {
            // 1. Fetch current account balance and update equity
            const accountBalanceData = await binanceService.getAccountBalance();
            const usdtAsset = accountBalanceData.find(asset => asset.asset === 'USDT');
            const currentEquity = usdtAsset ? parseFloat(usdtAsset.availableBalance) + parseFloat(usdtAsset.unrealizedProfit) : lastKnownEquity;
            lastKnownEquity = currentEquity; // Update last known equity

            // Save account snapshot
            await client.models.AccountSnapshot.create({
                total_equity: currentEquity,
                available_balance: usdtAsset ? parseFloat(usdtAsset.availableBalance) : 0,
                timestamp: new Date().toISOString(),
            });

            // 2. Manage existing open positions
            await this.manageOpenPositions(currentEquity);

            // 3. Scan for new trading signals
            await this.scanForSignals(currentEquity);

            logger.info('Trading cycle completed.');
        } catch (error) {
            logger.error('Error during trading cycle:', error);
        }
    }

    private async manageOpenPositions(currentEquity: number) {
        logger.info('Managing open positions...');
        const { data: openTrades } = await client.models.Trade.list({
            filter: { status: { eq: 'OPEN' } }
        });

        for (const trade of openTrades) {
            try {
                const currentPrice = await binanceService.getCurrentPrice(trade.symbol);
                const klines = await binanceService.getKlines(
                    trade.symbol,
                    CandleChartInterval.FIFTEEN_MINUTES,
                    50
                );

                const { shouldExit, reason } = strategyService.shouldExitPosition(
                    parseFloat(trade.entry_price),
                    currentPrice,
                    parseFloat(trade.stop_loss),
                    parseFloat(trade.take_profit),
                    klines,
                    // Assuming 'BUY' for long, 'SELL' for short in trade.side
                    trade.side === 'BUY' ? 'LONG' : 'SHORT'
                );

                if (shouldExit) {
                    logger.info(`Exiting trade ${trade.id} for ${trade.symbol}: ${reason}`);
                    const exitPrice = currentPrice; // Exit at current market price

                    const pnl = (exitPrice - parseFloat(trade.entry_price)) * parseFloat(trade.quantity);
                    const pnlPercent = (pnl / (parseFloat(trade.entry_price) * parseFloat(trade.quantity))) * 100;

                    const updatedTrade = await client.models.Trade.update({
                        id: trade.id,
                        exit_price: exitPrice,
                        realized_pnl: pnl,
                        realized_pnl_percent: pnlPercent,
                        status: 'CLOSED',
                        closed_at: new Date().toISOString(),
                    });

                    dailyTrades.push(updatedTrade); // Add to daily trades for PnL calculation

                    // AI post-mortem analysis
                    const aiAnalysis = await geminiService.analyzeTradeResult(updatedTrade);
                    await client.models.Trade.update({
                        id: trade.id,
                        ai_analysis: aiAnalysis,
                    });
                    logger.info(`Closed trade ${trade.id} for ${trade.symbol}. PnL: ${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%). AI Analysis: ${aiAnalysis}`);
                }
            } catch (error) {
                logger.error(`Error managing trade ${trade.id} for ${trade.symbol}:`, error);
            }
        }
    }

    private async scanForSignals(currentEquity: number) {
        logger.info('Scanning for new trading signals...');
        const tradeableSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
            'PEPEUSDT', 'DOGEUSDT', 'SHIBUSDT', 'WIFUSDT', 'BONKUSDT', 'FETUSDT']; // Example symbols

        for (const symbol of tradeableSymbols) {
            try {
                const signal: Signal = await strategyService.analyzeMarket(symbol);

                if (signal.direction !== 'NO_TRADE') {
                    logger.info(`Potential ${signal.direction} signal for ${symbol}`);

                    // AI Validation
                    const klines = await binanceService.getKlines(
                        symbol,
                        CandleChartInterval.FIFTEEN_MINUTES,
                        50
                    );
                    const aiValidation = await geminiService.analyzeSignal(
                        signal.symbol,
                        signal.rationale,
                        klines.map(k => ({ close: k.close, volume: k.volume })) // Only pass relevant data
                    );

                    if (aiValidation.confidence < 75) {
                        logger.warn(`AI confidence too low for ${symbol} signal (${aiValidation.confidence}%). Skipping trade. Reason: ${aiValidation.comment}`);
                        await client.models.Signal.create({
                            symbol: signal.symbol,
                            direction: signal.direction,
                            generated_at: new Date().toISOString(),
                            rationale: JSON.stringify(signal.rationale),
                            ai_confidence: aiValidation.confidence,
                            ai_comment: aiValidation.comment,
                            entry_min: signal.entryMin || null,
                            entry_max: signal.entryMax || null,
                            stop_loss: signal.stopLoss || null,
                            take_profit_1: signal.takeProfit1 || null,
                            max_risk_percent: signal.maxRiskPercent || null,
                        });
                        continue; // Skip trade if AI confidence is low
                    }

                    // Risk Management
                    if (!signal.entryMax || !signal.stopLoss || !signal.takeProfit1) {
                        logger.warn(`Signal for ${symbol} missing critical price levels. Skipping trade.`);
                        continue;
                    }
                    const { risky, reason } = riskService.isTradeRisky(
                        signal.entryMax, // Using entryMax for risk calculation
                        signal.stopLoss,
                        signal.takeProfit1,
                        currentEquity,
                        // Need to calculate position size for risk check.
                        // This is a placeholder; actual position size comes from riskService.calculatePositionSize
                        currentEquity * 0.01 // Assuming 1% of equity as a placeholder position size
                    );

                    if (risky) {
                        logger.warn(`Signal for ${symbol} is too risky: ${reason}. Skipping trade.`);
                        await client.models.Signal.create({
                            symbol: signal.symbol,
                            direction: signal.direction,
                            generated_at: new Date().toISOString(),
                            rationale: JSON.stringify(signal.rationale),
                            ai_confidence: aiValidation.confidence,
                            ai_comment: aiValidation.comment,
                            entry_min: signal.entryMin || null,
                            entry_max: signal.entryMax || null,
                            stop_loss: signal.stopLoss || null,
                            take_profit_1: signal.takeProfit1 || null,
                            max_risk_percent: signal.maxRiskPercent || null,
                        });
                        continue; // Skip trade if risky
                    }

                    // Check daily loss limit
                    const currentDailyLoss = dailyTrades.reduce((sum, trade) => sum + (trade.realized_pnl < 0 ? trade.realized_pnl : 0), 0);
                    const potentialLossFromNewTrade = Math.abs(signal.entryMax - signal.stopLoss) * (currentEquity * 0.01); // Placeholder position size
                    if (riskService.wouldExceedDailyLossLimit(currentDailyLoss, currentEquity, potentialLossFromNewTrade)) {
                        logger.warn(`New trade for ${symbol} would exceed daily loss limit. Skipping.`);
                        continue;
                    }

                    // Calculate actual position size based on risk
                    const positionSize = riskService.calculatePositionSize(
                        currentEquity,
                        signal.entryMax,
                        signal.stopLoss
                    );

                    // Place Trade
                    if (this.TRADING_MODE === 'paper') {
                        logger.info(`[PAPER TRADE] Placing ${signal.direction} order for ${positionSize} ${symbol}`);
                        await client.models.Trade.create({
                            symbol: signal.symbol,
                            side: signal.direction === 'LONG' ? 'BUY' : 'SELL',
                            entry_price: signal.entryMax,
                            exit_price: null,
                            quantity: positionSize,
                            stop_loss: signal.stopLoss,
                            take_profit: signal.takeProfit1,
                            realized_pnl: null,
                            realized_pnl_percent: null,
                            status: 'OPEN',
                            opened_at: new Date().toISOString(),
                            ai_analysis: aiValidation.comment,
                        });
                    } else {
                        // Live Trading
                        await binanceService.placeOrder(
                            signal.symbol,
                            signal.direction === 'LONG' ? 'BUY' : 'SELL',
                            positionSize,
                            signal.entryMax,
                            signal.stopLoss,
                            signal.takeProfit1
                        );
                        // Save trade to database
                        await client.models.Trade.create({
                            symbol: signal.symbol,
                            side: signal.direction === 'LONG' ? 'BUY' : 'SELL',
                            entry_price: signal.entryMax,
                            exit_price: null,
                            quantity: positionSize,
                            stop_loss: signal.stopLoss,
                            take_profit: signal.takeProfit1,
                            realized_pnl: null,
                            realized_pnl_percent: null,
                            status: 'OPEN',
                            opened_at: new Date().toISOString(),
                            ai_analysis: aiValidation.comment,
                        });
                    }

                    // Save the generated signal
                    await client.models.Signal.create({
                        symbol: signal.symbol,
                        direction: signal.direction,
                        generated_at: new Date().toISOString(),
                        rationale: JSON.stringify(signal.rationale),
                        ai_confidence: aiValidation.confidence,
                        ai_comment: aiValidation.comment,
                        entry_min: signal.entryMin || null,
                        entry_max: signal.entryMax || null,
                        stop_loss: signal.stopLoss || null,
                        take_profit_1: signal.takeProfit1 || null,
                        max_risk_percent: signal.maxRiskPercent || null,
                    });
                }
            } catch (error) {
                logger.error(`Error processing signal for ${symbol}:`, error);
            }
        }
    }
}

const tradingService = new TradingService();
export default tradingService;