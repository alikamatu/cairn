import "server-only";
import { getGemini, getModel } from "./gemini";

/**
 * Translate raw Gemini SDK errors into clean, user-facing messages.
 * Returns either markdown (for streaming consumers) or a short string.
 */
export type AiFailure = {
  kind: "no_credit" | "no_key" | "rate_limit" | "auth" | "overloaded" | "network" | "model" | "unknown";
  title: string;
  body: string;
};

export function classifyAiError(err: unknown): AiFailure {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("credit balance") || lower.includes("credit_balance")) {
    return {
      kind: "no_credit",
      title: "Gemini quota or credit limit reached",
      body: "Your Gemini API quota has been reached. Check your quota and billing at ai.google.dev or console.cloud.google.com.",
    };
  }
  if ((lower.includes("api key") && (lower.includes("not") || lower.includes("missing"))) || lower.includes("not configured")) {
    return { kind: "no_key", title: "AI not configured", body: "Set GEMINI_API_KEY in your environment to enable assistant features." };
  }
  if (lower.includes("rate limit") || lower.includes("rate_limit") || lower.includes("429")) {
    return { kind: "rate_limit", title: "Hit a rate limit", body: "Gemini is asking us to slow down. Try again in a minute." };
  }
  if (lower.includes("api_key_invalid") || lower.includes("access_token_type_unsupported") || lower.includes("unauthenticated") || lower.includes("401") || lower.includes("403") || lower.includes("permission_denied")) {
    return { kind: "auth", title: "AI key rejected", body: "Google Gemini didn't accept your API key. Check GEMINI_API_KEY and try again." };
  }
  if (lower.includes("no longer available") || lower.includes("not found") || (lower.includes("404") && lower.includes("model"))) {
    return {
      kind: "model",
      title: "Model unavailable",
      body: `The configured model (${getModel()}) isn't available. Set GEMINI_MODEL to gemini-3.5-flash-lite or gemini-3.8-flash.`,
    };
  }
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("econnreset") || lower.includes("etimedout") || lower.includes("timeout") || lower.includes("socket")) {
    return {
      kind: "network",
      title: "Couldn't reach Gemini",
      body: "Network request to Google failed. Check your connection and try again.",
    };
  }
  if (lower.includes("overloaded") || lower.includes("503") || lower.includes("unavailable") || lower.includes("500")) {
    return { kind: "overloaded", title: "Gemini is overloaded", body: "Try again in a moment." };
  }
  return { kind: "unknown", title: "Assistant error", body: raw || "Something went wrong calling the model." };
}

function failureMarkdown(f: AiFailure): string {
  return `**${f.title}.** ${f.body}`;
}

function toGeminiContents(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const m of messages) {
    const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: m.content });
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }

  if (contents.length > 0 && contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
  }

  return contents;
}

/**
 * Calls Gemini and returns a ReadableStream of UTF-8 text deltas.
 * The client just reads `response.body` chunk-by-chunk and appends.
 */
export function streamCompletion(args: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}): ReadableStream<Uint8Array> {
  const client = getGemini();
  const encoder = new TextEncoder();

  if (!client) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(failureMarkdown(classifyAiError("AI not configured"))));
        controller.close();
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const contents = toGeminiContents(args.messages);
        const responseStream = await client.models.generateContentStream({
          model: getModel(),
          contents,
          config: {
            systemInstruction: args.system,
            maxOutputTokens: args.maxTokens ?? 1024,
          },
        });

        for await (const chunk of responseStream) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(failureMarkdown(classifyAiError(err))));
        controller.close();
      }
    },
  });
}

/** One-shot non-streaming call. Returns the assembled text. */
export async function complete(args: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}): Promise<string> {
  const client = getGemini();
  if (!client) throw new Error("Gemini API key not configured.");
  const contents = toGeminiContents(args.messages);
  const res = await client.models.generateContent({
    model: getModel(),
    contents,
    config: {
      systemInstruction: args.system,
      maxOutputTokens: args.maxTokens ?? 1024,
    },
  });
  return (res.text ?? "").trim();
}
