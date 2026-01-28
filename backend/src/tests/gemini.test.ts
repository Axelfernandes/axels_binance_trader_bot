import geminiService from '../services/gemini.service';
import logger from '../utils/logger';

async function testGemini() {
    console.log("🧪 Testing Gemini API connectivity...");
    try {
        const result = await geminiService.analyzeSignal(
            "BTCUSDT", 
            ["EMA Crossover Bullish", "RSI Oversold"], 
            [{ close: 40000, volume: 100 }, { close: 40500, volume: 150 }]
        );
        console.log("✅ Gemini Response:", JSON.stringify(result, null, 2));
        
        const brief = await geminiService.getMarketBrief("BTC is at $40k, ETH is at $2k");
        console.log("✅ Market Brief:", brief);
        
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Gemini Test Failed:", error.message);
        process.exit(1);
    }
}

testGemini();
