import { defineFunction } from '@aws-amplify/backend';

export const tradingRunner = defineFunction({
    name: 'trading-runner',
    entry: './handler.ts',
    timeoutSeconds: 60,
    memoryMB: 1024,
    environment: {
        BINANCE_API_KEY: process.env.BINANCE_API_KEY || '',
        BINANCE_API_SECRET: process.env.BINANCE_API_SECRET || '',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        TRADING_MODE: process.env.TRADING_MODE || 'paper',
        INITIAL_CAPITAL: process.env.INITIAL_CAPITAL || '100',
        MAX_DAILY_LOSS: process.env.MAX_DAILY_LOSS || '0.10',
        STOP_LOSS_PERCENT: process.env.STOP_LOSS_PERCENT || '0.05',
        RISK_PER_TRADE: process.env.RISK_PER_TRADE || '0.02',
    },
});
