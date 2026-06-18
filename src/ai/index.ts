import type { AIModelName } from "../config";
import type { AIProvider } from "./provider";
import { GeminiProvider } from "./gemini";
import { GrokProvider } from "./grok";
import { OpenAIProvider } from "./openai";
import { ClaudeProvider } from "./claude";

/**
 * Factory que devuelve el proveedor de IA adecuado según el nombre del modelo.
 * Los providers se crean por llamada porque la API key puede variar por grupo.
 */
export function getAIProvider(model: AIModelName): AIProvider {
  switch (model) {
    case "gemini":
      return new GeminiProvider();
    case "grok":
      return new GrokProvider();
    case "openai":
      return new OpenAIProvider();
    case "claude":
      return new ClaudeProvider();
    default:
      throw new Error(`Modelo de IA no soportado: ${model}`);
  }
}

export type { AIProvider } from "./provider";
