import type { AIProvider } from "./provider";

/**
 * Stub para Claude (Anthropic). Implementar cuando se necesite.
 * Requiere instalar: npm install @anthropic-ai/sdk
 */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude";

  async chat(
    _prompt: string,
    _context?: string,
    _maxTokens?: number,
    _apiKey?: string
  ): Promise<string> {
    throw new Error(
      "Claude no está implementado todavía, pana. Usa /setmodel gemini para cambiar al modelo disponible."
    );
  }

  async summarize(
    _messages: string[],
    _maxTokens?: number,
    _apiKey?: string
  ): Promise<string> {
    throw new Error(
      "Claude no está implementado todavía, pana. Usa /setmodel gemini para cambiar al modelo disponible."
    );
  }
}
