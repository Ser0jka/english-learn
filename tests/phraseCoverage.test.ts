import { describe, expect, it } from "vitest";
import { STARTER_PHRASES } from "../src/starterPhrases";
import {
  createBackup,
  emptyStore,
  parseBackup,
  validPhrase,
  validPhraseExamples,
  validateStore,
} from "../src/domain";
import { freshPhraseSearch, phraseMatchesQuery } from "../src/phraseSearch";
import { phraseOccurs } from "../book-contexts.mjs";
import { contextSignature } from "../src/bookLibrary";

describe("expression coverage and saved examples", () => {
  it.each(["easy", "complete"])(
    "has twelve complete offline entries for %s",
    (word) => {
      const phrases = STARTER_PHRASES.filter((phrase) =>
        phraseMatchesQuery(phrase, word),
      );
      expect(phrases).toHaveLength(12);
      expect(new Set(phrases.map((phrase) => phrase.text)).size).toBe(12);
      expect(phrases.every(validPhrase)).toBe(true);
      for (const phrase of phrases) {
        expect(phrase.generated).toBeUndefined();
        expect(phrase.examples).toHaveLength(2);
        expect(
          phrase.examples!.every((example) =>
            phraseOccurs(phrase.text, example.text),
          ),
        ).toBe(true);
      }
    },
  );
  it("keeps supplementary examples and search freshness across a backup without changing progress", () => {
    const phrase = STARTER_PHRASES[0];
    const store = {
      ...emptyStore(),
      phraseExamples: {
        [phrase.id]: {
          signature: contextSignature(phrase),
          examples: phrase.examples!,
        },
      },
      phraseSearches: { '["easy",""]': { at: 1000 } },
    };
    expect(parseBackup(createBackup(store))).toEqual(store);
    expect(store.logs).toEqual([]);
    expect(store.phraseIds).toEqual([]);
  });
  it("rejects malformed or excessive example data without accepting executable content structures", () => {
    for (const examples of [
      [],
      Array(4).fill({ text: "English", translation: "Русский" }),
      [{ text: "x".repeat(1501), translation: "Перевод" }],
      [{ text: "Example", translation: 42 }],
    ]) {
      expect(validPhraseExamples(examples)).toBe(false);
      expect(() =>
        validateStore({
          ...emptyStore(),
          phraseExamples: { id: { signature: "x", examples } },
        }),
      ).toThrow();
    }
  });
  it("expires top-up suppression and rejects implausible future clocks", () => {
    const now = 10 * 3600000;
    expect(freshPhraseSearch(undefined, now)).toBe(false);
    expect(freshPhraseSearch(now, now)).toBe(true);
    expect(freshPhraseSearch(now - 6 * 3600000, now)).toBe(false);
    expect(freshPhraseSearch(now + 3600000, now)).toBe(false);
  });
  it("matches inflection and possessives without matching another word or crossing sentence boundaries", () => {
    expect(
      phraseOccurs("take your time", "Take your time before deciding."),
    ).toBe(true);
    expect(phraseOccurs("give up", "She gave up smoking.")).toBe(true);
    expect(
      phraseOccurs("to build resilience", "Building resilience takes time."),
    ).toBe(true);
    expect(phraseOccurs("lose one's temper", "He lost his temper.")).toBe(true);
    expect(phraseOccurs("art", "We learn about the heart.")).toBe(false);
    expect(
      phraseOccurs(
        "complete silence",
        "The task is complete. Silence followed.",
      ),
    ).toBe(false);
  });
});
