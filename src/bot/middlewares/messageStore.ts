import type { Context, NextFunction } from "grammy";
import { Message } from "../../db/models/message";
import { updateLastSeen } from "../../db/models/userLastSeen";

/**
 * Middleware que:
 * 1. Registra la última actividad del usuario en el chat (cualquier actividad).
 * 2. Almacena mensajes de texto (no comandos) en MongoDB para contexto de IA.
 */
export async function messageStoreMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  // Registrar última actividad del usuario (toda actividad cuenta)
  if (ctx.chat && ctx.from) {
    // Fire and forget: no bloquea el flujo del bot
    updateLastSeen(ctx.chat.id, ctx.from.id).catch((err) =>
      console.error("[MessageStore] Error al actualizar lastSeen:", err)
    );
  }

  // Almacenar solo mensajes de texto (no comandos)
  if (ctx.message?.text && ctx.chat && ctx.from) {
    if (!ctx.message.text.startsWith("/")) {
      try {
        await Message.create({
          chatId: ctx.chat.id,
          userId: ctx.from.id,
          userName:
            ctx.from.username ||
            `${ctx.from.first_name} ${ctx.from.last_name || ""}`.trim(),
          text: ctx.message.text,
          date: new Date(ctx.message.date * 1000),
        });
      } catch (error) {
        console.error("[MessageStore] Error al guardar mensaje:", error);
      }
    }
  }

  await next();
}
