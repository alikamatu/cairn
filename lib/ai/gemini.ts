import "server-only";
import { GoogleGenAI } from "@google/genai";

export const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

let _client: GoogleGenAI | null = null;
let _cachedKey: string | undefined = undefined;

export function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_client || _cachedKey !== key) {
    _client = new GoogleGenAI({ apiKey: key });
    _cachedKey = key;
  }
  return _client;
}

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
