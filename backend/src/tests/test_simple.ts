import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Try to use a different way to initialize or just see what's available
async function run() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        // There is no listModels in the browser/node SDK directly like this usually
        // but we can try to fetch it via a raw fetch if needed.
        // For now, let's try gemini-1.5-flash again but with a very simple call.
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent("Hi");
        console.log(result.response.text());
    } catch (e) {
        console.error(e);
    }
}
run();
