import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG, PHRASES, PASSAGES } from "../src/data";
import {
  emptyStore,
  mergeWords,
  createBackup,
  parseBackup,
  saveStore,
  loadStore,
  STORAGE_KEY,
  StorageConflictError,
  validateStore,
} from "../src/domain";
import { serializeHelpContext } from "../src/useMaterials";
afterEach(() => vi.unstubAllGlobals());
describe("data integrity audit", () => {
  it("regenerates colliding incoming IDs without changing an existing meaning or incoming data", () => {
    const old = { ...CATALOG[0] };
    const incoming = { ...CATALOG[1], id: old.id };
    const merged = mergeWords([old], [incoming, { ...CATALOG[2], id: old.id }]);
    expect(new Set(merged.words.map((w) => w.id)).size).toBe(3);
    expect(merged.words[0]).toBe(old);
    expect(incoming.id).toBe(old.id);
    expect(
      parseBackup(createBackup({ ...emptyStore(), words: merged.words }))
        ?.words,
    ).toEqual(merged.words);
  });
  it("bounds derived phrase IDs when an imported material already has a maximum-length ID", () => {
    const phraseId = "p".repeat(200);
    const incoming = { ...CATALOG[0], id: `phrase-${phraseId}` };
    const result = mergeWords([], [incoming]);
    expect(result.words[0].id.length).toBeLessThanOrEqual(200);
    expect(incoming.id).toBe(`phrase-${phraseId}`);
    expect(() =>
      validateStore({ ...emptyStore(), words: result.words }),
    ).not.toThrow();
  });
  it("refuses to overwrite a valid saved workspace with invalid state", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    const state = emptyStore();
    state.words[1].id = state.words[0].id;
    expect(() => saveStore(state)).toThrow();
    expect(setItem).not.toHaveBeenCalled();
  });
  it("detects a stale tab before writing and leaves the other tab's progress intact", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
    const s = emptyStore();
    const original = saveStore(s);
    expect(loadStore().raw).toBe(original);
    const latest = saveStore({ ...s, dailyGoal: 5 }, original);
    expect(() => saveStore({ ...s, dailyGoal: 20 }, original)).toThrow(
      StorageConflictError,
    );
    expect(values.get(STORAGE_KEY)).toBe(latest);
  });
  it("rejects supplemental IDs that shadow built-in material", () => {
    expect(() =>
      validateStore({ ...emptyStore(), customPhrases: [PHRASES[0]] }),
    ).toThrow();
    expect(() =>
      validateStore({ ...emptyStore(), customPassages: [PASSAGES[0]] }),
    ).toThrow();
  });
});
describe("assistant input budget", () => {
  it("respects the separate context character limit even when the HTTP body is small", () => {
    const text = "a".repeat(15000);
    const serialized = serializeHelpContext({ text }, "Why?");
    expect(serialized.length).toBeLessThanOrEqual(12000);
    const parsed = JSON.parse(serialized);
    expect(parsed.contextTruncated).toBe(true);
    expect(text.startsWith(parsed.text)).toBe(true);
  });
  it("omits private image payloads and preserves an ordinary context", () => {
    const word = { ...CATALOG[0], image: "data:image/webp;base64,private" };
    const context = JSON.parse(serializeHelpContext({ word }, "Объясни слово"));
    expect(context.word.image).toBeUndefined();
    expect(context.word.word).toBe("forest");
    expect(context.contextTruncated).toBeUndefined();
  });
  it("keeps JSON, Unicode and escaping within the actual server body limit", () => {
    const question = "漢".repeat(2000);
    const context = {
      word: {
        ...CATALOG[0],
        definition: '漢"\\'.repeat(4000),
        example: "я".repeat(4000),
      },
      text: '"漢\\'.repeat(7000),
    };
    const serialized = serializeHelpContext(context, question);
    expect(JSON.parse(serialized).contextTruncated).toBe(true);
    expect(serialized.length).toBeLessThanOrEqual(12000);
    expect(
      new TextEncoder().encode(
        JSON.stringify({ question, context: serialized }),
      ).length,
    ).toBeLessThanOrEqual(23000);
  });
});
it("generates unique UUIDs without relying on randomUUID on HTTP origins", async () => {
  const random = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal("crypto", { getRandomValues: random });
  const { newId } = await import("../src/id");
  const ids = Array.from({ length: 100 }, () => newId());
  expect(new Set(ids).size).toBe(100);
  for (const id of ids)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
});
