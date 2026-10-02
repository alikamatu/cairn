import "server-only";
import { getGemini, isConfigured as isGeminiConfigured, MODEL as GEMINI_MODEL } from "./gemini";

export const MODEL = GEMINI_MODEL;
export const getAnthropic = getGemini;
export const isConfigured = isGeminiConfigured;
