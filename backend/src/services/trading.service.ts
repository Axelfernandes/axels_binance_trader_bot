import { CandleChartInterval } from 'binance-api-node';
import binanceService from './binance.service';
import strategyService, { Signal } from './strategy.service';
import riskService from './risk.service';
import pool from '../config/database';
import logger from '../utils/logger';

interface Trade {
    id?: number;
    symbol: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    quantity: number;
    stopLoss: number;
    takeProfit: number;
    status: 'OPEN' | 'CLOSED';
}

class TradingService {
    private symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'];
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

        // Run immediately, then every 5 seconds
        await this.runTradingCycle();
        this.intervalId = setInterval(() => this.runTradingCycle(), 5 * 1000);

        logger.info('✅ Trading engine started (running every 5 seconds)');
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

            // 1. Get account balance
            const usdtBalance = await binanceService.getUSDTBalance();
            // logger.info(`Current USDT balance: $${usdtBalance.toFixed(2)}`); // Reduce log noise

            // Save account snapshot
            await this.saveAccountSnapshot(usdtBalance);

            // 2. Check and manage open positions
            await this.manageOpenPositions();

            // 3. Generate and evaluate signals for each symbol
            for (const symbol of this.symbols) {
                await this.evaluateSymbol(symbol, usdtBalance);
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
                logger.info(`Signal for ${symbol}: ${signal.direction}`);
                logger.info(`Rationale: ${signal.rationale.join('; ')}`);
                
                // Save signal to database
                await this.saveSignal(signal);

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
            const result = await pool.query(
                `SELECT * FROM trades WHERE status = 'OPEN' ORDER BY opened_at DESC`
            );

            const openTrades = result.rows;

            for (const trade of openTrades) {
                const currentPrice = await binanceService.getCurrentPrice(trade.symbol);
                const ohlcv = await binanceService.getKlines(trade.symbol, CandleChartInterval.ONE_MINUTE, 100);

                const exitCheck = strategyService.shouldExitPosition(
                    parseFloat(trade.entry_price),
                    currentPrice,
                    parseFloat(trade.stop_loss),
                    parseFloat(trade.take_profit),
                    ohlcv
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
    private async closePosition(trade: any, exitPrice: number, reason: string) {
        try {
            // Place sell order
            await binanceService.placeMarketOrder(
                trade.symbol,
                'SELL',
                parseFloat(trade.quantity)
            );

            // Calculate PnL
            const realizedPnl =
                (exitPrice - parseFloat(trade.entry_price)) *
                parseFloat(trade.quantity);
            const realizedPnlPercent =
                ((exitPrice - parseFloat(trade.entry_price)) /
                    parseFloat(trade.entry_price)) *
                100;

            // Update trade in database
            await pool.query(
                `UPDATE trades 
         SET status = 'CLOSED', 
             exit_price = $1, 
             realized_pnl = $2, 
             realized_pnl_percent = $3,
             closed_at = NOW(),
             notes = $4
         WHERE id = $5`,
                [exitPrice, realizedPnl, realizedPnlPercent, reason, trade.id]
            );

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
            await pool.query(
                `INSERT INTO signals (user_id, symbol, direction, entry_min, entry_max, stop_loss, take_profit_1, take_profit_2, max_risk_percent, rationale)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    signal.symbol,
                    signal.direction,
                    signal.entryMin || null,
                    signal.entryMax || null,
                    signal.stopLoss || null,
                    signal.takeProfit1 || null,
                    signal.takeProfit2 || null,
                    signal.maxRiskPercent || null,
                    JSON.stringify(signal.rationale),
                ]
            );
        } catch (error: any) {
            logger.error('Error saving signal:', error.message);
        }
    }

    /**
     * Save trade to database
     */
    private async saveTrade(trade: Trade): Promise<number> {
        try {
            const result = await pool.query(
                `INSERT INTO trades (user_id, symbol, side, order_type, entry_price, quantity, stop_loss, take_profit, status, is_paper_trade)
         VALUES (1, $1, $2, 'MARKET', $3, $4, $5, $6, $7, $8)
         RETURNING id`,
                [
                    trade.symbol,
                    trade.side,
                    trade.entryPrice,
                    trade.quantity,
                    trade.stopLoss,
                    trade.takeProfit,
                    trade.status,
                    process.env.TRADING_MODE === 'paper',
                ]
            );

            return result.rows[0].id;
        } catch (error: any) {
            logger.error('Error saving trade:', error.message);
            throw error;
        }
    }

    /**
     * Save account snapshot
     */
    private async saveAccountSnapshot(totalEquity: number) {
        try {
            await pool.query(
                `INSERT INTO account_snapshots (user_id, total_equity, available_balance)
         VALUES (1, $1, $2)`,
                [totalEquity, totalEquity]
            );
        } catch (error: any) {
            logger.error('Error saving account snapshot:', error.message);
        }
    }
}

export default new TradingService();
