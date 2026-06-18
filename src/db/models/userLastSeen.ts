import mongoose, { Schema, Document } from "mongoose";

export interface IUserLastSeen extends Document {
  chatId: number;
  userId: number;
  lastSeenAt: Date;
}

const userLastSeenSchema = new Schema<IUserLastSeen>(
  {
    chatId: { type: Number, required: true },
    userId: { type: Number, required: true },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: false,
  }
);

// Índice compuesto único: un registro por usuario por chat
userLastSeenSchema.index({ chatId: 1, userId: 1 }, { unique: true });

export const UserLastSeen = mongoose.model<IUserLastSeen>(
  "UserLastSeen",
  userLastSeenSchema
);

/**
 * Actualiza la última actividad del usuario en un chat.
 * Usa updateOne + upsert para ser atómico y eficiente (sin leer primero).
 */
export async function updateLastSeen(
  chatId: number,
  userId: number
): Promise<void> {
  await UserLastSeen.updateOne(
    { chatId, userId },
    { $set: { lastSeenAt: new Date() } },
    { upsert: true }
  );
}

/**
 * Obtiene la última vez que el usuario interactuó en un chat.
 * Retorna null si no hay registro (usuario nuevo).
 */
export async function getLastSeen(
  chatId: number,
  userId: number
): Promise<Date | null> {
  const record = await UserLastSeen.findOne(
    { chatId, userId },
    { lastSeenAt: 1 }
  ).lean();
  return record?.lastSeenAt ?? null;
}
