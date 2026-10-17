import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PHRASES } from "../src/data";
import { makeWord } from "../src/domain";
import { registerWordBank, findBankMeanings } from "../src/wordBank";
import {
  canFindExpressions,
  englishQuery,
  expressionMeanings,
  phraseMatchesQuery,
} from "../src/phraseSearch";

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

describe("direct expression search", () => {
  it("normalizes pasted English and accepts phrases without a Russian translation", () => {
    expect(englishQuery("  ＢＯＯＫ   in  ")).toBe("book in");
    for (const value of ["Dream", "check‑in", "one’s mind", "fall asleep", "I"])
      expect(canFindExpressions(value)).toBe(true);
    for (const value of ["", "книга", "<script>", 'book";', "x".repeat(101)])
      expect(canFindExpressions(value)).toBe(false);
  });
  it("matches complete English tokens, keywords, punctuation and Russian translations", () => {
    const phrase = {
      ...PHRASES[0],
      text: "learn by heart",
      keywords: ["heart"],
      translation: "учить наизусть",
    };
    expect(phraseMatchesQuery(phrase, " HEART ")).toBe(true);
    expect(phraseMatchesQuery(phrase, "art")).toBe(false);
    expect(phraseMatchesQuery(phrase, "learn by heart")).toBe(true);
    expect(phraseMatchesQuery(phrase, "наизусть")).toBe(true);
    expect(phraseMatchesQuery(phrase, "")).toBe(true);
    expect(
      phraseMatchesQuery({ ...phrase, text: "at one’s wit’s end" }, "one's"),
    ).toBe(true);
  });
  it("offers distinct dictionary meanings without adding anything to the personal collection", () => {
    const personal = [makeWord("book", "бронировать")];
    const snapshot = structuredClone(personal);
    const meanings = expressionMeanings(" BOOK ", personal);
    expect(meanings.some((word) => word.translation === "книга")).toBe(true);
    expect(
      meanings.filter((word) => word.translation === "бронировать"),
    ).toHaveLength(1);
    expect(meanings.every((word) => word.word === "book")).toBe(true);
    expect(personal).toEqual(snapshot);
    expect(expressionMeanings("qzxqzxqzx", personal)).toEqual([]);
  });
  it("does not let consumers mutate the spelling index by editing its result array", () => {
    const meanings = findBankMeanings("book");
    const count = meanings.length;
    expect(count).toBeGreaterThan(0);
    meanings.length = 0;
    expect(findBankMeanings("book")).toHaveLength(count);
  });
});
