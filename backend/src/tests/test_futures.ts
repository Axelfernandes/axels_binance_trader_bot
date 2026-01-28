import Binance from 'binance-api-node';
import dotenv from 'dotenv';

dotenv.config();

const client = Binance({
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
});

async function testFutures() {
    try {
        console.log('Testing Futures connectivity...');
        const prices = await client.futuresPrices();
        console.log('Futures BTCUSDT Price:', prices['BTCUSDT']);
        
        const info = await client.futuresExchangeInfo();
        const hasBtc = info.symbols.some(s => s.symbol === 'BTCUSDT');
        console.log('BTCUSDT available in Futures:', hasBtc);
        
        console.log('✅ Futures API is accessible.');
    } catch (error: any) {
        console.error('❌ Futures API Error:', error.message);
    }
}

testFutures();
