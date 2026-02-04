import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function testGemini() {
    try {
        const modelName = "gemini-flash-latest";
        console.log(`Testing Gemini API with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hello world in 1 word.");
        const response = await result.response;
        console.log("Success! Response:", response.text());
    } catch (error: any) {
        console.error("Gemini Test Failed!");
        console.error("Error Message:", error.message);
    }
}

testGemini();
