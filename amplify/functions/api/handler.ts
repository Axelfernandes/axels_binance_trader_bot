import { Handler } from 'aws-lambda';
import serverlessExpress from '@codegenie/serverless-express';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import and use your existing routes
// Note: We'll need to adapt your backend/src/index.ts routes here
// For now, adding a simple placeholder

app.get('/api/dashboard/stats', async (req, res) => {
    res.json({
        totalEquity: 0,
        availableBalance: 0,
        openPositions: 0,
        dailyPnl: 0,
        winRate: '0.00',
        tradingMode: process.env.TRADING_MODE || 'paper',
    });
});

app.get('/api/signals', async (req, res) => {
    res.json([]);
});

app.get('/api/trades', async (req, res) => {
    res.json([]);
});

app.get('/api/market-brief', async (req, res) => {
    res.json({ brief: 'Market data loading...' });
});

// Debug catch-all
app.use((req, res) => {
    console.log(`[DEBUG] Unmatched ${req.method} request to: ${req.path}`);
    res.status(404).json({ 
        error: 'Not Found', 
        method: req.method,
        path: req.path,
        message: 'This route is not implemented in the current Lambda handler.'
    });
});

export const handler: Handler = serverlessExpress({ app });
