import { describe, expect, it } from "vitest";
import { CATALOG, INITIAL_WORDS } from "../src/data";
import {
  makeWord,
  meaningKey,
  isCorrectAnswer,
  mergeWords,
  optionsFor,
  parseImport,
  queueFor,
  reviewWord,
  streak,
} from "../src/domain";
import { referenceAnswer } from "../src/components/Help";

const now = new Date("2026-10-16T12:00:00Z").getTime();
describe("vocabulary import and backup", () => {
  it("reads CSV headers, quoted commas, CRLF and statuses", () => {
    const words = parseImport(
      '\uFEFFword,translation,status\r\nforest,"лес, роща",learned\r\ncoffee,кофе,learning',
    );
    expect(words).toHaveLength(2);
    expect(words[0].translation).toBe("лес, роща");
    expect(words[0].status).toBe("learned");
    expect(words[1].concept).toBe("coffee");
  });
  it("reads semicolon-delimited Russian headers and statuses", () => {
    const words = parseImport("слово;перевод;статус\nforest;лес;выучил");
    expect(words[0].status).toBe("learned");
  });
  it("enriches known words and preserves unknown ones without inventing a translation", () => {
    const words = parseImport("forest\nephemeral");
    expect(words[0].translation).toBe("лес");
    expect(words[1].translation).toBe("");
    expect(words[1].concept).toBe("");
  });
  it("imports vocabulary and images without inventing review history; full backups use parseBackup", () => {
    const word = {
      ...INITIAL_WORDS[0],
      image: "data:image/png;base64,aGVsbG8=",
      dueAt: now,
      successes: 2,
    };
    const result = parseImport(
      JSON.stringify({ version: 1, words: [word] }),
    )[0];
    expect(result).toMatchObject({
      word: word.word,
      translation: word.translation,
      image: word.image,
      dueAt: 0,
      successes: 0,
    });
    expect(result.id).not.toBe(word.id);
  });
  it("skips duplicates case-insensitively, including within an import", () => {
    const result = mergeWords(
      [makeWord("Forest", "лес")],
      [
        makeWord(" FOREST ", "лес"),
        makeWord("ice", "лёд"),
        makeWord("Ice", "лёд"),
      ],
    );
    expect(result.added).toBe(1);
    expect(result.duplicates).toBe(2);
    expect(result.words).toHaveLength(2);
  });
  it.each([
    "",
    "word;translation\n",
    '[{"word":null}]',
    '[{"word":"forest","status":"oops"}]',
    'forest;"незакрытая кавычка',
    '{"hello":[]}',
  ])("rejects invalid input: %s", (input) =>
    expect(() => parseImport(input)).toThrow(),
  );
});
describe("practice and scheduling", () => {
  it("keeps learning and due review queues distinct", () => {
    const words = [
      { ...CATALOG[0], status: "learning" as const },
      { ...CATALOG[1], status: "learned" as const, dueAt: now - 1 },
      { ...CATALOG[2], status: "learned" as const, dueAt: now + 1 },
    ];
    expect(queueFor(words, "learn", [], now).map((w) => w.word)).toEqual([
      "forest",
    ]);
    expect(queueFor(words, "review", [], now).map((w) => w.word)).toEqual([
      "journey",
    ]);
  });
  it("suggests new words by topic without suggesting existing words", () => {
    const result = queueFor(INITIAL_WORDS, "new", ["ideas"], now);
    expect(result[0].topic).toBe("ideas");
    expect(
      result.some((w) =>
        INITIAL_WORDS.some((v) => meaningKey(v) === meaningKey(w)),
      ),
    ).toBe(false);
  });
  it("graduates after three consecutive correct answers and schedules the next review", () => {
    let w = { ...CATALOG[0] };
    let at = now;
    for (let i = 0; i < 3; i++) {
      w = reviewWord(w, true, at);
      at = w.dueAt;
    }
    expect(w.status).toBe("learned");
    expect(w.successes).toBe(3);
    expect(w.dueAt).toBe(now + (1 + 3 + 7) * 86400000);
  });
  it("returns a missed learned word to learning and schedules a short retry", () => {
    const result = reviewWord(
      { ...CATALOG[0], status: "learned", successes: 5 },
      false,
      now,
    );
    expect(result.status).toBe("learning");
    expect(result.successes).toBe(0);
    expect(result.dueAt).toBe(now + 300000);
  });
  it("includes the target and a verified synonym in four distinct choices", () => {
    const w = CATALOG[0];
    const options = optionsFor(w);
    expect(options).toContain(w.word);
    expect(options.filter((v) => isCorrectAnswer(w, v))).toHaveLength(2);
    expect(new Set(options).size).toBe(options.length);
    expect(options.length).toBe(4);
  });
  it("calculates an actual streak, including yesterday when today has no practice", () => {
    const logs = [
      { at: now - 86400000, wordId: "forest", correct: true },
      { at: now - 2 * 86400000, wordId: "book", correct: false },
    ];
    expect(streak(logs, now)).toBe(2);
    expect(streak([], now)).toBe(0);
  });
  it("answers contextual reference questions and admits unknown questions", () => {
    expect(referenceAnswer({ word: CATALOG[0] }, "Что это значит?")).toContain(
      "forest — лес",
    );
    expect(
      referenceAnswer({ word: CATALOG[0] }, "Какой сегодня курс валют?"),
    ).toBeNull();
  });
});

describe("reading highlights", () => {
  it("matches full words and multiword expressions, preferring the longest match", async () => {
    const { highlightText } = await import("../src/domain");
    const word = makeWord("heart", "сердце");
    const phrase = makeWord("by heart", "наизусть");
    const parts = highlightText(
      "Heartfelt words. I know it by heart. A HEART.",
      [word, phrase],
    );
    expect(parts.filter((p) => p.word).map((p) => p.text)).toEqual([
      "by heart",
      "HEART",
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(
      "Heartfelt words. I know it by heart. A HEART.",
    );
  });
  it("escapes regex characters in personal vocabulary", async () => {
    const { highlightText } = await import("../src/domain");
    const words = [makeWord("a.b", "test")];
    expect(
      highlightText("axb a.b", words)
        .filter((p) => p.word)
        .map((p) => p.text),
    ).toEqual(["a.b"]);
  });
});

describe("supplemental material persistence", () => {
  it("restores generated expressions and texts without dropping valid sources", async () => {
    const { vi } = await import("vitest");
    const { emptyStore, loadStore, validPhrase } =
      await import("../src/domain");
    const { PHRASES, PASSAGES } = await import("../src/data");
    expect(validPhrase(PHRASES[0])).toBe(true);
    const saved = {
      ...emptyStore(),
      customPhrases: [{ ...PHRASES[0], id: "generated-test", generated: true }],
      customPassages: [PASSAGES[0]],
    };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(saved) });
    try {
      const loaded = loadStore();
      expect(loaded.error).toBe("");
      expect(loaded.state.customPhrases).toHaveLength(1);
      expect(loaded.state.customPassages).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
