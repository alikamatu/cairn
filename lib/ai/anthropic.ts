import "server-only";
import { getGemini, getModel, isConfigured as isGeminiConfigured } from "./gemini";

export const getAnthropic = getGemini;
export const isConfigured = isGeminiConfigured;
export { getModel };
/** @deprecated Prefer getModel() */
export const MODEL = getModel();
