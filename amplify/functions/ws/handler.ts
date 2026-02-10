import { Handler } from 'aws-lambda';
import client from './src/config/database';
import logger from './src/utils/logger';

export const handler: Handler = async (event) => {
    const routeKey = event?.requestContext?.routeKey;
    const connectionId = event?.requestContext?.connectionId;

    if (!connectionId) {
        return { statusCode: 400, body: 'Missing connectionId' };
    }

    try {
        if (routeKey === '$connect') {
            await client.models.WsConnection.create({
                id: connectionId,
                connection_id: connectionId,
                connected_at: new Date().toISOString(),
            });
        } else if (routeKey === '$disconnect') {
            await client.models.WsConnection.delete({ id: connectionId });
        }

        return { statusCode: 200, body: 'ok' };
    } catch (error: any) {
        logger.error('WS handler error:', error.message);
        return { statusCode: 500, body: 'error' };
    }
};
