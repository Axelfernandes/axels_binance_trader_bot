import { CandleChartInterval } from 'binance-api-node';
import binanceService from './binance.service';
import strategyService, { Signal } from './strategy.service';
import riskService from './risk.service';
import geminiService from './gemini.service';
import { db } from '../config/database';
import logger from '../utils/logger';

interface Trade {
    id?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    quantity: number;
    stopLoss: number;
    takeProfit: number;
    status: 'OPEN' | 'CLOSED';
}

class TradingService {
    private symbols: string[] = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
        'PEPEUSDT', 'DOGEUSDT', 'SHIBUSDT', 'WIFUSDT', 'BONKUSDT', 'FETUSDT'
    ];
    private isRunning: boolean = false;
    private intervalId?: NodeJS.Timeout;

    /**
     * Start the trading engine
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Trading engine is already running');
            return;
        }

        logger.info('🚀 Starting trading engine...');
        this.isRunning = true;

        // Test Binance connectivity
        const connected = await binanceService.testConnectivity();
        if (!connected) {
            logger.error('Failed to connect to Binance API. Stopping engine.');
            this.isRunning = false;
            return;
        }

        // Run immediately, then every 60 seconds
        await this.runTradingCycle();
        this.intervalId = setInterval(() => this.runTradingCycle(), 60 * 1000);

        logger.info('✅ Trading engine started (running every 60 seconds)');
    }

    /**
     * Run a single trading cycle (for scheduler)
     */
    async runOnce() {
        await this.runTradingCycle();
    }

    /**
     * Stop the trading engine
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        this.isRunning = false;
        logger.info('🛑 Trading engine stopped');
    }

    /**
     * Main trading cycle
     */
    private async runTradingCycle() {
        try {
            logger.info('--- Trading Cycle Started ---');

            // 1. Get account balance and calculate total equity
            const { totalEquity, availableBalance } = await this.calculateTotalEquity();
            logger.info(`Total Equity: $${totalEquity.toFixed(2)}, Available Balance: $${availableBalance.toFixed(2)}`);

            // Save account snapshot
            await this.saveAccountSnapshot(totalEquity, availableBalance);

            // 2. Check and manage open positions
            await this.manageOpenPositions();

            // 3. Generate and evaluate signals for each symbol
            for (const symbol of this.symbols) {
                await this.evaluateSymbol(symbol, availableBalance);
            }

            // logger.info('--- Trading Cycle Completed ---\n'); // Reduce log noise
        } catch (error: any) {
            logger.error('Error in trading cycle:', error.message);
        }
    }

    /**
     * Evaluate a symbol for trading opportunities
     */
    private async evaluateSymbol(symbol: string, equity: number) {
        try {
            // Fetch OHLCV data (1m timeframe for faster signals, last 100 candles)
            const ohlcv = await binanceService.getKlines(symbol, CandleChartInterval.ONE_MINUTE, 100);

            // Generate signal
            const signal = await strategyService.generateSignal(symbol, ohlcv);

            if (signal.direction !== 'NO_TRADE') {
                logger.info(`Technical signal for ${symbol}: ${signal.direction}`);

                // --- AI ENHANCEMENT: Analyze Signal with Gemini ---
                const aiAnalysis = await geminiService.analyzeSignal(symbol, signal.rationale, ohlcv);
                signal.aiConfidence = aiAnalysis.confidence;
                signal.aiComment = aiAnalysis.comment;

                logger.info(`AI Analysis for ${symbol}: ${signal.aiConfidence}% confidence - ${signal.aiComment}`);

                // Save signal to database
                await this.saveSignal(signal);

                // Risk Filter: Check AI Confidence before validating trade
                if (signal.aiConfidence !== undefined && signal.aiConfidence < 75) {
                    logger.warn(`Trade skipped: AI confidence too low (${signal.aiConfidence}%)`);
                    return;
                }

                const validation = await riskService.validateTrade(signal, equity);

                if (validation.valid && validation.positionSize) {
                    await this.executeTrade(signal, validation.positionSize);
                } else {
                    logger.warn(`Trade validation failed: ${validation.reason}`);
                }
            }
        } catch (error: any) {
            logger.error(`Error evaluating ${symbol}:`, error.message);
        }
    }

    /**
     * Execute a trade (paper or live)
     */
    private async executeTrade(signal: Signal, positionSize: number) {
        try {
            const currentPrice = await binanceService.getCurrentPrice(signal.symbol);

            logger.info(
                `Executing ${signal.direction} trade for ${signal.symbol}: ${positionSize.toFixed(6)} @ $${currentPrice.toFixed(2)}`
            );

            // Place market order (in paper mode, this just logs)
            await binanceService.placeMarketOrder(
                signal.symbol,
                'BUY',
                positionSize
            );

            // Save trade to database
            const tradeId = await this.saveTrade({
                symbol: signal.symbol,
                side: 'BUY',
                entryPrice: currentPrice,
                quantity: positionSize,
                stopLoss: signal.stopLoss!,
                takeProfit: signal.takeProfit1!,
                status: 'OPEN',
            });

            // Place stop-loss order
            const stopLimitPrice = signal.stopLoss! * 0.995; // Slightly below stop
            await binanceService.placeStopLossOrder(
                signal.symbol,
                'SELL',
                positionSize,
                signal.stopLoss!,
                stopLimitPrice
            );

            logger.info(`✅ Trade executed successfully (ID: ${tradeId})`);
        } catch (error: any) {
            logger.error('Error executing trade:', error.message);
        }
    }

    /**
     * Manage open positions (check for exits)
     */
    private async manageOpenPositions() {
        try {
            const openTradesSnap = await db.collection('trades').where('status', '==', 'OPEN').limit(50).get();
            const openTrades = openTradesSnap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    symbol: data.symbol,
                    side: data.side,
                    entryPrice: data.entry_price,
                    quantity: data.quantity,
                    stopLoss: data.stop_loss,
                    takeProfit: data.take_profit,
                    status: data.status,
                };
            }) as Trade[];

            // Cast to compatible type or map if necessary
            for (const trade of openTrades) {
                const currentPrice = await binanceService.getCurrentPrice(trade.symbol);
                const ohlcv = await binanceService.getKlines(trade.symbol, CandleChartInterval.ONE_MINUTE, 100);

                const exitCheck = strategyService.shouldExitPosition(
                    trade.entryPrice,
                    currentPrice,
                    trade.stopLoss,
                    trade.takeProfit,
                    ohlcv,
                    undefined,
                    undefined,
                    trade.side as 'LONG' | 'SHORT'
                );

                if (exitCheck.shouldExit) {
                    logger.info(
                        `Closing position for ${trade.symbol}: ${exitCheck.reason}`
                    );
                    await this.closePosition(trade, currentPrice, exitCheck.reason);
                }
            }
        } catch (error: any) {
            logger.error('Error managing open positions:', error.message);
        }
    }

    /**
     * Close a position
     */
    private async closePosition(trade: Trade, exitPrice: number, reason: string) {
        try {
            // Place sell order
            await binanceService.placeMarketOrder(
                trade.symbol,
                'SELL',
                trade.quantity
            );

            // Calculate PnL
            const realizedPnl =
                (exitPrice - trade.entryPrice) *
                trade.quantity;
            const realizedPnlPercent =
                ((exitPrice - trade.entryPrice) /
                    trade.entryPrice) *
                100;

            // --- AI ENHANCEMENT: Post-Mortem Analysis ---
            const tradeData = { ...trade, exit_price: exitPrice, realized_pnl: realizedPnl, realized_pnl_percent: realizedPnlPercent };
            const aiAnalysis = await geminiService.analyzeTradeResult(tradeData);

            if (!trade.id) {
                throw new Error('Cannot update trade: missing trade ID');
            }

            // Update trade in database
            await db.collection('trades').doc(trade.id).update({
                id: trade.id,
                status: 'CLOSED',
                exit_price: exitPrice,
                realized_pnl: realizedPnl,
                realized_pnl_percent: realizedPnlPercent,
                closed_at: new Date().toISOString(),
                ai_analysis: aiAnalysis
            });

            logger.info(
                `✅ Position closed: ${trade.symbol} | PnL: $${realizedPnl.toFixed(2)} (${realizedPnlPercent.toFixed(2)}%) | Reason: ${reason}`
            );
        } catch (error: any) {
            logger.error('Error closing position:', error.message);
        }
    }

    /**
     * Save signal to database
     */
    private async saveSignal(signal: Signal) {
        try {
            await db.collection('signals').add({
                symbol: signal.symbol,
                direction: signal.direction as "LONG" | "SHORT", // Cast to enum
                entry_min: signal.entryMin,
                entry_max: signal.entryMax,
                stop_loss: signal.stopLoss,
                take_profit_1: signal.takeProfit1,
                max_risk_percent: signal.maxRiskPercent,
                rationale: signal.rationale,
                ai_confidence: signal.aiConfidence ? Math.round(signal.aiConfidence) : undefined, // Ensure integer
                ai_comment: signal.aiComment,
                generated_at: new Date().toISOString()
            });
        } catch (error: any) {
            logger.error('Error saving signal:', error.message);
        }
    }

    /**
     * Save trade to database
     */
    private async saveTrade(trade: Trade): Promise<string> {
        try {
            const newTradeRef = await db.collection('trades').add({
                symbol: trade.symbol,
                side: trade.side,
                entry_price: trade.entryPrice,
                quantity: trade.quantity,
                stop_loss: trade.stopLoss,
                take_profit: trade.takeProfit,
                status: trade.status,
                opened_at: new Date().toISOString(),
            });

            if (!newTradeRef) throw new Error("Failed to create trade");
            return newTradeRef.id;
        } catch (error: any) {
            logger.error('Error saving trade:', error.message);
            throw error;
        }
    }

    /**
     * Calculate total account equity including all assets
     */
    private async calculateTotalEquity(): Promise<{ totalEquity: number; availableBalance: number }> {
        try {
            // Get all account balances
            const balances = await binanceService.getAccountBalance();

            // Get USDT balance (available for trading)
            const usdtBalance = balances.find(b => b.asset === 'USDT');
            const availableBalance = usdtBalance ? usdtBalance.free : 0;

            // Calculate total equity by converting all assets to USDT value
            let totalEquity = availableBalance;

            for (const balance of balances) {
                if (balance.asset === 'USDT') continue; // Already counted

                const assetAmount = balance.free + balance.locked;
                if (assetAmount <= 0) continue;

                try {
                    // Get current price of asset in USDT
                    const symbol = `${balance.asset}USDT`;
                    const price = await binanceService.getCurrentPrice(symbol);
                    const assetValue = assetAmount * price;
                    totalEquity += assetValue;
                } catch (error) {
                    // If price fetch fails (e.g., for assets not traded against USDT), skip
                    logger.warn(`Could not get price for ${balance.asset}, excluding from total equity`);
                }
            }

            return { totalEquity, availableBalance };
        } catch (error: any) {
            logger.error('Error calculating total equity:', error.message);
            throw error;
        }
    }

    /**
     * Save account snapshot
     */
    private async saveAccountSnapshot(totalEquity: number, availableBalance: number) {
        try {
            await db.collection('accountSnapshots').add({
                total_equity: totalEquity,
                available_balance: availableBalance,
                timestamp: new Date().toISOString()
            });
        } catch (error: any) {
            logger.error('Error saving account snapshot:', error.message);
        }
    }
}

export default new TradingService();
