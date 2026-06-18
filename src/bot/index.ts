import { Bot } from "grammy";
import { config } from "../config";
import { messageStoreMiddleware } from "./middlewares/messageStore";
import { adminOnly, handleDMVerification } from "./middlewares/auth";
import { rateLimitMiddleware } from "./middlewares/rateLimit";
import { askCommand } from "./commands/ask";
import { summaryCommand } from "./commands/summary";
import {
  configCommand,
  setModelCommand,
  setMaxTokensCommand,
  setSummaryCountCommand,
  callaCommand,
  hablaCommand,
  setApiKeyCommand,
  removeApiKeyCommand,
  setAdminPassCommand,
  removeAdminPassCommand,
  executeAdminCommand,
} from "./commands/admin";
import { helpCommand } from "./commands/help";
import { getOrCreateGroupConfig } from "../db/models/groupConfig";

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // --- Middleware global: verificar si el bot está activo en el grupo ---
  bot.use(async (ctx, next) => {
    if (ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup")) {
      const groupConfig = await getOrCreateGroupConfig(ctx.chat.id);
      // Permitir /habla incluso cuando está desactivado
      if (!groupConfig.enabled && ctx.message?.text?.startsWith("/habla")) {
        await next();
        return;
      }
      if (!groupConfig.enabled) return;
    }
    await next();
  });

  // --- Middleware global: almacenar mensajes y rastrear actividad ---
  bot.use(messageStoreMiddleware);

  // --- Handler para verificación de clave admin por DM ---
  bot.on("message:text", async (ctx, next) => {
    if (ctx.chat.type === "private") {
      const handled = await handleDMVerification(ctx, executeAdminCommand);
      if (handled) return;
    }
    await next();
  });

  // --- Comandos públicos ---
  bot.command(["arranca", "start"], (ctx) =>
    ctx.reply(
      "¡Epa! Soy El Panita. No me trates bonito que no soy tu terapeuta. Escribe /ayuda pa' ver qué hago por ti, si es que me da la gana."
    )
  );
  bot.command(["ayuda", "help"], helpCommand);

  // Comandos de IA con rate limiting
  bot.command(["oye", "ask"], rateLimitMiddleware(), askCommand);
  bot.command(["resumen", "summary"], rateLimitMiddleware(), summaryCommand);

  // --- Comandos de administración ---
  // /config solo requiere ser admin (lectura, no requiere clave)
  bot.command("config", adminOnly(false), configCommand);

  // Comandos que modifican config (requieren clave si está configurada)
  bot.command(["modelo", "model"], adminOnly(), setModelCommand);
  bot.command("tokens", adminOnly(), setMaxTokensCommand);
  bot.command("cuantos", adminOnly(), setSummaryCountCommand);
  bot.command(["calla", "quiet"], adminOnly(), callaCommand);
  bot.command(["habla", "speak"], adminOnly(), hablaCommand);
  bot.command(["clave", "key"], adminOnly(), setApiKeyCommand);
  bot.command(["sinllave", "nokey"], adminOnly(), removeApiKeyCommand);

  // Comandos exclusivos del creador (tienen su propia verificación interna)
  bot.command(["candado", "lock"], setAdminPassCommand);
  bot.command(["sincandado", "unlock"], removeAdminPassCommand);

  // --- Manejo de errores ---
  bot.catch((err) => {
    console.error("[Bot] Error no controlado:", err);
  });

  return bot;
}
