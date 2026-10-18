import { langLabel, type OutputLang } from "./user-prefs";

export async function runTranslate(text: string, lang: OutputLang) {
  const source = text.trim();
  if (!source) return { ok: false as const, error: "번역할 설명이 없습니다." };
  const apiKey = globalThis.process?.env?.XAI_API_KEY ?? "";
  if (!apiKey) return { ok: false as const, error: "번역을 이 환경에서 쓸 수 없습니다." };
  const name = langLabel(lang);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 4000,
        messages: [
          {
            role: "system",
            content: `아래 글만 ${name}로 번역한다. 화면에 있는 문장만 바꾸고, 없는 설명이나 가사를 뒤에 붙이지 마. 같은 구간을 두 번 쓰지 마. ━ 구분선, [Verse] 같은 표시, 줄바꿈, 이름, EP 번호, URL, 해시태그는 유지한다. 번역문만 출력한다.`,
          },
          { role: "user", content: source },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return { ok: false as const, error: "번역하지 못했습니다." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const out = String(body.choices?.[0]?.message?.content ?? "").trim();
    if (!out) return { ok: false as const, error: "번역이 비었습니다." };
    return { ok: true as const, text: out };
  } catch {
    return { ok: false as const, error: "번역하지 못했습니다." };
  }
}
