import { defineFunction } from '@aws-amplify/backend';

export const api = defineFunction({
    name: 'api',
    entry: './handler.ts',
    timeoutSeconds: 30,
    memoryMB: 512,
    environment: {
        BINANCE_API_KEY: process.env.BINANCE_API_KEY || '',
        BINANCE_API_SECRET: process.env.BINANCE_API_SECRET || '',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        TRADING_MODE: process.env.TRADING_MODE || 'paper',
        INITIAL_CAPITAL: process.env.INITIAL_CAPITAL || '100',
        MAX_DAILY_LOSS_PERCENT: process.env.MAX_DAILY_LOSS_PERCENT || '0.50',
        MAX_POSITION_RISK_PERCENT: process.env.MAX_POSITION_RISK_PERCENT || '0.01',
        MIN_RISK_REWARD_RATIO: process.env.MIN_RISK_REWARD_RATIO || '1.5',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        RISK_PER_TRADE: process.env.RISK_PER_TRADE || '0.02',
        MAX_DAILY_LOSS: process.env.MAX_DAILY_LOSS || '0.10',
        STOP_LOSS_PERCENT: process.env.STOP_LOSS_PERCENT || '0.05',
    },
});