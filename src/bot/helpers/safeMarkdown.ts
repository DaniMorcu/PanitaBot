import type { Api } from "grammy";

/**
 * Edita un mensaje intentando primero con Markdown.
 * Si Telegram rechaza el parseo (400 "can't parse entities"),
 * reintenta enviando el texto sin formato (plain text).
 */
export async function editMessageSafe(
  api: Api,
  chatId: number,
  messageId: number,
  text: string,
  parseMode: "Markdown" | "MarkdownV2" | "HTML" | undefined = "Markdown"
): Promise<void> {
  try {
    await api.editMessageText(chatId, messageId, text, {
      parse_mode: parseMode,
    });
  } catch (error) {
    // Si el error es de parseo de entidades, reintentar sin formato
    const isParseError =
      error instanceof Error &&
      error.message.includes("can't parse entities");

    if (isParseError) {
      // Eliminar caracteres de formato Markdown para enviar como texto plano
      const plainText = stripMarkdown(text);
      await api.editMessageText(chatId, messageId, plainText);
    } else {
      throw error;
    }
  }
}

/**
 * Elimina formato Markdown básico para convertir a texto plano legible.
 */
function stripMarkdown(text: string): string {
  return text
    // Bloques de código con lenguaje
    .replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/```\w*\n?/g, "").replace(/```/g, "");
    })
    // Código inline
    .replace(/`([^`]+)`/g, "$1")
    // Negrita
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    // Cursiva
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // Links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
