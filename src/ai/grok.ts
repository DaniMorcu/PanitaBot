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

export class GrokProvider implements AIProvider {
  readonly name = "grok";
  private modelName: string;

  constructor(modelName: string = config.grokModel) {
    this.modelName = modelName;
  }

  /**
   * Resuelve la API key: usa la del grupo si existe, sino la global.
   */
  private resolveApiKey(apiKey?: string): string {
    const key = apiKey || config.xaiApiKey;
    if (!key) {
      throw new Error(
        "No hay API key de xAI/Grok configurada. Un admin debe usar /clave grok <key> para configurarla."
      );
    }
    return key;
  }

  /**
   * Crea un cliente OpenAI apuntando a xAI.
   */
  private createClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
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
      throw new Error("Grok no devolvió respuesta. Qué raro, pana.");
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
      throw new Error("Grok no devolvió resumen. La vaina se complicó.");
    }
    return content;
  }
}
