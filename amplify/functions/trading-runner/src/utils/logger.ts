import winston from 'winston';
// path module is not directly needed for lambda as file logging will be handled by cloudwatch
// import path from 'path';

// For Lambda, logs go to CloudWatch, so file transports are generally not used
// or need to be configured differently if persistent storage is desired (e.g., S3).
// Keeping basic console transport for Lambda compatibility.

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'binance-trader-lambda' },
    transports: [
        // Write all logs to console (CloudWatch)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
                        }`;
                })
            ),
        }),
    ],
});

export default logger;
