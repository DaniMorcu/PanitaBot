import type { Context, NextFunction } from "grammy";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** Límites configurables */
const USER_LIMIT = 5; // máximo llamadas por usuario por ventana
const GROUP_LIMIT = 20; // máximo llamadas por grupo por ventana
const WINDOW_MS = 60_000; // ventana de 1 minuto
const CLEANUP_INTERVAL_MS = 5 * 60_000; // limpiar cada 5 minutos

/** Stores en memoria */
const userLimits = new Map<string, RateLimitEntry>();
const groupLimits = new Map<number, RateLimitEntry>();

/**
 * Limpia entradas expiradas del Map de rate limiting.
 */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of userLimits) {
    if (now >= entry.resetAt) userLimits.delete(key);
  }
  for (const [key, entry] of groupLimits) {
    if (now >= entry.resetAt) groupLimits.delete(key);
  }
}

// Limpieza periódica
setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();

/**
 * Verifica y actualiza el rate limit para una key dada.
 * Retorna true si se excedió el límite.
 */
function isRateLimited(
  store: Map<string | number, RateLimitEntry>,
  key: string | number,
  limit: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > limit) {
    return true;
  }

  return false;
}

/**
 * Middleware de rate limiting para comandos de IA (/oye, /resumen).
 * Limita por usuario (5/min) y por grupo (20/min).
 */
export function rateLimitMiddleware() {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    if (!ctx.from) {
      await next();
      return;
    }

    const userId = ctx.from.id;
    const chatId = ctx.chat?.id;

    // Rate limit por usuario (global, no importa el grupo)
    const userKey = `user:${userId}`;
    if (isRateLimited(userLimits, userKey, USER_LIMIT)) {
      await ctx.reply(
        "¿Qué eres, un bot? Relaja la mano que esto no es gratis. Espérate un minuto."
      );
      return;
    }

    // Rate limit por grupo
    if (chatId && (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup")) {
      if (isRateLimited(groupLimits, chatId, GROUP_LIMIT)) {
        await ctx.reply(
          "Este grupo parece call center. Cálmense un poco, coño, que me van a fundir."
        );
        return;
      }
    }

    await next();
  };
}
