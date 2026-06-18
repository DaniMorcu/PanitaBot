import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  chatId: number;
  userId: number;
  userName: string;
  text: string;
  date: Date;
}

const messageSchema = new Schema<IMessage>({
  chatId: { type: Number, required: true, index: true },
  userId: { type: Number, required: true },
  userName: { type: String, required: true },
  text: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
});

// Índice compuesto para consultas eficientes de últimos mensajes por grupo
messageSchema.index({ chatId: 1, date: -1 });

// TTL: eliminar mensajes de más de 7 días para no acumular datos innecesarios
messageSchema.index({ date: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
