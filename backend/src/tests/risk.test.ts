import riskService from '../services/risk.service';
// import pool from '../config/database';

async function testRisk() {
    console.log('=== Risk Management Test ===\n');

    try {
        // Test 1: Position sizing
        console.log('1. Testing position sizing...');
        const equity = 100; // $100 starting capital
        const entryPrice = 50000; // BTC at $50,000
        const stopLoss = 47500; // 5% stop-loss

        const positionSize = riskService.calculatePositionSize(
            equity,
            entryPrice,
            stopLoss
        );

        console.log(`  Equity: $${equity}`);
        console.log(`  Entry Price: $${entryPrice}`);
        console.log(`  Stop Loss: $${stopLoss}`);
        console.log(`  Position Size: ${positionSize.toFixed(6)} BTC`);
        console.log(`  Notional Value: $${(positionSize * entryPrice).toFixed(2)}`);

        // Test 2: Check daily loss limit
        console.log('\n2. Testing daily loss limit check...');
        const dailyLossExceeded = await riskService.checkDailyLossLimit();
        console.log(`  Daily loss limit exceeded: ${dailyLossExceeded}`);

        // Test 3: Check open positions
        console.log('\n3. Checking open positions...');
        const openPositionsCount = await riskService.getOpenPositionsCount();
        console.log(`  Open positions: ${openPositionsCount}`);

        const hasBTCPosition = await riskService.hasOpenPosition('BTCUSDT');
        console.log(`  Has BTC/USDT position: ${hasBTCPosition}`);

        const hasETHPosition = await riskService.hasOpenPosition('ETHUSDT');
        console.log(`  Has ETH/USDT position: ${hasETHPosition}`);

        // Test 4: Validate a mock signal
        console.log('\n4. Testing signal validation...');
        const mockSignal = {
            symbol: 'BTCUSDT',
            direction: 'LONG' as const,
            entryMin: 49500,
            entryMax: 50500,
            stopLoss: 47975, // 5% below entry
            takeProfit1: 55500,
            maxRiskPercent: 5.0,
            rationale: ['Test signal'],
        };

        const validation = await riskService.validateTrade(mockSignal, equity);
        console.log(`  Validation result: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
        if (!validation.valid) {
            console.log(`  Reason: ${validation.reason}`);
        } else {
            console.log(`  Position size: ${validation.positionSize?.toFixed(6)} BTC`);
        }

        console.log('\n✅ Risk management test completed!');
    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    } finally {
        // await pool.end();
    }

    process.exit(0);
}

testRisk();
