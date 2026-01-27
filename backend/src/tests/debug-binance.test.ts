import Binance from 'binance-api-node';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function debugBinanceConnection() {
    console.log('=== Binance API Debug Test ===\n');

    console.log('1. Checking environment variables...');
    console.log(`API Key: ${process.env.BINANCE_API_KEY?.substring(0, 10)}...`);
    console.log(`API Secret: ${process.env.BINANCE_API_SECRET?.substring(0, 10)}...`);
    console.log(`Trading Mode: ${process.env.TRADING_MODE}\n`);

    try {
        console.log('2. Creating Binance client...');
        const client = Binance({
            apiKey: process.env.BINANCE_API_KEY || '',
            apiSecret: process.env.BINANCE_API_SECRET || '',
        });
        console.log('✅ Client created\n');

        console.log('3. Testing ping (no auth required)...');
        try {
            await client.ping();
            console.log('✅ Ping successful\n');
        } catch (error: any) {
            console.error('❌ Ping failed:', error.message);
            console.error('Full error:', error);
            throw error;
        }

        console.log('4. Testing time endpoint (no auth required)...');
        try {
            const time = await client.time();
            console.log(`✅ Server time: ${new Date(time).toISOString()}\n`);
        } catch (error: any) {
            console.error('❌ Time failed:', error.message);
            console.error('Full error:', error);
            throw error;
        }

        console.log('5. Testing account info (requires auth)...');
        try {
            const accountInfo = await client.accountInfo();
            console.log('✅ Account info retrieved');
            console.log(`Account type: ${accountInfo.accountType}`);
            console.log(`Can trade: ${accountInfo.canTrade}`);
            console.log(`Can withdraw: ${accountInfo.canWithdraw}`);
            console.log(`Can deposit: ${accountInfo.canDeposit}\n`);
        } catch (error: any) {
            console.error('❌ Account info failed:', error.message);
            console.error('Error code:', error.code);
            console.error('Full error:', error);
            throw error;
        }

        console.log('6. Testing prices endpoint (no auth required)...');
        try {
            const prices = await client.prices({ symbol: 'BTCUSDT' });
            console.log(`✅ BTC/USDT price: $${prices.BTCUSDT}\n`);
        } catch (error: any) {
            console.error('❌ Prices failed:', error.message);
            console.error('Full error:', error);
            throw error;
        }

        console.log('✅ All tests passed!');
    } catch (error: any) {
        console.error('\n❌ Test failed');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.code) console.error('Error code:', error.code);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        process.exit(1);
    }

    process.exit(0);
}

debugBinanceConnection();
