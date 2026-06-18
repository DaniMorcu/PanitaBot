import type { Context, NextFunction } from "grammy";
import { getOrCreateGroupConfig } from "../../db/models/groupConfig";
import { verifyPassword } from "../../ai/encryption";

/**
 * Acciones admin pendientes de verificación por DM.
 * Key: `userId` (un usuario solo puede tener una acción pendiente a la vez)
 */
export interface PendingAdminAction {
  chatId: number;
  chatTitle: string;
  command: string;
  args: string;
  expiresAt: number;
}

export const pendingActions = new Map<number, PendingAdminAction>();

/** Tiempo de expiración para verificación: 2 minutos */
const VERIFICATION_TIMEOUT_MS = 2 * 60_000;

/** Limpieza periódica de acciones expiradas */
setInterval(() => {
  const now = Date.now();
  for (const [key, action] of pendingActions) {
    if (now >= action.expiresAt) pendingActions.delete(key);
  }
}, 60_000).unref();

/**
 * Middleware que verifica si el usuario es administrador del grupo.
 * Si el grupo tiene clave de admin configurada, requiere verificación por DM.
 *
 * @param requirePassword - Si true, verifica la clave admin por DM cuando existe.
 */
export function adminOnly(requirePassword: boolean = true) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    if (!ctx.chat || !ctx.from) return;

    // En chats privados, el usuario siempre es "admin"
    if (ctx.chat.type === "private") {
      await next();
      return;
    }

    try {
      // Verificar que es admin de Telegram
      const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        await ctx.reply(
          "Ese comando no es pa' ti, plebeyo. Solo los jefes mandan aquí."
        );
        return;
      }

      // Si no requiere verificación de clave, pasar directamente
      if (!requirePassword) {
        await next();
        return;
      }

      // Verificar si el grupo tiene clave de admin configurada
      const groupConfig = await getOrCreateGroupConfig(ctx.chat.id);
      if (!groupConfig.adminPasswordHash) {
        // Sin candado, pasa de largo
        await next();
        return;
      }

      // Almacenar la acción pendiente y pedir verificación por DM
      const commandText = ctx.message?.text || "";
      const commandMatch = commandText.match(/^\/(\w+)(@\w+)?\s*(.*)/);
      const command = commandMatch?.[1] || "";
      const args = commandMatch?.[3] || "";

      pendingActions.set(ctx.from.id, {
        chatId: ctx.chat.id,
        chatTitle: ctx.chat.type === "supergroup" || ctx.chat.type === "group"
          ? (ctx.chat as any).title || "el grupo"
          : "el chat",
        command,
        args,
        expiresAt: Date.now() + VERIFICATION_TIMEOUT_MS,
      });

      await ctx.reply(
        "Te mandé un DM pa' verificar que no eres un impostor. Revisa tu chat conmigo, pana.",
        { reply_to_message_id: ctx.message?.message_id }
      );

      // Enviar DM pidiendo la clave
      try {
        await ctx.api.sendMessage(
          ctx.from.id,
          `Dame la clave de admin de *${pendingActions.get(ctx.from.id)?.chatTitle}* o te jodes.\n\n` +
          `Comando pendiente: \`/${command} ${args}\`\n\n` +
          `Tienes 2 minutos. Escribe la clave o se cancela:`,
          { parse_mode: "Markdown" }
        );
      } catch {
        // El usuario no ha iniciado chat con el bot
        pendingActions.delete(ctx.from.id);
        await ctx.reply(
          "No pude mandarte DM porque nunca me has hablado, genio. Búscame en privado, dale /arranca, y después vuelve a intentar."
        );
      }
    } catch (error) {
      console.error("[Auth] Error al verificar permisos:", error);
      await ctx.reply("No pude verificar quién coño eres. Intenta de nuevo.");
    }
  };
}

/**
 * Handler para mensajes privados que verifican la clave de admin.
 */
export async function handleDMVerification(
  ctx: Context,
  executeAdminCommand: (command: string, args: string, chatId: number, userId: number, api: Context["api"]) => Promise<string>
): Promise<boolean> {
  if (!ctx.chat || ctx.chat.type !== "private" || !ctx.from || !ctx.message?.text) {
    return false;
  }

  const pending = pendingActions.get(ctx.from.id);
  if (!pending) return false;

  // Verificar si expiró
  if (Date.now() >= pending.expiresAt) {
    pendingActions.delete(ctx.from.id);
    await ctx.reply("Se te venció el tiempo, lento. Ejecuta el comando de nuevo en el grupo.");
    return true;
  }

  const password = ctx.message.text.trim();
  const groupConfig = await getOrCreateGroupConfig(pending.chatId);

  if (!groupConfig.adminPasswordHash || !verifyPassword(password, groupConfig.adminPasswordHash)) {
    pendingActions.delete(ctx.from.id);
    await ctx.reply("Clave incorrecta, impostor. Comando cancelado. 🚫");
    return true;
  }

  // Clave correcta - ejecutar el comando pendiente
  pendingActions.delete(ctx.from.id);

  try {
    const result = await executeAdminCommand(
      pending.command,
      pending.args,
      pending.chatId,
      ctx.from.id,
      ctx.api
    );

    await ctx.reply("Verificado, eres de los míos. Comando ejecutado. ✅");
    // Confirmar en el grupo
    await ctx.api.sendMessage(pending.chatId, result);
  } catch (error) {
    console.error("[Auth] Error al ejecutar comando verificado:", error);
    await ctx.reply("Se cagó algo al ejecutar el comando. La vida es así. Intenta de nuevo.");
  }

  return true;
}
