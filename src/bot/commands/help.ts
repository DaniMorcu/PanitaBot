import type { Context } from "grammy";

/**
 * /ayuda - Muestra la lista de comandos disponibles.
 */
export async function helpCommand(ctx: Context): Promise<void> {
  const helpText = [
    "*El Panita - Manual pa' los que no saben leer*",
    "",
    "*Pa' todo el mundo (sí, incluso tú):*",
    "`/oye <pregunta>` - Pregúntame algo, a ver si te ilumino",
    "`/resumen` - Te cuento el chisme que te perdiste por vago",
    "`/ayuda` - Esto que estás leyendo, Einstein",
    "",
    "*Pa' los jefes (admins, los que mandan aquí):*",
    "`/config` - Ver cómo está el rancho",
    "`/modelo <gemini|grok|openai|claude>` - Cambiar el cerebro",
    "`/tokens <N>` - Cuánto me dejas hablar (100-8192)",
    "`/cuantos <N>` - Tope de mensajes pa'l resumen (10-200)",
    "`/calla` - Me callo el hocico",
    "`/habla` - Me devuelves la palabra",
    "`/clave <provider> <key>` - Poner API key (gemini/grok/openai)",
    "`/sinllave [provider]` - Quitar API key (o todas si no dices cuál)",
    "",
    "*Pa' el dueño del rancho (el que creó el grupo):*",
    "`/candado <contraseña>` - Poner clave de admin pa' que no toquen nada",
    "`/sincandado` - Quitar clave de admin (vivir peligrosamente)",
    "",
    "*Tips del Panita (léelos o sufre):*",
    "- Responde a un mensaje con /oye pa' darme contexto específico",
    "- /resumen te muestra lo que te perdiste desde tu última actividad",
    "- Cada grupo puede tener API keys de distintos providers a la vez",
    "- Modelos: gemini (gratis), grok ($25/mes free), openai (de pago)",
    "- Si pones /candado, los comandos admin se verifican por DM. Dictadura.",
    "- Los mensajes se borran solos después de 7 días. No soy tu archivo.",
  ].join("\n");

  await ctx.reply(helpText, { parse_mode: "Markdown" });
}
