import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

class GeminiService {
    /**
     * Get confidence score for a trading signal
     */
    async analyzeSignal(symbol: string, rationale: string[], candles: any[]) {
        try {
            if (!process.env.GEMINI_API_KEY) {
                return { confidence: 100, comment: "AI scoring disabled (no API key)" };
            }

            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

            const candleSummary = candles.slice(-10).map(c => 
                `Price: $${c.close}, Vol: ${c.volume}`
            ).join('\n');

            const prompt = `
                Analyze this crypto trading signal for ${symbol}:
                Technical Rationale: ${rationale.join('; ')}
                Recent Price Action:
                ${candleSummary}

                Return a JSON response with:
                1. "confidence": A score from 0-100.
                2. "comment": A brief 1-sentence explanation of why you gave that score.
                
                Respond ONLY with the JSON object.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Clean up the response if it contains markdown code blocks
            const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleanedText);
        } catch (error: any) {
            logger.error("Gemini Signal Analysis Error:", error.message);
            return { confidence: 50, comment: "AI analysis failed, using default confidence." };
        }
    }

    /**
     * Generate a morning market brief
     */
    async getMarketBrief(marketData: string) {
        try {
            if (!process.env.GEMINI_API_KEY) return "AI Brief disabled.";

            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const prompt = `
                You are a professional crypto analyst. 
                Summarize the current market state based on this data:
                ${marketData}
                
                Provide a 3-sentence summary highlighting the most interesting setup.
            `;

            const result = await model.generateContent(prompt);
            return (await result.response).text();
        } catch (error: any) {
            return "Unable to generate market brief at this time.";
        }
    }

    /**
     * Analyze a closed trade (Post-Mortem)
     */
    async analyzeTradeResult(trade: any) {
        try {
            if (!process.env.GEMINI_API_KEY) return;

            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const prompt = `
                Analyze this closed trade for ${trade.symbol}:
                Entry: $${trade.entry_price}
                Exit: $${trade.exit_price}
                PnL: $${trade.realized_pnl} (${trade.realized_pnl_percent}%)
                Status: ${trade.status}
                
                Briefly explain what went right or wrong in 1 sentence.
            `;

            const result = await model.generateContent(prompt);
            return (await result.response).text();
        } catch (error: any) {
            return "Trade analysis unavailable.";
        }
    }
}

export default new GeminiService();
