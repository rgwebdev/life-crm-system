import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemPrompt } from "./prompts"; // <--- Импортируем промпт отсюда

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export async function parseUserCommand(text, currentItems, currentActivities) {
  if (!API_KEY) {
    console.error("API Key is missing! Check .env file.");
    return [];
  }

  // Используем не самую дешевую и оч быструю модель)))
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  // 1. Подготавливаем списки для промпта (форматируем в строки)
  const itemsListStr = currentItems.map(i => `${i.name} (id:${i.id})`).join(", ");
  const activitiesListStr = currentActivities.map(a => `${a.name} (id:${a.id})`).join(", ");

  // 2. Генерируем текст промпта, вызывая функцию из prompts.js
  const systemInstruction = getSystemPrompt(itemsListStr, activitiesListStr);

  // 3. Добавляем сам запрос пользователя
  const finalPrompt = `${systemInstruction}\n\nЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${text}"`;

  try {
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const textResponse = response.text();
    
    // Чистим ответ от возможных markdown-кавычек (```json ... ```)
    const cleanJson = textResponse.replace(/```json|```/g, '').trim();
    
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("AI Parsing Error:", error);
    // Возвращаем пустой массив, чтобы приложение не упало
    return [];
  }
}