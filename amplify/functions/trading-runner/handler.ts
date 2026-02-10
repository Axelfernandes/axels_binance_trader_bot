import { Handler } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import tradingService from './src/services/trading.service';
import binanceService from './src/services/binance.service';
import client from './src/config/database';
import logger from './src/utils/logger';

const CONFIG_ID = 'main';
const DEFAULT_CONFIG = {
    cadence: 'STANDARD_1M',
    enabled: true,
};

const SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
    'PEPEUSDT', 'DOGEUSDT', 'SHIBUSDT', 'WIFUSDT', 'BONKUSDT', 'FETUSDT',
];

const wsClient = process.env.WS_API_ENDPOINT
    ? new ApiGatewayManagementApiClient({ endpoint: process.env.WS_API_ENDPOINT })
    : null;

async function getOrCreateConfig() {
    const existing = await client.models.TradingConfig.get({ id: CONFIG_ID });
    if (existing?.data) {
        return existing.data;
    }

    const created = await client.models.TradingConfig.create({
        id: CONFIG_ID,
        cadence: DEFAULT_CONFIG.cadence,
        enabled: DEFAULT_CONFIG.enabled,
        updated_at: new Date().toISOString(),
    });
    return created.data;
}

async function broadcastPrices() {
    if (!wsClient) {
        logger.warn('WS_API_ENDPOINT not set. Skipping price broadcast.');
        return;
    }

    const { data: connections } = await client.models.WsConnection.list({ limit: 1000 });
    if (!connections.length) return;

    const prices: Record<string, number> = {};
    for (const symbol of SYMBOLS) {
        try {
            prices[symbol] = await binanceService.getCurrentPrice(symbol);
        } catch (error: any) {
            logger.warn(`Failed to fetch price for ${symbol}: ${error.message}`);
        }
    }

    const payloads = Object.entries(prices).map(([symbol, price]) => ({
        symbol,
        price,
    }));

    for (const connection of connections) {
        for (const update of payloads) {
            try {
                await wsClient.send(new PostToConnectionCommand({
                    ConnectionId: connection.connection_id,
                    Data: Buffer.from(JSON.stringify({
                        type: 'PRICE_UPDATE',
                        symbol: update.symbol,
                        price: update.price,
                    })),
                }));
            } catch (error: any) {
                if (error?.name === 'GoneException') {
                    await client.models.WsConnection.delete({ id: connection.id });
                } else {
                    logger.warn(`Failed to send WS update to ${connection.connection_id}: ${error.message}`);
                }
            }
        }
    }
}

export const handler: Handler = async (event) => {
    const invokedCadence = event?.cadence || event?.detail?.cadence || 'STANDARD_1M';
    const config = await getOrCreateConfig();

    if (!config.enabled) {
        return { skipped: 'disabled' };
    }

    if (config.cadence !== invokedCadence) {
        return { skipped: `cadence mismatch (${config.cadence} vs ${invokedCadence})` };
    }

    try {
        await tradingService.runOnce();
        await broadcastPrices();
        return { ok: true, cadence: invokedCadence };
    } catch (error: any) {
        logger.error('Trading runner failed:', error.message);
        throw error;
    }
};
