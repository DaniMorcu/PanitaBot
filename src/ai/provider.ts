/**
 * Interfaz abstracta para proveedores de IA.
 * Permite cambiar fácilmente entre Gemini, OpenAI y Claude.
 */
export interface AIProvider {
  readonly name: string;

  /**
   * Envía un prompt a la IA y devuelve la respuesta.
   * @param prompt - La pregunta o instrucción del usuario
   * @param context - Contexto adicional (mensajes anteriores del chat)
   * @param maxTokens - Límite de tokens para la respuesta
   * @param apiKey - API key específica del grupo (opcional, usa la global si no se da)
   */
  chat(
    prompt: string,
    context?: string,
    maxTokens?: number,
    apiKey?: string
  ): Promise<string>;

  /**
   * Resume una lista de mensajes del chat.
   * @param messages - Array de mensajes formateados como "usuario: texto"
   * @param maxTokens - Límite de tokens para el resumen
   * @param apiKey - API key específica del grupo (opcional)
   */
  summarize(
    messages: string[],
    maxTokens?: number,
    apiKey?: string
  ): Promise<string>;
}
