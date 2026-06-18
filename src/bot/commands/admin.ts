import type { Context } from "grammy";
import type { Api } from "grammy";
import { getOrCreateGroupConfig } from "../../db/models/groupConfig";
import type { AIModelName } from "../../config";
import { config } from "../../config";
import { encrypt, decrypt, hashPassword } from "../../ai/encryption";

const VALID_MODELS: AIModelName[] = ["gemini", "grok", "openai", "claude"];
const VALID_KEY_PROVIDERS = ["gemini", "grok", "openai"] as const;

/**
 * Ejecuta un comando admin tras la verificación por DM.
 * Retorna el mensaje de confirmación para enviar al grupo.
 */
export async function executeAdminCommand(
  command: string,
  args: string,
  chatId: number,
  _userId: number,
  _api: Api
): Promise<string> {
  switch (command) {
    case "modelo":
      return await executeSetModel(chatId, args);
    case "tokens":
      return await executeSetMaxTokens(chatId, args);
    case "cuantos":
      return await executeSetSummaryCount(chatId, args);
    case "calla":
      return await executeCalla(chatId);
    case "habla":
      return await executeHabla(chatId);
    case "clave":
      return await executeSetApiKey(chatId, args);
    case "sinllave":
      return await executeRemoveApiKey(chatId, args);
    case "candado":
      return await executeSetAdminPass(chatId, args);
    case "sincandado":
      return await executeRemoveAdminPass(chatId);
    default:
      return `¿/${command}? Eso no existe ni en tu imaginación, pana.`;
  }
}

// --- Funciones de ejecución de comandos ---

async function executeSetModel(chatId: number, args: string): Promise<string> {
  const model = args.trim();
  if (!model || !VALID_MODELS.includes(model as AIModelName)) {
    return `Ese modelo no existe ni en tus sueños, parcero. Los que hay son: ${VALID_MODELS.join(", ")}. No te inventes.`;
  }
  const groupConfig = await getOrCreateGroupConfig(chatId);
  groupConfig.aiModel = model as AIModelName;
  await groupConfig.save();
  return `Cerebro cambiado a \`${model}\`. Si respondo peor que antes, no es culpa mía.`;
}

async function executeSetMaxTokens(chatId: number, args: string): Promise<string> {
  const tokens = parseInt(args.trim(), 10);
  if (isNaN(tokens) || tokens < 100 || tokens > 8192) {
    return "Dame un número entre 100 y 8192, no me vengas con inventos.";
  }
  const groupConfig = await getOrCreateGroupConfig(chatId);
  groupConfig.maxTokens = tokens;
  await groupConfig.save();
  if (tokens < 200) {
    return `Tokens en \`${tokens}\`. Con eso te respondo "sí", "no" o "vete al carajo". Tú decides.`;
  }
  if (tokens > 4000) {
    return `Tokens en \`${tokens}\`. Eso es un discurso presidencial, pero tú pagas.`;
  }
  return `Límite de tokens en \`${tokens}\`. De una.`;
}

async function executeSetSummaryCount(chatId: number, args: string): Promise<string> {
  const count = parseInt(args.trim(), 10);
  if (isNaN(count) || count < 10 || count > 200) {
    return "Entre 10 y 200, genio. ¿Tan difícil es leer las instrucciones?";
  }
  const groupConfig = await getOrCreateGroupConfig(chatId);
  groupConfig.summaryCount = count;
  await groupConfig.save();
  if (count > 150) {
    return `Tope de resumen en \`${count}\` mensajes. Eso es más chisme que una novela de Telemundo.`;
  }
  return `Tope de resumen en \`${count}\` mensajes. Listo, jefe.`;
}

async function executeCalla(chatId: number): Promise<string> {
  const groupConfig = await getOrCreateGroupConfig(chatId);
  groupConfig.enabled = false;
  await groupConfig.save();
  return "Me callo el hocico. Cuando se aburran sin mí, /habla y vuelvo. No me extrañen mucho. 🤐";
}

async function executeHabla(chatId: number): Promise<string> {
  const groupConfig = await getOrCreateGroupConfig(chatId);
  groupConfig.enabled = true;
  await groupConfig.save();
  return "¡Volví, desgraciados! ¿Qué desmadre hicieron sin mí? 🎤";
}

/**
 * /clave <provider> <apikey> - Configura la API key de un provider específico.
 * Ejemplo: /clave gemini AIza...
 *          /clave grok xai-...
 *          /clave openai sk-...
 */
async function executeSetApiKey(chatId: number, args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const provider = parts[0]?.toLowerCase();
  const apiKey = parts.slice(1).join(" ").trim();

  if (!provider || !VALID_KEY_PROVIDERS.includes(provider as any)) {
    return `Uso: /clave <provider> <apikey>\nProviders válidos: ${VALID_KEY_PROVIDERS.join(", ")}\nEjemplo: /clave gemini AIza...`;
  }

  if (!apiKey || apiKey.length < 10) {
    return "Esa key tiene menos caracteres que tu contraseña del WiFi. Mínimo 10, pana.";
  }

  const groupConfig = await getOrCreateGroupConfig(chatId);
  const encryptedKey = encrypt(apiKey, config.encryptionKey);

  switch (provider) {
    case "gemini":
      groupConfig.geminiApiKey = encryptedKey;
      break;
    case "grok":
      groupConfig.grokApiKey = encryptedKey;
      break;
    case "openai":
      groupConfig.openaiApiKey = encryptedKey;
      break;
  }

  await groupConfig.save();
  return `API key de *${provider}* configurada. A partir de ahora los costes de ${provider} salen de tu bolsillo. Bienvenido al capitalismo. 💸`;
}

/**
 * /sinllave [provider] - Quita la API key de un provider (o todas si no se especifica).
 */
async function executeRemoveApiKey(chatId: number, args: string): Promise<string> {
  const provider = args.trim().toLowerCase();
  const groupConfig = await getOrCreateGroupConfig(chatId);

  if (!provider) {
    // Quitar todas las keys
    groupConfig.geminiApiKey = undefined;
    groupConfig.grokApiKey = undefined;
    groupConfig.openaiApiKey = undefined;
    await groupConfig.save();
    return "Todas las llaves removidas. Se usarán las keys globales (si existen). Sin llave no hay IA gratis, pana.";
  }

  if (!VALID_KEY_PROVIDERS.includes(provider as any)) {
    return `Provider no válido. Los que hay son: ${VALID_KEY_PROVIDERS.join(", ")}`;
  }

  switch (provider) {
    case "gemini":
      groupConfig.geminiApiKey = undefined;
      break;
    case "grok":
      groupConfig.grokApiKey = undefined;
      break;
    case "openai":
      groupConfig.openaiApiKey = undefined;
      break;
  }

  await groupConfig.save();
  return `Llave de *${provider}* removida. Se usará la key global (si existe).`;
}

async function executeSetAdminPass(chatId: number, args: string): Promise<string> {
  const password = args.trim();
  if (!password || password.length < 4) {
    return "¿4 caracteres es mucho pedir? Pon una clave decente, no seas flojo.";
  }
  const groupConfig = await getOrCreateGroupConfig(chatId);
  groupConfig.adminPasswordHash = hashPassword(password);
  await groupConfig.save();
  return "Candado puesto. Ahora nadie toca nada sin verificación por DM. Dictadura total instaurada. 🔒";
}

async function executeRemoveAdminPass(chatId: number): Promise<string> {
  const groupConfig = await getOrCreateGroupConfig(chatId);
  groupConfig.adminPasswordHash = undefined;
  await groupConfig.save();
  return "Candado quitado. Democracia restaurada. Anarquía, más bien. 🔓";
}

// --- Handlers directos para comandos sin verificación DM ---

/**
 * /config - Muestra la configuración actual del grupo (solo lectura, no requiere clave).
 */
export async function configCommand(ctx: Context): Promise<void> {
  if (!ctx.chat) return;

  const groupConfig = await getOrCreateGroupConfig(ctx.chat.id);
  const hasGeminiKey = !!groupConfig.geminiApiKey;
  const hasGrokKey = !!groupConfig.grokApiKey;
  const hasOpenaiKey = !!groupConfig.openaiApiKey;
  const hasAdminPass = !!groupConfig.adminPasswordHash;

  const keysStatus = [
    hasGeminiKey ? "gemini ✓" : null,
    hasGrokKey ? "grok ✓" : null,
    hasOpenaiKey ? "openai ✓" : null,
  ].filter(Boolean).join(", ") || "Ninguna (se usan las globales)";

  const configText = [
    "*Así está el rancho (no toques nada sin permiso):*",
    "",
    `Cerebro: \`${groupConfig.aiModel}\``,
    `Máx. tokens: \`${groupConfig.maxTokens}\``,
    `Tope de resumen: \`${groupConfig.summaryCount}\` mensajes`,
    `Estado: \`${groupConfig.enabled ? "Hablando (por desgracia de algunos)" : "Calladito 🤐"}\``,
    `API keys propias: \`${keysStatus}\``,
    `Candado admin: \`${hasAdminPass ? "Puesto 🔒 (dictadura)" : "Sin candado (anarquía)"}\``,
    "",
    "*Comandos de jefe:*",
    "`/modelo <gemini|grok|openai|claude>` - Cambiar cerebro",
    "`/tokens <N>` - Cuánto me dejas hablar (100-8192)",
    "`/cuantos <N>` - Tope de mensajes pa'l resumen (10-200)",
    "`/calla` - Me callo",
    "`/habla` - Me devuelves la palabra",
    "`/clave <provider> <key>` - Poner API key (gemini/grok/openai)",
    "`/sinllave [provider]` - Quitar API key",
    "`/candado <clave>` - Instaurar dictadura",
    "`/sincandado` - Restaurar la anarquía",
  ].join("\n");

  await ctx.reply(configText, { parse_mode: "Markdown" });
}

/**
 * Handlers directos para cuando NO hay clave admin configurada.
 */
export async function setModelCommand(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const args = ctx.message?.text?.replace(/^\/modelo(@\w+)?\s*/, "").trim() || "";
  const result = await executeSetModel(ctx.chat.id, args);
  await ctx.reply(result, { parse_mode: "Markdown" });
}

export async function setMaxTokensCommand(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const args = ctx.message?.text?.replace(/^\/tokens(@\w+)?\s*/, "").trim() || "";
  const result = await executeSetMaxTokens(ctx.chat.id, args);
  await ctx.reply(result, { parse_mode: "Markdown" });
}

export async function setSummaryCountCommand(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const args = ctx.message?.text?.replace(/^\/cuantos(@\w+)?\s*/, "").trim() || "";
  const result = await executeSetSummaryCount(ctx.chat.id, args);
  await ctx.reply(result, { parse_mode: "Markdown" });
}

export async function callaCommand(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const result = await executeCalla(ctx.chat.id);
  await ctx.reply(result);
}

export async function hablaCommand(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const result = await executeHabla(ctx.chat.id);
  await ctx.reply(result);
}

export async function setApiKeyCommand(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const args = ctx.message?.text?.replace(/^\/clave(@\w+)?\s*/, "").trim() || "";
  const result = await executeSetApiKey(ctx.chat.id, args);
  await ctx.reply(result, { parse_mode: "Markdown" });

  // Borrar el mensaje del usuario pa' que la key no quede expuesta
  try {
    if (ctx.message?.message_id) {
      await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
    }
  } catch {
    // Sin permisos pa' borrar, qué ladilla
  }
}

export async function removeApiKeyCommand(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const args = ctx.message?.text?.replace(/^\/sinllave(@\w+)?\s*/, "").trim() || "";
  const result = await executeRemoveApiKey(ctx.chat.id, args);
  await ctx.reply(result, { parse_mode: "Markdown" });
}

export async function setAdminPassCommand(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.from) return;

  // Solo el dueño del rancho puede poner candado
  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    try {
      const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (member.status !== "creator") {
        await ctx.reply("Solo el dueño del rancho pone candado, plebeyo. Tú no mandas aquí.");
        return;
      }
    } catch {
      await ctx.reply("No pude verificar quién coño eres. Intenta otra vez.");
      return;
    }
  }

  const args = ctx.message?.text?.replace(/^\/candado(@\w+)?\s*/, "").trim() || "";
  const result = await executeSetAdminPass(ctx.chat.id, args);
  await ctx.reply(result);

  // Borrar mensaje pa' que la clave no quede visible
  try {
    if (ctx.message?.message_id) {
      await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
    }
  } catch {
    // Sin permisos
  }
}

export async function removeAdminPassCommand(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.from) return;

  // Solo el creador puede quitar el candado
  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    try {
      const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (member.status !== "creator") {
        await ctx.reply("Solo el dueño del rancho quita el candado. ¿Quién te crees?");
        return;
      }
    } catch {
      await ctx.reply("No pude verificar quién coño eres. Intenta otra vez.");
      return;
    }
  }

  const result = await executeRemoveAdminPass(ctx.chat.id);
  await ctx.reply(result);
}

/**
 * Obtiene la API key descifrada para un grupo según el modelo activo.
 * Retorna la key del grupo o undefined si no hay.
 */
export function getGroupApiKey(groupConfig: { aiModel: string; geminiApiKey?: string; grokApiKey?: string; openaiApiKey?: string }): string | undefined {
  let encryptedKey: string | undefined;

  switch (groupConfig.aiModel) {
    case "gemini":
      encryptedKey = groupConfig.geminiApiKey;
      break;
    case "grok":
      encryptedKey = groupConfig.grokApiKey;
      break;
    case "openai":
      encryptedKey = groupConfig.openaiApiKey;
      break;
    default:
      return undefined;
  }

  if (!encryptedKey) return undefined;

  try {
    return decrypt(encryptedKey, config.encryptionKey);
  } catch (error) {
    console.error("[Admin] Error al descifrar API key:", error);
    return undefined;
  }
}
