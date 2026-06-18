import mongoose, { Schema, Document } from "mongoose";
import type { AIModelName } from "../../config";

export interface IGroupConfig extends Document {
  chatId: number;
  aiModel: AIModelName;
  maxTokens: number;
  summaryCount: number;
  enabled: boolean;
  geminiApiKey?: string; // Cifrado AES-256
  grokApiKey?: string; // Cifrado AES-256
  openaiApiKey?: string; // Cifrado AES-256
  adminPasswordHash?: string; // Hash scrypt
  createdAt: Date;
  updatedAt: Date;
}

const groupConfigSchema = new Schema<IGroupConfig>(
  {
    chatId: { type: Number, required: true, unique: true, index: true },
    aiModel: {
      type: String,
      enum: ["gemini", "grok", "openai", "claude"],
      default: "gemini",
    },
    maxTokens: { type: Number, default: 1024 },
    summaryCount: { type: Number, default: 50 },
    enabled: { type: Boolean, default: true },
    geminiApiKey: { type: String, default: undefined },
    grokApiKey: { type: String, default: undefined },
    openaiApiKey: { type: String, default: undefined },
    adminPasswordHash: { type: String, default: undefined },
  },
  {
    timestamps: true,
  }
);

export const GroupConfig = mongoose.model<IGroupConfig>(
  "GroupConfig",
  groupConfigSchema
);

/**
 * Obtiene o crea la configuración de un grupo.
 */
export async function getOrCreateGroupConfig(
  chatId: number
): Promise<IGroupConfig> {
  let groupConfig = await GroupConfig.findOne({ chatId });
  if (!groupConfig) {
    groupConfig = await GroupConfig.create({ chatId });
  }
  return groupConfig;
}

/**
 * Obtiene la config como POJO (más rápido, solo lectura).
 */
export async function getGroupConfigLean(
  chatId: number
): Promise<IGroupConfig | null> {
  return GroupConfig.findOne({ chatId }).lean<IGroupConfig>();
}
