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
    },
});
