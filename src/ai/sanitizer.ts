/**
 * Sanitización de inputs para prevenir inyección de prompt.
 */

/** Longitud máxima de un prompt de /ask */
const MAX_PROMPT_LENGTH = 2000;

/** Longitud máxima de un mensaje de contexto individual */
const MAX_CONTEXT_MESSAGE_LENGTH = 500;

/**
 * Patrones de inyección de prompt conocidos (case-insensitive).
 * Neutraliza intentos de manipular las instrucciones del sistema.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // Instrucciones de override en español
  /ignora\s+(las\s+)?instrucciones\s+(anteriores|previas|del\s+sistema)/gi,
  /olvida\s+(tu\s+)?rol/gi,
  /olvida\s+todo\s+lo\s+anterior/gi,
  /cambia\s+(tu\s+)?(rol|personalidad|comportamiento)/gi,
  /actua\s+como\s+(si\s+fueras|un)/gi,
  /actúa\s+como\s+(si\s+fueras|un)/gi,
  /a\s+partir\s+de\s+ahora\s+(eres|serás|actúa)/gi,
  /nuevas?\s+instrucciones/gi,
  /modo\s+(desarrollador|DAN|jailbreak)/gi,

  // Instrucciones de override en inglés
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /forget\s+(your|all)\s+(instructions|rules|role)/gi,
  /you\s+are\s+now\s+a/gi,
  /act\s+as\s+(if\s+you\s+were|a)/gi,
  /new\s+instructions/gi,
  /system\s*prompt/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /developer\s+mode/gi,

  // Delimitadores que intentan escapar el contexto
  /^#{3,}\s*system/gim,
  /<\/?system>/gi,
  /<\/?instructions?>/gi,
  /\[SYSTEM\]/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
];

/**
 * Caracteres de control Unicode invisibles que pueden usarse para
 * ocultar instrucciones maliciosas.
 */
const INVISIBLE_CHARS =
  /[\u200B\u200C\u200D\u200E\u200F\u2028\u2029\u202A-\u202E\uFEFF\u00AD]/g;

/**
 * Sanitiza el input del usuario para /ask.
 * - Elimina caracteres invisibles
 * - Neutraliza patrones de inyección
 * - Trunca a la longitud máxima
 */
export function sanitizeUserInput(text: string): string {
  // Eliminar caracteres invisibles
  let sanitized = text.replace(INVISIBLE_CHARS, "");

  // Neutralizar patrones de inyección reemplazando con versión inofensiva
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[contenido filtrado]");
  }

  // Truncar
  if (sanitized.length > MAX_PROMPT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_PROMPT_LENGTH) + "...";
  }

  return sanitized.trim();
}

/**
 * Sanitiza los mensajes de contexto del grupo.
 * Aplica sanitización más ligera para no romper conversaciones legítimas,
 * pero elimina los vectores de ataque más evidentes.
 */
export function sanitizeContextMessages(messages: string[]): string[] {
  return messages.map((msg) => {
    let sanitized = msg.replace(INVISIBLE_CHARS, "");

    // Solo neutralizar los delimitadores y escapes de contexto más peligrosos
    sanitized = sanitized
      .replace(/<\/?system>/gi, "")
      .replace(/<\/?instructions?>/gi, "")
      .replace(/\[SYSTEM\]/gi, "")
      .replace(/\[INST\]/gi, "")
      .replace(/<<SYS>>/gi, "")
      .replace(/<\|im_start\|>/gi, "");

    // Truncar mensajes individuales excesivamente largos
    if (sanitized.length > MAX_CONTEXT_MESSAGE_LENGTH) {
      sanitized = sanitized.substring(0, MAX_CONTEXT_MESSAGE_LENGTH) + "...";
    }

    return sanitized;
  });
}
