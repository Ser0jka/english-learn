import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { registerAi } from "../ai.mjs";

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
