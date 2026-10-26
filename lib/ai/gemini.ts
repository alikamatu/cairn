import "server-only";
import { GoogleGenAI } from "@google/genai";

/** Default that works for new AI Studio keys. Override with GEMINI_MODEL. */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** Read at call time so env changes apply without a full process restart of stale module state. */
export function getModel(): string {
  return (process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL);
}

/** @deprecated Prefer getModel() — kept for callers that still import MODEL. */
export const MODEL = getModel();

let _client: GoogleGenAI | null = null;
let _cachedKey: string | undefined = undefined;

export function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  if (!_client || _cachedKey !== key) {
    _client = new GoogleGenAI({ apiKey: key });
    _cachedKey = key;
  }
  return _client;
}

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
