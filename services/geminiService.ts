
import { GoogleGenAI } from "@google/genai";
import { PortfolioData, MarketPriceUpdate } from "../types";
import { CONFIG } from "../config";

// Fix: Always use process.env.API_KEY directly when initializing the client
const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });

export const fetchMarketPrices = async (): Promise<MarketPriceUpdate> => {
  const response = await ai.models.generateContent({
    model: CONFIG.gemini.model,
    contents: "Find the current price of SJC gold at DOJI Vietnam and the current USDT/VND rate on Binance P2P. Return the numbers only in a clear format.",
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  // Fix: Access response.text as a property, not a method
  const text = response.text || "";
  
  // Basic parsing logic
  const goldMatch = text.match(/(\d{2,3}[,.]\d{3}[,.]\d{3}|\d{2,3}[,.]\d{3})/g);
  const usdtMatch = text.match(/2[456][,.]\d{3}/g);

  const goldPrice = goldMatch ? parseInt(goldMatch[0].replace(/[,.]/g, '')) : 85000000;
  const usdtPrice = usdtMatch ? parseInt(usdtMatch[0].replace(/[,.]/g, '')) : 25400;

  return {
    goldPrice,
    usdtPrice,
    lastUpdated: new Date().toLocaleString('vi-VN'),
    sourceNotes: text
  };
};

export const generateTelegramReport = async (portfolio: PortfolioData, rebalanceAlerts: string[]): Promise<string> => {
  const prompt = `
    You are an AI investment assistant. Generate a Telegram notification message for the user based on their current portfolio:
    
    Data:
    - Gold: ${portfolio.assets.GOLD.amount} lượng, Price: ${portfolio.assets.GOLD.currentPrice.toLocaleString()} VND/lượng
    - USDT: ${portfolio.assets.USDT.amount} USDT, Price: ${portfolio.assets.USDT.currentPrice.toLocaleString()} VND/USDT
    - Savings: ${portfolio.assets.SAVINGS.amount.toLocaleString()} VND
    
    Alerts:
    ${rebalanceAlerts.length > 0 ? rebalanceAlerts.join('\n') : "No rebalancing needed."}
    
    Tone: Professional, concise, in Vietnamese. Use emojis (📈, 💰, ⚖️).
    Highlight the "Total Asset Value" and clear "Action Needed" if rebalancing is required.
  `;

  const response = await ai.models.generateContent({
    model: CONFIG.gemini.model,
    contents: prompt,
  });

  // Fix: Access response.text as a property
  return response.text || "Failed to generate report.";
};
