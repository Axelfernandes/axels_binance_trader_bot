import { CandleChartInterval } from 'binance-api-node';
import binanceService from '../services/binance.service';
import logger from '../utils/logger';

async function testBinanceAPI() {
    console.log('=== Binance API Connectivity Test ===\n');

    try {
        // Test 1: Ping
        console.log('1. Testing connectivity...');
        const connected = await binanceService.testConnectivity();
        if (!connected) {
            throw new Error('Failed to connect to Binance API');
        }

        // Test 2: Get account balance
        console.log('\n2. Fetching account balance...');
        const balance = await binanceService.getAccountBalance();
        console.log('Account balances:');
        balance.forEach((b) => {
            console.log(`  ${b.asset}: ${b.free} (locked: ${b.locked})`);
        });

        // Test 3: Get USDT balance
        console.log('\n3. Fetching USDT balance...');
        const usdtBalance = await binanceService.getUSDTBalance();
        console.log(`USDT Balance: $${usdtBalance.toFixed(2)}`);

        // Test 4: Get BTC price
        console.log('\n4. Fetching BTC/USDT price...');
        const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
        console.log(`BTC/USDT: $${btcPrice.toFixed(2)}`);

        // Test 5: Get ETH price
        console.log('\n5. Fetching ETH/USDT price...');
        const ethPrice = await binanceService.getCurrentPrice('ETHUSDT');
        console.log(`ETH/USDT: $${ethPrice.toFixed(2)}`);

        // Test 6: Get klines
        console.log('\n6. Fetching BTC/USDT klines (last 10 candles)...');
        const klines = await binanceService.getKlines('BTCUSDT', CandleChartInterval.ONE_HOUR, 10);
        console.log(`Fetched ${klines.length} candles`);
        console.log('Latest candle:');
        const latest = klines[klines.length - 1];
        console.log(`  Open: $${latest.open.toFixed(2)}`);
        console.log(`  High: $${latest.high.toFixed(2)}`);
        console.log(`  Low: $${latest.low.toFixed(2)}`);
        console.log(`  Close: $${latest.close.toFixed(2)}`);
        console.log(`  Volume: ${latest.volume.toFixed(2)}`);

        console.log('\n✅ All tests passed!');
    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

testBinanceAPI();
