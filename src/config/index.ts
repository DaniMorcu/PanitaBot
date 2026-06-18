import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno requerida: ${name}`);
  }
  return value;
}

export const config = {
  // Telegram
  botToken: requireEnv("BOT_TOKEN"),

  // Modo de operación: webhook (Cloud Run) o polling (local/Docker Compose)
  mode: (process.env.MODE || "polling") as "webhook" | "polling",

  // Webhook (solo para modo webhook)
  webhookUrl: process.env.WEBHOOK_URL || "",
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  port: parseInt(process.env.PORT || "8080", 10),

  // AI API Keys & Models (opcionales - cada grupo puede tener la suya)
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite",
  xaiApiKey: process.env.XAI_API_KEY || "",
  grokModel: process.env.GROK_MODEL || "grok-4.3",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",

  // Cifrado de API keys almacenadas en MongoDB
  encryptionKey: requireEnv("ENCRYPTION_KEY"),

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/panitabot",

  // Defaults
  defaultModel: (process.env.DEFAULT_MODEL || "gemini") as AIModelName,
  defaultMaxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || "1024", 10),
  defaultSummaryCount: parseInt(
    process.env.DEFAULT_SUMMARY_COUNT || "50",
    10
  ),
} as const;

export type AIModelName = "gemini" | "grok" | "openai" | "claude";
