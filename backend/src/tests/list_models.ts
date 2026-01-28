import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function listModels() {
    try {
        console.log("Listing models...");
        // The listModels method is not directly on genAI in some versions, 
        // but let's try to just hit a simple prompt with a known model.
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Say hello");
        console.log("Response:", result.response.text());
    } catch (error: any) {
        console.error("Error:", error);
    }
}

listModels();
