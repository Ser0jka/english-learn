import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG, PHRASES, PASSAGES } from "../src/data";
import {
  createBackup,
  emptyStore,
  loadStore,
  makeWord,
  parseBackup,
  parseImport,
  queueFor,
  removeWord,
  reviewWord,
  saveStore,
  STORAGE_KEY,
  validateStore,
  validPassage,
  validPhrase,
  validWord,
} from "../src/domain";
import { materialRequest } from "../src/useMaterials";
afterEach(() => vi.unstubAllGlobals());
describe("import integrity", () => {
  it.each(["constructor", "toString", "__proto__"])(
    "rejects prototype-derived statuses: %s",
    (status) =>
      expect(() =>
        parseImport(JSON.stringify([{ word: "hello", status }])),
      ).toThrow(/статус/),
  );
  it("preserves the actual English word word, with or without translation", () => {
    expect(parseImport("word\nforest").map((w) => w.word)).toEqual([
      "word",
      "forest",
    ]);
    expect(parseImport("word;слово\nforest;лес")[0]).toMatchObject({
      word: "word",
      translation: "слово",
    });
  });
  it("detects delimiters outside quoted translations", () => {
    expect(parseImport('forest,"лес; роща",learned')[0]).toMatchObject({
      word: "forest",
      translation: "лес; роща",
      status: "learned",
    });
  });
  it.each(['""', ";;;", "\t\t", "[null]", '{"words":null}'])(
    "reports invalid empty or malformed input: %s",
    (input) => expect(() => parseImport(input)).toThrow(),
  );
  it("validates the complete built-in curriculum", () => {
    expect(CATALOG.every(validWord)).toBe(true);
    expect(PHRASES.every(validPhrase)).toBe(true);
    expect(PASSAGES.every(validPassage)).toBe(true);
  });
});
describe("progress persistence and recovery", () => {
  it("round-trips the full workspace, including logs, stable word IDs, interests and saved materials", () => {
    const s = emptyStore();
    s.words[0] = reviewWord(s.words[0], true, 1000);
    s.logs = [{ at: 1000, wordId: s.words[0].id, correct: true }];
    s.phraseIds = [PHRASES[0].id];
    s.customPhrases = [{ ...PHRASES[0], id: "custom-test" }];
    s.customPassages = [{ ...PASSAGES[0], id: "custom-reading" }];
    s.interests = ["travel"];
    expect(parseBackup(createBackup(s))).toEqual(s);
  });
  it("loads the previous storage schema without losing progress", () => {
    const {
      customPhrases: _phrases,
      customPassages: _passages,
      ...legacy
    } = emptyStore();
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(legacy) });
    const result = loadStore();
    expect(result.error).toBe("");
    expect(result.state.words).toEqual(legacy.words);
    expect(result.state.customPhrases).toEqual([]);
  });
  it("does not overwrite corrupt saved data when loading", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => "{broken", setItem });
    expect(loadStore().error).toContain("не перезаписаны");
    expect(setItem).not.toHaveBeenCalled();
  });
  it("persists actual answers and reloads the same review schedule", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const s = emptyStore();
    s.words[0] = reviewWord(s.words[0], false, 1000);
    s.logs.push({ at: 1000, wordId: s.words[0].id, correct: false });
    saveStore(s);
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(loadStore().state).toEqual(s);
  });
  it("surfaces quota failures and keeps an export available", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    });
    const s = emptyStore();
    expect(() => saveStore(s)).toThrow();
    expect(parseBackup(createBackup(s))).toEqual(s);
  });
  it("rejects duplicate IDs and malformed supplemental content instead of silently dropping it", () => {
    const s = emptyStore();
    s.words[1].id = s.words[0].id;
    expect(() => validateStore(s)).toThrow();
    expect(() =>
      validateStore({ ...emptyStore(), customPassages: [{ id: "broken" }] }),
    ).toThrow();
  });
  it("rejects unsafe source URLs and malformed citations", () => {
    expect(
      validPhrase({
        ...PHRASES[0],
        source: { label: "bad", url: "javascript:alert(1)" },
      }),
    ).toBe(false);
    expect(validPhrase({ ...PHRASES[0], quote: { text: "bad" } })).toBe(false);
  });
  it("keeps expired learning retries in the review queue", () => {
    const failed = reviewWord(
      { ...CATALOG[0], status: "learned", successes: 3 },
      false,
      1000,
    );
    expect(queueFor([failed], "review", [], 1000 + 299999)).toEqual([]);
    expect(queueFor([failed], "review", [], 1000 + 300000)).toEqual([failed]);
  });
  it("removes phrase selections when their dictionary entry is deleted, preserving unrelated history", () => {
    const s = emptyStore(),
      word = makeWord(PHRASES[0].text, PHRASES[0].translation);
    s.words.push(word);
    s.phraseIds = [PHRASES[0].id, PHRASES[1].id];
    s.logs = [{ at: 1000, wordId: word.id, correct: true }];
    const next = removeWord(s, word.id);
    expect(next.phraseIds).toEqual([PHRASES[1].id]);
    expect(next.logs).toEqual(s.logs);
    expect(next.words.some((w) => w.id === word.id)).toBe(false);
  });
});
describe("material service failures", () => {
  it("converts offline failures into actionable Russian feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(materialRequest("phrases", { word: "book" })).rejects.toThrow(
      "Не удалось связаться с сервером",
    );
  });
  it("rejects HTML and incomplete responses instead of rendering undefined content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Unavailable</html>")),
    );
    await expect(materialRequest("reading", {})).rejects.toThrow(
      "некорректный ответ",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(null)),
    );
    await expect(materialRequest("reading", {})).rejects.toThrow(
      "неполный материал",
    );
  });
  it("preserves a useful server error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Слишком много запросов" }, { status: 429 }),
      ),
    );
    await expect(materialRequest("image", {})).rejects.toThrow(
      "Слишком много запросов",
    );
  });
});
