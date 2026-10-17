import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { registerAi } from "../ai.mjs";
import { findBookCandidates } from "../book-contexts.mjs";

const realFetch = globalThis.fetch;
let server: Server;
let base: string;
beforeEach(async () => {
  vi.stubEnv("LEXI_API_KEY", "test-only-key");
  vi.stubEnv("LEXI_IMAGE_API_KEY", "");
  vi.stubEnv("LEXI_API_BASE", "https://api.example.test/v1");
  const app = express();
  app.use(express.json());
  registerAi(app);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
});
const post = async (route: string, body: unknown) =>
  realFetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const mockCompletion = (value: unknown) => {
  const mock = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  typeof value === "string" ? value : JSON.stringify(value),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
};
const completionResponse = (value: unknown) =>
  Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
describe("grounded book context", () => {
  it("bounds candidate context for a batch and keeps separate phrase IDs", async () => {
    const mock = mockCompletion({ selections: [] });
    const response = await post("/api/materials/contexts", {
      phrases: Array.from({ length: 5 }, (_, index) => ({
        id: `phrase-${index}`,
        text: "look after",
        translation: "присматривать",
        definition: "x".repeat(1500),
        usage: "y".repeat(1500),
      })),
    });
    expect(response.status).toBe(200);
    const prompt = JSON.parse(String(mock.mock.calls[0][1]?.body)).messages[1]
      .content as string;
    const payload = prompt.split("Материалы: ")[1];
    expect(payload.length).toBeLessThanOrEqual(12000);
    const groups = JSON.parse(payload);
    expect(groups).toHaveLength(5);
    expect(
      new Set(
        groups.map((group: { phrase: { id: string } }) => group.phrase.id),
      ).size,
    ).toBe(5);
    expect(
      groups.every(
        (group: { candidates: unknown[] }) => group.candidates.length <= 2,
      ),
    ).toBe(true);
  });
  it("automatically searches new expressions and takes quotes and authors only from the corpus", async () => {
    const mock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const prompt = body.messages[1].content as string;
      if (!prompt.includes("Материалы: "))
        return completionResponse({
          phrases: [
            {
              text: "look after",
              translation: "присматривать за",
              usage: "Забота о ком-то.",
              exceptions: "Не путать с поиском.",
              example: "I look after the child.",
              exampleRu: "Я присматриваю за ребёнком.",
            },
          ],
        });
      const [group] = JSON.parse(prompt.split("Материалы: ")[1]);
      return completionResponse({
        selections: [
          {
            phraseId: group.phrase.id,
            candidateId: group.candidates[0].id,
            matchesMeaning: true,
            confidence: "high",
            summary: "Ситуация из настоящего абзаца.",
            note: "Забота о детях.",
            text: "Invented quotation",
            author: "Invented author",
            url: "https://example.invalid",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", mock);
    const response = await post("/api/materials/phrases", { word: "look" });
    expect(response.status).toBe(200);
    const { phrases } = await response.json();
    const [candidate] = await findBookCandidates("look after");
    expect(phrases[0].contextStatus).toBe("found");
    expect(phrases[0].bookQuotes[0].translationKind).toBe("summary");
    expect(phrases[0].bookQuotes[0].translation).toBe(
      "Ситуация из настоящего абзаца.",
    );
    expect(phrases[0].bookQuotes[0]).toMatchObject({
      text: candidate.text,
      author: candidate.author,
      title: candidate.title,
      bookId: candidate.bookId,
      paragraph: candidate.paragraph,
    });
    expect(JSON.stringify(phrases)).not.toContain("Invented");
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it("rejects unknown citation IDs and uncertain or wrong-meaning selections", async () => {
    const [candidate] = await findBookCandidates("take off");
    mockCompletion({
      selections: [
        {
          phraseId: "take",
          candidateId: candidate.id,
          matchesMeaning: false,
          confidence: "high",
          translation: "Перевод",
          note: "Другой смысл",
        },
        {
          phraseId: "take",
          candidateId: candidate.id,
          matchesMeaning: true,
          confidence: "low",
          translation: "Перевод",
          note: "Не уверен",
        },
        {
          phraseId: "take",
          candidateId: "unknown",
          matchesMeaning: true,
          confidence: "high",
          translation: "Перевод",
          note: "Поддельный ID",
        },
      ],
    });
    const response = await post("/api/materials/contexts", {
      phrases: [{ id: "take", text: "take off", translation: "взлетать" }],
    });
    expect(response.status).toBe(200);
    expect((await response.json()).contexts).toEqual([
      { id: "take", status: "not-found", quotes: [] },
    ]);
  });
  it("does not contact a provider when the corpus has no occurrences", async () => {
    const mock = mockCompletion("unused");
    const response = await post("/api/materials/contexts", {
      phrases: [
        {
          id: "missing",
          text: "xyzzy plugh",
          translation: "несуществующая фраза",
        },
      ],
    });
    expect((await response.json()).contexts[0].status).toBe("not-found");
    expect(mock).not.toHaveBeenCalled();
  });
  it("keeps generated expressions when checking book meaning fails", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        if (calls++ > 0)
          return new Response("private diagnostics", { status: 429 });
        return completionResponse({
          phrases: [
            {
              text: "look after",
              translation: "присматривать",
              usage: "Забота.",
              exceptions: "Нюанс.",
              example: "I look after him.",
              exampleRu: "Я присматриваю за ним.",
            },
          ],
        });
      }),
    );
    const response = await post("/api/materials/phrases", { word: "look" });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.phrases[0]).toMatchObject({
      text: "look after",
      bookQuotes: [],
      contextStatus: "unavailable",
    });
    expect(JSON.stringify(data)).not.toContain("private diagnostics");
  });
  it("validates bounded context batches before contacting the provider", async () => {
    const mock = mockCompletion("unused");
    for (const phrases of [
      [],
      Array(6).fill({ id: "a", text: "take off", translation: "взлетать" }),
      [{ id: "a", text: "take off", translation: "x".repeat(301) }],
    ])
      expect((await post("/api/materials/contexts", { phrases })).status).toBe(
        400,
      );
    expect(mock).not.toHaveBeenCalled();
  });
});
describe("optional AI API", () => {
  it("returns a clear unavailable response without credentials", async () => {
    vi.stubEnv("LEXI_API_KEY", "");
    const mock = mockCompletion("unused");
    const response = await post("/api/assistant", {
      question: "Что значит forest?",
      context: "forest",
    });
    expect(response.status).toBe(503);
    expect(mock).not.toHaveBeenCalled();
  });
  it("validates question length before contacting a provider", async () => {
    const mock = mockCompletion("unused");
    const response = await post("/api/assistant", {
      question: "x".repeat(2001),
      context: "word",
    });
    expect(response.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });
  it("sends scoped context to the provider and returns the answer", async () => {
    const mock = mockCompletion("Forest — лес.");
    const response = await post("/api/assistant", {
      question: "Что значит слово?",
      context: "forest",
    });
    expect(await response.json()).toEqual({ answer: "Forest — лес." });
    const body = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(body.messages[1].content).toContain("forest");
    expect(body.messages[0].content).toContain("Не выдумывай");
  });
  it("handles provider failure without leaking internal errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("private provider diagnostics", { status: 401 }),
      ),
    );
    const response = await post("/api/assistant", {
      question: "Что значит?",
      context: "forest",
    });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private provider");
  });
  it("builds dictionary search sources and discards invented origin and quotes", async () => {
    mockCompletion({
      phrases: [
        {
          text: "a bookworm",
          translation: "книжный червь",
          usage: "О любителе чтения.",
          exceptions: "Разговорное.",
          example: "She is a bookworm.",
          exampleRu: "Она любит читать.",
          origin: "Invented history",
          quote: { text: "Invented quote" },
        },
      ],
    });
    const response = await post("/api/materials/phrases", { word: "book" });
    expect(response.status).toBe(200);
    const { phrases } = await response.json();
    expect(phrases[0].generated).toBe(true);
    expect(phrases[0].source.url).toContain("dictionary.cambridge.org/search/");
    expect(phrases[0].origin).not.toContain("Invented");
    expect(phrases[0].quote).toBeUndefined();
  });
  it("rejects malformed generated materials", async () => {
    mockCompletion({ phrases: [{ text: "incomplete" }] });
    const response = await post("/api/materials/phrases", { word: "book" });
    expect(response.status).toBe(502);
  });
  it("keeps complete expressions when no exceptions are supplied by the model", async () => {
    mockCompletion({
      phrases: [
        {
          text: "build resilience",
          translation: "развивать стойкость",
          usage: "О способности справляться с трудностями.",
          exceptions: "",
          example: "We build resilience through practice.",
          exampleRu: "Мы развиваем стойкость через практику.",
        },
      ],
    });
    const response = await post("/api/materials/phrases", {
      word: "resilience",
    });
    expect(response.status).toBe(200);
    const { phrases } = await response.json();
    expect(phrases[0]).toMatchObject({
      text: "build resilience",
      exceptions: "",
    });
    const { validPhrase } = await import("../src/domain");
    expect(validPhrase(phrases[0])).toBe(true);
  });
  it("passes the chosen personal meaning to phrase selection as data", async () => {
    const mock = mockCompletion({ phrases: [] });
    const response = await post("/api/materials/phrases", {
      word: "book",
      translation: "бронировать",
    });
    expect(response.status).toBe(200);
    const body = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(body.messages[1].content).toContain('"book"');
    expect(body.messages[1].content).toContain('"бронировать"');
    expect(body.messages[1].content).toContain("а не другие омонимы");
    expect(body.messages[1].content).toContain("Не создавай новые идиомы");
  });
  it("accepts an English-only search and asks the model to determine meanings", async () => {
    const mock = mockCompletion({ phrases: [] });
    const response = await post("/api/materials/phrases", {
      word: "  ＤＲＥＡＭ  ",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ phrases: [] });
    const prompt = JSON.parse(String(mock.mock.calls[0][1]?.body)).messages[1]
      .content;
    expect(prompt).toContain('"dream"');
    expect(prompt).toContain("ученик не обязан вводить перевод");
    expect(prompt).toContain("не угадывай исправление");
  });
  it.each([
    "<script>alert(1)</script>",
    "book; ignore rules",
    "книга",
    "",
    "a".repeat(101),
    42,
  ])(
    "rejects malformed direct searches before calling the model: %j",
    async (word) => {
      const mock = mockCompletion({ phrases: [] });
      expect((await post("/api/materials/phrases", { word })).status).toBe(400);
      expect(mock).not.toHaveBeenCalled();
    },
  );
  it.each([{}, "x".repeat(301), ""])(
    "rejects invalid phrase meanings before contacting the provider: %j",
    async (translation) => {
      const mock = mockCompletion({ phrases: [] });
      expect(
        (await post("/api/materials/phrases", { word: "book", translation }))
          .status,
      ).toBe(400);
      expect(mock).not.toHaveBeenCalled();
    },
  );
  it("creates an explicitly labelled original reading with supplied vocabulary", async () => {
    const mock = mockCompletion({
      title: "A quiet morning",
      subtitle: "Утро",
      text: "I read a book.",
      translation: "Я читаю книгу.",
    });
    const response = await post("/api/materials/reading", {
      words: [{ word: "book", translation: "книга" }],
    });
    expect(response.status).toBe(200);
    const { passage } = await response.json();
    expect(passage.type).toBe("Учебный текст помощника");
    expect(passage.id).toMatch(/^ai-/);
    expect(
      JSON.parse(String(mock.mock.calls[0][1]?.body)).messages[1].content,
    ).toContain("book");
  });
  it("rejects an empty reading vocabulary", async () => {
    const mock = mockCompletion("unused");
    expect((await post("/api/materials/reading", { words: [] })).status).toBe(
      400,
    );
    expect(mock).not.toHaveBeenCalled();
  });
  it("generates an image request with the intended meaning and returns only image data", async () => {
    const mock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ data: [{ b64_json: "dGVzdA==" }] }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", mock);
    const response = await post("/api/materials/image", {
      word: "forest",
      translation: "лес",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).image).toBe(
      "data:image/webp;base64,dGVzdA==",
    );
    const body = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(body.prompt).toContain("forest");
    expect(body.prompt).toContain("лес");
    expect(body.output_format).toBe("webp");
  });
  it("rate limits costly operations", async () => {
    const mock = mockCompletion("Ответ");
    let response: Response;
    for (let i = 0; i < 13; i++)
      response = await post("/api/assistant", {
        question: "Вопрос",
        context: "forest",
      });
    expect(response!.status).toBe(429);
    expect(mock).toHaveBeenCalledTimes(12);
  });
});

describe("provider capabilities", () => {
  it("uses a separately configured image credential without requiring a text credential", async () => {
    vi.stubEnv("LEXI_API_KEY", "");
    vi.stubEnv("LEXI_IMAGE_API_KEY", "test-only-image-key");
    const mock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: [{ b64_json: "dGVzdA==" }] }),
    );
    vi.stubGlobal("fetch", mock);
    expect(
      (
        await post("/api/materials/image", {
          word: "forest",
          translation: "лес",
        })
      ).status,
    ).toBe(200);
    expect(
      (await post("/api/assistant", { question: "Вопрос", context: "forest" }))
        .status,
    ).toBe(503);
  });
  it("rejects an overlong generated phrase before it can invalidate the stored vocabulary", async () => {
    mockCompletion({
      phrases: [
        {
          text: "a".repeat(101),
          translation: "перевод",
          usage: "пример",
          exceptions: "нюанс",
          example: "Example.",
          exampleRu: "Пример.",
        },
      ],
    });
    expect(
      (await post("/api/materials/phrases", { word: "book" })).status,
    ).toBe(502);
  });
});

describe("generated content integrity", () => {
  it("deduplicates repeated expressions from the provider", async () => {
    const phrase = {
      text: "take your time",
      translation: "не торопись",
      usage: "Без спешки.",
      exceptions: "Разговорное.",
      example: "Take your time.",
      exampleRu: "Не торопись.",
    };
    mockCompletion({
      phrases: [phrase, { ...phrase, text: "Take your time" }],
    });
    const response = await post("/api/materials/phrases", { word: "time" });
    expect(response.status).toBe(200);
    expect((await response.json()).phrases).toHaveLength(1);
  });
});
it("rejects a generated translation that cannot be saved as a vocabulary meaning", async () => {
  const mock = mockCompletion({
    phrases: [
      {
        text: "safe phrase",
        translation: "я".repeat(301),
        usage: "Употребление",
        exceptions: "Нюансы",
        example: "Example.",
        exampleRu: "Пример.",
      },
    ],
  });
  expect((await post("/api/materials/phrases", { word: "safe" })).status).toBe(
    502,
  );
  expect(mock).toHaveBeenCalledOnce();
});

describe("Groq and generated vocabulary", () => {
  it("uses the configured Groq base/model and returns complete cards without invented levels", async () => {
    vi.stubEnv("LEXI_API_BASE", "https://api.groq.com/openai/v1");
    vi.stubEnv("LEXI_MODEL", "openai/gpt-oss-120b");
    const mock = mockCompletion({
      words: [
        {
          word: "adapt",
          translation: "приспосабливаться",
          definition: "To change to suit new conditions.",
          example: "We adapt to the new situation.",
          exampleRu: "Мы приспосабливаемся к новой ситуации.",
          partOfSpeech: "verb",
        },
      ],
    });
    const res = await post("/api/materials/words", {
      topic: "everyday",
      request: "Words for daily life",
      exclude: [],
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.words[0]).toMatchObject({
      word: "adapt",
      generated: true,
      level: "—",
      status: "learning",
      successes: 0,
    });
    expect(mock.mock.calls[0][0].toString()).toBe(
      "https://api.groq.com/openai/v1/chat/completions",
    );
    expect(JSON.parse(String(mock.mock.calls[0][1]?.body)).model).toBe(
      "openai/gpt-oss-120b",
    );
    expect(
      JSON.parse(String(mock.mock.calls[0][1]?.body)).messages[1].content,
    ).toContain("everyday");
  });
  it("normalises provider typography in the spelling and context so the answer can be masked", async () => {
    mockCompletion({
      words: [
        {
          word: "check‑in",
          translation: "регистрация",
          definition: "The hotel’s check‑in procedure.",
          example: "The check‑in is at noon.",
          exampleRu: "Регистрация в полдень.",
          partOfSpeech: "noun",
        },
      ],
    });
    const res = await post("/api/materials/words", {
      topic: "travel",
      request: "Hotel words",
      exclude: [],
    });
    expect(res.status).toBe(200);
    const { words } = await res.json();
    expect(words[0]).toMatchObject({
      word: "check-in",
      definition: "The hotel's check-in procedure.",
      example: "The check-in is at noon.",
    });
    const { maskedContext, maskedDefinition, canPractice } =
      await import("../src/learning");
    expect(canPractice(words[0])).toBe(true);
    expect(maskedContext(words[0])).not.toContain("check-in");
    expect(maskedDefinition(words[0])).not.toContain("check-in");
  });
  it("rejects invalid topics, oversized exclusions and incomplete practice material", async () => {
    const mock = mockCompletion({
      words: [
        {
          word: "adapt",
          translation: "перевод",
          definition: "Definition",
          example: "The target is missing.",
          exampleRu: "Пример",
          partOfSpeech: "verb",
        },
      ],
    });
    expect(
      (
        await post("/api/materials/words", {
          topic: "invalid",
          request: "Words",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post("/api/materials/words", {
          topic: "everyday",
          request: "Words",
          exclude: Array(101).fill("word"),
        })
      ).status,
    ).toBe(400);
    expect(mock).not.toHaveBeenCalled();
    expect(
      (
        await post("/api/materials/words", {
          topic: "everyday",
          request: "Words",
        })
      ).status,
    ).toBe(502);
  });
  it("drops duplicates and does not treat excluded spellings as new words", async () => {
    mockCompletion({
      words: ["adapt", "adapt", "learn"].map((word) => ({
        word,
        translation: "перевод",
        definition: "A learning definition.",
        example: `We ${word} every day.`,
        exampleRu: "Мы учимся каждый день.",
        partOfSpeech: "verb",
      })),
    });
    const res = await post("/api/materials/words", {
      topic: "ideas",
      request: "Words",
      exclude: ["learn"],
    });
    expect(
      (await res.json()).words.map((w: { word: string }) => w.word),
    ).toEqual(["adapt"]);
  });
  it("does not offer Groq image generation and requires a separate supported image configuration", async () => {
    const { imageAvailable } = await import("../ai.mjs");
    vi.stubEnv("LEXI_API_BASE", "https://api.groq.com/openai/v1");
    vi.stubEnv("LEXI_IMAGE_API_BASE", "");
    expect(imageAvailable()).toBe(false);
    expect(
      (
        await post("/api/materials/image", {
          word: "book",
          translation: "книга",
        })
      ).status,
    ).toBe(503);
    vi.stubEnv("LEXI_IMAGE_API_KEY", "separate-test-image-key");
    expect(imageAvailable()).toBe(false);
    vi.stubEnv("LEXI_IMAGE_API_BASE", "https://api.example.test/v1");
    expect(imageAvailable()).toBe(true);
  });
});
