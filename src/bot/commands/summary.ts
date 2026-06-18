import type { Context } from "grammy";
import { Message } from "../../db/models/message";
import { getOrCreateGroupConfig } from "../../db/models/groupConfig";
import { getLastSeen, updateLastSeen } from "../../db/models/userLastSeen";
import { getAIProvider } from "../../ai";
import { editMessageSafe } from "../helpers/safeMarkdown";
import { sanitizeContextMessages } from "../../ai/sanitizer";
import { getGroupApiKey } from "./admin";

/**
 * /resumen - Resume los mensajes no leídos desde la última interacción del usuario.
 * Tiene un tope máximo configurable por grupo (summaryCount, default 50).
 */
export async function summaryCommand(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.from) return;

  const groupConfig = await getOrCreateGroupConfig(ctx.chat.id);
  const maxMessages = groupConfig.summaryCount;

  const statusMsg = await ctx.reply("A ver qué chisme te perdiste mientras andabas de vago...");

  try {
    // Resolver API key del grupo según el modelo activo
    const apiKey = getGroupApiKey(groupConfig);

    // Buscar última actividad del usuario en este chat
    const lastSeen = await getLastSeen(ctx.chat.id, ctx.from.id);

    let messages;

    if (lastSeen) {
      // Mensajes no leídos desde la última interacción
      messages = await Message.find({
        chatId: ctx.chat.id,
        date: { $gt: lastSeen },
      })
        .sort({ date: -1 })
        .limit(maxMessages)
        .select("userName text")
        .lean();
    } else {
      // Primera vez del usuario: fallback a los últimos summaryCount mensajes
      messages = await Message.find({ chatId: ctx.chat.id })
        .sort({ date: -1 })
        .limit(maxMessages)
        .select("userName text")
        .lean();
    }

    if (messages.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        "No te perdiste ni mierda, pana. Estás al día o aquí nadie habla, que es peor."
      );
      // Actualizar lastSeen aunque no haya mensajes
      await updateLastSeen(ctx.chat.id, ctx.from.id);
      return;
    }

    const formattedMessages = messages
      .reverse()
      .map((m) => `[${m.userName}]: ${m.text}`);

    // Sanitizar mensajes de contexto
    const sanitizedMessages = sanitizeContextMessages(formattedMessages);

    const provider = getAIProvider(groupConfig.aiModel);
    const summary = await provider.summarize(
      sanitizedMessages,
      groupConfig.maxTokens,
      apiKey
    );

    const cappedNote = messages.length >= maxMessages
      ? `\n\n_Hay más mensajes pero te puse el tope de ${maxMessages}. Si quieres más, pídele al admin que suba el /cuantos._`
      : "";

    const header = `*Lo que te perdiste por andar en la luna (${messages.length} mensajes):*\n\n`;
    await editMessageSafe(
      ctx.api,
      ctx.chat.id,
      statusMsg.message_id,
      header + summary + cappedNote
    );

    // Actualizar lastSeen después de generar el resumen
    await updateLastSeen(ctx.chat.id, ctx.from.id);
  } catch (error) {
    console.error("[Resumen] Error:", error);
    const errorMsg =
      error instanceof Error ? error.message : "Error desconocido";
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `Se me cagó el resumen: ${errorMsg}`
    );
  }
}
