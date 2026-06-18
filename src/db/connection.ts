import mongoose from "mongoose";
import { config } from "../config";

/**
 * Conecta a MongoDB. En modo webhook NO hace process.exit para no matar el container.
 * Lanza el error para que el caller pueda manejarlo.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("[DB] Conectado a MongoDB");
  } catch (error) {
    console.error("[DB] Error al conectar a MongoDB:", error);

    // En modo polling, crashear es aceptable (se reinicia con Docker)
    // En modo webhook, NO crashear (Cloud Run necesita el container vivo)
    if (config.mode === "polling") {
      process.exit(1);
    }
    throw error;
  }
}
