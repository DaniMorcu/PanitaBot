import mongoose from "mongoose";
import { config } from "../config";

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
    process.exit(1);
  }
}
