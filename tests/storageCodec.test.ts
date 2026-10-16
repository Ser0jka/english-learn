import { beforeAll, afterEach, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { registerWordBank, WORD_BANK } from "../src/wordBank";
import { encodeStoredJson, decodeStoredJson } from "../src/storageCodec";
import {
  emptyStore,
  saveStore,
  loadStore,
  STORAGE_KEY,
  StorageConflictError,
} from "../src/domain";
beforeAll(() =>
  registerWordBank(
    JSON.parse(
      readFileSync(
        new URL("../src/generated/word-bank.json", import.meta.url),
        "utf8",
      ),
    ),
  ),
);
afterEach(() => vi.unstubAllGlobals());
it("keeps small existing saves readable as JSON", () => {
  const raw = JSON.stringify(emptyStore());
  expect(encodeStoredJson(raw)).toBe(raw);
  expect(decodeStoredJson(raw)).toBe(raw);
});
it("stores all 10,000 dictionary meanings within a 5 MiB Web Storage budget and restores every field", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length * 2 > 5 * 1024 * 1024)
        throw new DOMException("Full", "QuotaExceededError");
      values.set(k, v);
    },
  });
  const state = { ...emptyStore(), words: WORD_BANK };
  const raw = saveStore(state);
  expect(raw.startsWith("lexi-z1:")).toBe(true);
  expect(raw.length * 2).toBeLessThan(5 * 1024 * 1024);
  expect(loadStore().state).toEqual(state);
  expect(saveStore(state, raw)).toBe(raw);
  const newest = saveStore({ ...state, dailyGoal: 5 }, raw);
  expect(() => saveStore(state, raw)).toThrow(StorageConflictError);
  expect(values.get(STORAGE_KEY)).toBe(newest);
}, 20000);
it("preserves long Unicode content and detects truncated or oversized compressed data", () => {
  const raw = JSON.stringify({ text: '漢😀Русский "\\\n'.repeat(100000) });
  const encoded = encodeStoredJson(raw);
  expect(decodeStoredJson(encoded)).toBe(raw);
  expect(() => decodeStoredJson(encoded.slice(0, -1))).toThrow();
  expect(() => decodeStoredJson("lexi-z1:999999999:999999999:")).toThrow();
  expect(() => decodeStoredJson("lexi-z1:not-a-header")).toThrow();
}, 20000);
