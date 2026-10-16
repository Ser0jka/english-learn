import { describe, expect, it } from "vitest";
import { PHRASES } from "../src/data";
import { SOURCED_PHRASE_EXAMPLES } from "../src/phraseContexts";
import {
  createBackup,
  emptyStore,
  parseBackup,
  validPhrase,
} from "../src/domain";
import { referenceAnswer } from "../src/components/Help";

const phrase = PHRASES.find((p) => p.id === "by-heart")!;
describe("attributed phrase contexts", () => {
  it("validates each curated excerpt with a title, author and HTTPS source", () => {
    for (const quote of Object.values(SOURCED_PHRASE_EXAMPLES)) {
      expect(validPhrase({ ...phrase, quote })).toBe(true);
      expect(quote.title).toBeTruthy();
      expect(quote.location).toBeTruthy();
      expect(quote.note).toBeTruthy();
    }
  });
  it("keeps legacy citations and expressions without an excerpt valid", () => {
    const {
      kind: _kind,
      title: _title,
      location: _location,
      note: _note,
      ...quote
    } = phrase.quote!;
    expect(validPhrase({ ...phrase, quote })).toBe(true);
    expect(validPhrase({ ...phrase, quote: undefined })).toBe(true);
  });
  it.each([
    { url: "javascript:alert(1)" },
    { url: "data:text/html,unsafe" },
    { kind: "invented" },
    { kind: {} },
    { title: 42 },
    { location: {} },
    { note: "x".repeat(1001) },
  ])("rejects malformed source metadata: %j", (extra) => {
    expect(
      validPhrase({ ...phrase, quote: { ...phrase.quote, ...extra } }),
    ).toBe(false);
  });
  it("round-trips source metadata through a complete progress backup", () => {
    const store = {
      ...emptyStore(),
      customPhrases: [{ ...phrase, id: "saved-citation" }],
    };
    const restored = parseBackup(createBackup(store));
    expect(restored?.customPhrases[0].quote).toEqual(phrase.quote);
  });
  it("uses a verified excerpt in help even when the dictionary has no separate example", () => {
    const answer = referenceAnswer(
      { phrase: { ...phrase, dictionary: true, example: "", exampleRu: "" } },
      "Пример в контексте",
      true,
    );
    expect(answer).toContain(phrase.quote!.text);
    expect(answer).toContain("Джейн Остин");
    expect(answer).toContain("Глава 37");
    expect(answer).toContain("Полный текст");
  });
});
