import { CandleChartInterval } from 'binance-api-node';
import binanceService from '../services/binance.service';
import strategyService from '../services/strategy.service';
import logger from '../utils/logger';

async function testStrategy() {
    console.log('=== Strategy Service Test ===\n');

    try {
        // Fetch BTC data
        console.log('1. Fetching BTC/USDT data (1h, 100 candles)...');
        const btcData = await binanceService.getKlines('BTCUSDT', CandleChartInterval.ONE_HOUR, 100);
        console.log(`Fetched ${btcData.length} candles\n`);

        // Generate signal
        console.log('2. Generating signal for BTC/USDT...');
        const btcSignal = await strategyService.generateSignal('BTCUSDT', btcData);
        console.log(`Signal: ${btcSignal.direction}`);
        console.log('Rationale:');
        btcSignal.rationale.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));

        if (btcSignal.direction === 'LONG') {
            console.log('\nTrade Details:');
            console.log(`  Entry Zone: $${btcSignal.entryMin?.toFixed(2)} - $${btcSignal.entryMax?.toFixed(2)}`);
            console.log(`  Stop Loss: $${btcSignal.stopLoss?.toFixed(2)}`);
            console.log(`  Take Profit 1: $${btcSignal.takeProfit1?.toFixed(2)}`);
            console.log(`  Take Profit 2: $${btcSignal.takeProfit2?.toFixed(2)}`);
            console.log(`  Max Risk: ${btcSignal.maxRiskPercent}%`);
        }

        // Fetch ETH data
        console.log('\n3. Fetching ETH/USDT data (1h, 100 candles)...');
        const ethData = await binanceService.getKlines('ETHUSDT', CandleChartInterval.ONE_HOUR, 100);
        console.log(`Fetched ${ethData.length} candles\n`);

        // Generate signal
        console.log('4. Generating signal for ETH/USDT...');
        const ethSignal = await strategyService.generateSignal('ETHUSDT', ethData);
        console.log(`Signal: ${ethSignal.direction}`);
        console.log('Rationale:');
        ethSignal.rationale.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));

        if (ethSignal.direction === 'LONG') {
            console.log('\nTrade Details:');
            console.log(`  Entry Zone: $${ethSignal.entryMin?.toFixed(2)} - $${ethSignal.entryMax?.toFixed(2)}`);
            console.log(`  Stop Loss: $${ethSignal.stopLoss?.toFixed(2)}`);
            console.log(`  Take Profit 1: $${ethSignal.takeProfit1?.toFixed(2)}`);
            console.log(`  Take Profit 2: $${ethSignal.takeProfit2?.toFixed(2)}`);
            console.log(`  Max Risk: ${ethSignal.maxRiskPercent}%`);
        }

        console.log('\n✅ Strategy test completed!');
    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

testStrategy();
