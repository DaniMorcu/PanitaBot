import { createServer } from "http";
import { webhookCallback } from "grammy";
import { connectDatabase } from "./db/connection";
import { createBot } from "./bot";
import { config } from "./config";

async function main(): Promise<void> {
  console.log(`[PanitaBot] Iniciando en modo ${config.mode}...`);

  // Conectar a MongoDB
  await connectDatabase();

  // Crear el bot
  const bot = createBot();

  if (config.mode === "webhook") {
    // --- Modo Webhook (Cloud Run) ---
    if (!config.webhookUrl) {
      throw new Error("WEBHOOK_URL es requerida en modo webhook");
    }

    const handleUpdate = webhookCallback(bot, "http", {
      secretToken: config.webhookSecret || undefined,
    });

    const server = createServer(async (req, res) => {
      try {
        if (req.method === "POST" && req.url === "/webhook") {
          await handleUpdate(req, res);
        } else if (req.method === "GET" && req.url === "/health") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("El Panita está vivo, pana.");
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Aquí no hay nada, parcero.");
        }
      } catch (error) {
        console.error("[Webhook] Error procesando request:", error);
        res.writeHead(500).end();
      }
    });

    // Registrar webhook con Telegram
    const webhookFullUrl = `${config.webhookUrl}/webhook`;
    await bot.api.setWebhook(webhookFullUrl, {
      secret_token: config.webhookSecret || undefined,
    });
    console.log(`[PanitaBot] Webhook registrado: ${webhookFullUrl}`);

    // Iniciar servidor HTTP
    server.listen(config.port, () => {
      console.log(`[PanitaBot] Servidor HTTP escuchando en puerto ${config.port}`);
    });

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

    // Borrar webhook previo si existía (por si se cambió de modo)
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

main().catch((error) => {
  console.error("[PanitaBot] Error fatal:", error);
  process.exit(1);
});
