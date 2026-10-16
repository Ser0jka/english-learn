import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import manifest from "../public/data/books/manifest.json";
import catalog from "../scripts/book-sources/catalog.json";
import { findBookCandidates } from "../book-contexts.mjs";
import { contextSignature, locateBookParagraph } from "../src/bookLibrary";
import {
  createBackup,
  emptyStore,
  parseBackup,
  validPhrase,
  validPhraseQuote,
} from "../src/domain";
import { PHRASES } from "../src/data";
import { referenceAnswer } from "../src/components/Help";

it("ships ten complete books with matching source and reader checksums and preserved licences", () => {
  expect(manifest.books).toHaveLength(10);
  expect(new Set(manifest.books.map((book) => book.id)).size).toBe(10);
  let paragraphs = 0;
  for (const book of manifest.books) {
    const reader = readFileSync(
      new URL(`../public/data/books/${book.id}.json`, import.meta.url),
    );
    const raw = readFileSync(
      new URL(`../public/data/books/${book.id}.txt`, import.meta.url),
    );
    expect(createHash("sha256").update(reader).digest("hex")).toBe(book.sha256);
    expect(createHash("sha256").update(raw).digest("hex")).toBe(
      book.sourceSha256,
    );
    expect(book.sourceSha256).toBe(
      catalog.find((entry) => entry.id === book.id)?.sha256,
    );
    expect(raw.toString()).toMatch(
      /Project Gutenberg.*License|Project Gutenberg.*Licence/i,
    );
    const data = JSON.parse(reader.toString());
    expect(data.paragraphs).toHaveLength(book.paragraphs);
    expect(data.title).toBe(book.title);
    expect(data.author).toBe(book.author);
    paragraphs += book.paragraphs;
  }
  expect(paragraphs).toBeGreaterThan(15000);
});

it.each(["look after", "give up", "fall asleep", "take off", "at once"])(
  "returns verbatim, bounded, attributed passages for %s",
  async (phrase) => {
    const matches = await findBookCandidates(phrase);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(6);
    for (const match of matches) {
      const book = JSON.parse(
        readFileSync(
          new URL(`../public/data/books/${match.bookId}.json`, import.meta.url),
          "utf8",
        ),
      );
      expect(book.paragraphs[match.paragraph].text).toContain(match.text);
      expect(match.text).toContain(match.match);
      expect(match.title).toBe(book.title);
      expect(match.author).toBe(book.author);
      expect(match.url).toBe(book.source);
      expect(match.text.length).toBeLessThanOrEqual(1800);
    }
  },
);
it("finds inflections without accepting parts of words or crossing paragraph boundaries", async () => {
  expect(
    (await findBookCandidates("fall asleep")).some(
      (match) => match.match === "fell asleep",
    ),
  ).toBe(true);
  expect(await findBookCandidates("ook after")).toEqual([]);
  expect(await findBookCandidates("lookafter")).toEqual([]);
  expect(await findBookCandidates("x".repeat(101))).toEqual([]);
  expect(await findBookCandidates("a b c d e f g h i j k l m")).toEqual([]);
  expect(await findBookCandidates("xyzzy plugh")).toEqual([]);
});
it("relocates a saved excerpt after paragraph shifts and refuses a missing source passage", async () => {
  const [candidate] = await findBookCandidates("look after");
  const book = JSON.parse(
    readFileSync(
      new URL(`../public/data/books/${candidate.bookId}.json`, import.meta.url),
      "utf8",
    ),
  );
  expect(locateBookParagraph(book, 0, candidate.text)).toBe(
    candidate.paragraph,
  );
  expect(
    locateBookParagraph(
      book,
      candidate.paragraph,
      "invented quote which does not exist",
    ),
  ).toBe(-1);
  expect(locateBookParagraph(book, -1)).toBe(-1);
});
it("restores book locations and cached meanings without changing learning progress", async () => {
  const [candidate] = await findBookCandidates("look after");
  const quote = {
    ...candidate,
    translation: "Перевод отрывка.",
    note: "Забота о детях.",
  };
  const phrase = {
    ...PHRASES[0],
    text: "look after",
    translation: "присматривать",
    bookQuotes: [quote],
    contextStatus: "found" as const,
  };
  const store = {
    ...emptyStore(),
    bookContexts: {
      [phrase.id]: { signature: contextSignature(phrase), quotes: [quote] },
    },
  };
  expect(validPhrase(phrase)).toBe(true);
  expect(parseBackup(createBackup(store))).toEqual(store);
  expect(contextSignature(phrase)).not.toBe(
    contextSignature({ ...phrase, translation: "другой смысл" }),
  );
  expect(referenceAnswer({ phrase }, "Пример в контексте", true)).toContain(
    candidate.text,
  );
});
it.each([
  { bookId: "../../secret" },
  { paragraph: -1 },
  { paragraph: 0.5 },
  { paragraph: 100001 },
  { match: "not in source" },
  { translationKind: "invented" },
  { bookId: undefined },
])("rejects unsafe or inconsistent book metadata: %j", async (extra) => {
  const [candidate] = await findBookCandidates("look after");
  expect(
    validPhraseQuote({ ...candidate, translation: "Перевод", ...extra }),
  ).toBe(false);
});
