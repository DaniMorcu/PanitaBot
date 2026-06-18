import type { Context } from "grammy";
import { Message } from "../../db/models/message";
import { getOrCreateGroupConfig } from "../../db/models/groupConfig";
import { getAIProvider } from "../../ai";
import { editMessageSafe } from "../helpers/safeMarkdown";
import { sanitizeUserInput, sanitizeContextMessages } from "../../ai/sanitizer";
import { getGroupApiKey } from "./admin";

/**
 * /oye <pregunta> - Pregunta a la IA con contexto del chat del grupo.
 * También funciona respondiendo a un mensaje con /oye para dar contexto específico.
 */
export async function askCommand(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.from) return;

  const rawPrompt = ctx.message?.text?.replace(/^\/oye(@\w+)?\s*/, "").trim();

  if (!rawPrompt) {
    await ctx.reply(
      "¿Y la pregunta, genio? Pon algo después del /oye o me quedo aquí esperando como pendejo.\nEjemplo: /oye ¿qué es un closure en JavaScript?"
    );
    return;
  }

  // Sanitizar input del usuario
  const prompt = sanitizeUserInput(rawPrompt);

  const statusMsg = await ctx.reply("Procesando tu vaina, dame un segundo...");

  try {
    const groupConfig = await getOrCreateGroupConfig(ctx.chat.id);

    // Resolver API key del grupo según el modelo activo
    const apiKey = getGroupApiKey(groupConfig);

    const provider = getAIProvider(groupConfig.aiModel);

    // Obtener contexto: últimos mensajes del grupo (solo campos necesarios)
    const recentMessages = await Message.find({ chatId: ctx.chat.id })
      .sort({ date: -1 })
      .limit(20)
      .select("userName text")
      .lean();

    let context = "";
    if (recentMessages.length > 0) {
      const contextMessages = recentMessages
        .reverse()
        .map((m) => `${m.userName}: ${m.text}`);

      // Sanitizar mensajes de contexto
      const sanitizedContext = sanitizeContextMessages(contextMessages);
      context = sanitizedContext.join("\n");
    }

    // Si es respuesta a un mensaje, añadirlo como contexto prioritario
    if (ctx.message?.reply_to_message?.text) {
      const replyUser =
        ctx.message.reply_to_message.from?.username ||
        ctx.message.reply_to_message.from?.first_name ||
        "Usuario";
      const replyText = sanitizeUserInput(ctx.message.reply_to_message.text);
      context += `\n\n[Mensaje al que se responde - ${replyUser}]: ${replyText}`;
    }

    const response = await provider.chat(
      prompt,
      context || undefined,
      groupConfig.maxTokens,
      apiKey
    );

    await editMessageSafe(ctx.api, ctx.chat.id, statusMsg.message_id, response);
  } catch (error) {
    console.error("[Oye] Error:", error);
    const errorMsg =
      error instanceof Error ? error.message : "Error desconocido";
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `Se me cagó la cosa: ${errorMsg}`
    );
  }
}
