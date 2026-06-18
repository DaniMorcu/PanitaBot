import OpenAI from "openai";
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

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private modelName: string;

  constructor(modelName: string = config.openaiModel) {
    this.modelName = modelName;
  }

  /**
   * Resuelve la API key: usa la del grupo si existe, sino la global.
   */
  private resolveApiKey(apiKey?: string): string {
    const key = apiKey || config.openaiApiKey;
    if (!key) {
      throw new Error(
        "No hay API key de OpenAI configurada. Un admin debe usar /clave openai <key> para configurarla."
      );
    }
    return key;
  }

  /**
   * Crea un cliente OpenAI.
   */
  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      timeout: API_TIMEOUT_MS,
    });
  }

  async chat(
    prompt: string,
    context?: string,
    maxTokens?: number,
    apiKey?: string
  ): Promise<string> {
    const key = this.resolveApiKey(apiKey);
    const client = this.createClient(key);

    const fullPrompt = buildChatPrompt(prompt, context);

    const response = await client.chat.completions.create({
      model: this.modelName,
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        { role: "user", content: fullPrompt },
      ],
      max_tokens: maxTokens || config.defaultMaxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI no devolvió respuesta. Se quedó mudo el bicho.");
    }
    return content;
  }

  async summarize(
    messages: string[],
    maxTokens?: number,
    apiKey?: string
  ): Promise<string> {
    const key = this.resolveApiKey(apiKey);
    const client = this.createClient(key);

    const userPrompt = buildSummaryPrompt(messages);

    const response = await client.chat.completions.create({
      model: this.modelName,
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens || config.defaultMaxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI no devolvió resumen. Qué cagada.");
    }
    return content;
  }
}
