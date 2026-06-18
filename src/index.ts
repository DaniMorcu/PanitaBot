import { createServer } from "http";
import { webhookCallback } from "grammy";
import { connectDatabase } from "./db/connection";
import { createBot } from "./bot";
import { config } from "./config";

async function main(): Promise<void> {
  console.log(`[PanitaBot] Iniciando en modo ${config.mode}...`);

  if (config.mode === "webhook") {
    // --- Modo Webhook (Cloud Run) ---
    // IMPORTANTE: Arrancar HTTP server PRIMERO para que Cloud Run no mate el container.
    // MongoDB y webhook se configuran DESPUÉS.

    const bot = createBot();

    const handleUpdate = webhookCallback(bot, "http", {
      secretToken: config.webhookSecret || undefined,
    });

    let dbReady = false;

    const server = createServer(async (req, res) => {
      try {
        if (req.method === "POST" && req.url === "/webhook") {
          if (!dbReady) {
            // MongoDB no está listo, rechazar temporalmente
            res.writeHead(503, { "Content-Type": "text/plain" });
            res.end("Service starting up");
            return;
          }
          await handleUpdate(req, res);
        } else if (req.method === "GET" && req.url === "/health") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(dbReady ? "El Panita está vivo, pana." : "Arrancando...");
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Aquí no hay nada, parcero.");
        }
      } catch (error) {
        console.error("[Webhook] Error procesando request:", error);
        res.writeHead(500).end();
      }
    });

    // 1. Arrancar servidor HTTP (Cloud Run lo necesita YA)
    server.listen(config.port, () => {
      console.log(`[PanitaBot] Servidor HTTP escuchando en puerto ${config.port}`);
    });

    // 2. Conectar a MongoDB (con reintentos, sin crashear)
    try {
      await connectDatabase();
      dbReady = true;
      console.log("[PanitaBot] MongoDB conectado, bot listo para recibir updates.");
    } catch (error) {
      console.error("[PanitaBot] Error al conectar MongoDB:", error);
      console.error("[PanitaBot] El bot seguirá intentando en cada request...");
      // Intentar reconectar en background
      retryDatabaseConnection().then(() => {
        dbReady = true;
        console.log("[PanitaBot] MongoDB reconectado exitosamente.");
      });
    }

    // 3. Registrar webhook con Telegram (puede fallar en primer deploy sin URL)
    if (config.webhookUrl) {
      try {
        const webhookFullUrl = `${config.webhookUrl}/webhook`;
        await bot.api.setWebhook(webhookFullUrl, {
          secret_token: config.webhookSecret || undefined,
        });
        console.log(`[PanitaBot] Webhook registrado: ${webhookFullUrl}`);
      } catch (error) {
        console.error("[PanitaBot] Error al registrar webhook (se registrará en el re-deploy):", error);
      }
    } else {
      console.log("[PanitaBot] WEBHOOK_URL vacía, no se registra webhook (primer deploy).");
    }

    // Graceful shutdown
    const shutdown = () => {
      console.log("[PanitaBot] Deteniendo servidor...");
      server.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } else {
    // --- Modo Polling (local / Docker Compose) ---
    await connectDatabase();

    const bot = createBot();

    // Borrar webhook previo si existía
    await bot.api.deleteWebhook();

    // Manejar señales de parada
    const shutdown = () => {
      console.log("[PanitaBot] Deteniendo...");
      bot.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Iniciar bot con long polling
    console.log("[PanitaBot] Bot iniciado con long polling. Esperando mensajes...");
    await bot.start();
  }
}

/**
 * Reintenta conectar a MongoDB con backoff exponencial.
 */
async function retryDatabaseConnection(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
    console.log(`[PanitaBot] Reintentando MongoDB en ${delay / 1000}s (intento ${attempt}/${maxRetries})...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await connectDatabase();
      return;
    } catch (error) {
      console.error(`[PanitaBot] Reintento ${attempt} falló:`, error);
    }
  }
  console.error("[PanitaBot] No se pudo conectar a MongoDB después de todos los reintentos.");
}

main().catch((error) => {
  console.error("[PanitaBot] Error fatal:", error);
  process.exit(1);
});
