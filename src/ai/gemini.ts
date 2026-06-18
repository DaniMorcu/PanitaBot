import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider } from "./provider";
import { config } from "../config";
import {
  CHAT_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  buildChatPrompt,
  buildSummaryPrompt,
} from "./prompts";

/** Timeout para llamadas a la API (30 segundos) */
const API_TIMEOUT_MS = 30_000;

/**
 * Envuelve una promesa con timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("La IA tardó demasiado en responder. Intenta de nuevo, pana.")),
      ms
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private modelName: string;

  constructor(modelName: string = config.geminiModel) {
    this.modelName = modelName;
  }

  /**
   * Resuelve la API key: usa la del grupo si existe, sino la global.
   */
  private resolveApiKey(apiKey?: string): string {
    const key = apiKey || config.geminiApiKey;
    if (!key) {
      throw new Error(
        "No hay API key configurada. Un admin debe usar /setapikey para configurar la key de Gemini."
      );
    }
    return key;
  }

  /**
   * Crea un cliente de Gemini con la API key proporcionada.
   */
  private createClient(apiKey: string): GoogleGenerativeAI {
    return new GoogleGenerativeAI(apiKey);
  }

  async chat(
    prompt: string,
    context?: string,
    maxTokens?: number,
    apiKey?: string
  ): Promise<string> {
    const key = this.resolveApiKey(apiKey);
    const client = this.createClient(key);

    const model = client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: CHAT_SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: maxTokens || config.defaultMaxTokens,
      },
    });

    const fullPrompt = buildChatPrompt(prompt, context);

    const result = await withTimeout(
      model.generateContent(fullPrompt),
      API_TIMEOUT_MS
    );
    return result.response.text();
  }

  async summarize(
    messages: string[],
    maxTokens?: number,
    apiKey?: string
  ): Promise<string> {
    const key = this.resolveApiKey(apiKey);
    const client = this.createClient(key);

    const model = client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SUMMARY_SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: maxTokens || config.defaultMaxTokens,
      },
    });

    const prompt = buildSummaryPrompt(messages);

    const result = await withTimeout(
      model.generateContent(prompt),
      API_TIMEOUT_MS
    );
    return result.response.text();
  }
}
