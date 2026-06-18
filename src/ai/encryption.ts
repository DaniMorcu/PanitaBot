import { randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Deriva una clave AES-256 a partir de la clave maestra usando scrypt.
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

/**
 * Cifra un texto con AES-256-GCM usando la clave maestra del entorno.
 * Formato de salida: salt(hex):iv(hex):tag(hex):ciphertext(hex)
 */
export function encrypt(plainText: string, masterKey: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(masterKey, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return [
    salt.toString("hex"),
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted,
  ].join(":");
}

/**
 * Descifra un texto cifrado con AES-256-GCM.
 */
export function decrypt(encryptedText: string, masterKey: string): string {
  const [saltHex, ivHex, tagHex, ciphertext] = encryptedText.split(":");

  if (!saltHex || !ivHex || !tagHex || !ciphertext) {
    throw new Error("Formato de texto cifrado inválido");
  }

  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const key = deriveKey(masterKey, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Hashea una contraseña de admin con scrypt + salt.
 * Formato: salt(hex):hash(hex)
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verifica una contraseña contra su hash (timing-safe).
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const hash = scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(hashHex, "hex");

  if (hash.length !== storedHashBuffer.length) return false;
  return timingSafeEqual(hash, storedHashBuffer);
}
