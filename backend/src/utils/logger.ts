import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logDir = path.join(__dirname, '../../logs');
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'warn' : 'info');
const enableFileLogs = process.env.LOG_TO_FILE === 'true';
const enableTradeLogs = process.env.LOG_TRADE_DETAILS === 'true';

function stringifyMeta(meta: Record<string, unknown>): string {
    const keys = Object.keys(meta);
    if (keys.length === 0) return '';

    // Winston can turn string metadata into index-keyed objects; collapse it back.
    const numericKeys = keys.filter((key) => /^\d+$/.test(key));
    if (numericKeys.length > 0) {
        const text = numericKeys
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => String(meta[key] ?? ''))
            .join('');
        const nonNumericMeta = Object.fromEntries(
            Object.entries(meta).filter(([key]) => !/^\d+$/.test(key))
        );
        const nonNumericKeys = Object.keys(nonNumericMeta);
        if (nonNumericKeys.length === 0) {
            return ` ${text}`;
        }
        return ` ${text} ${JSON.stringify(nonNumericMeta)}`;
    }

    return ` ${JSON.stringify(meta)}`;
}

if (enableFileLogs && !fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                return `${timestamp} [${level}]: ${message}${stringifyMeta(meta)}`;
            })
        ),
    }),
];

if (enableFileLogs) {
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
            tailable: true,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 20 * 1024 * 1024,
            maxFiles: 5,
            tailable: true,
        })
    );
}

if (enableFileLogs && enableTradeLogs) {
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'trades.log'),
            level: 'info',
            maxsize: 20 * 1024 * 1024,
            maxFiles: 3,
            tailable: true,
        })
    );
}

const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'binance-trader' },
    transports,
});

export default logger;
