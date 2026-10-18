import { createServerFn } from "@tanstack/react-start";
import { OUTPUT_LANGS, type OutputLang } from "./user-prefs";

export const translateText = createServerFn({ method: "POST" })
  .validator((input: { text?: string; lang?: string }) => {
    const lang = OUTPUT_LANGS.some((item) => item.id === input.lang) ? (input.lang as OutputLang) : "ko";
    const text = String(input.text ?? "").slice(0, 12000);
    return { text, lang };
  })
  .handler(async ({ data }) => {
    const { runTranslate } = await import("./translate.server");
    return runTranslate(data.text, data.lang);
  });
