import { describe, it, expect, vi, afterEach } from "vitest";
import { CATALOG } from "../src/data";
import {
  DAY,
  RETRY_DELAY,
  REVIEW_INTERVAL_DAYS,
  acceptedAnswers,
  isCorrectAnswer,
  maskedContext,
  maskedDefinition,
  learningState,
  optionsFor,
  queueFor,
  reviewWord,
  setWordStatus,
  meaningKey,
  canPractice,
  partOfSpeechFor,
} from "../src/learning";
import {
  emptyStore,
  recordPractice,
  progressStats,
  parseImport,
  makeWord,
  mergeWords,
  createBackup,
  parseBackup,
  validateStore,
  saveStore,
  loadStore,
  localDay,
} from "../src/domain";
const now = new Date("2026-10-15T12:00:00Z").getTime();
const fresh = () => ({ ...CATALOG[0], id: "own-forest" });
afterEach(() => vi.unstubAllGlobals());
describe("spaced retrieval", () => {
  it("cannot graduate through repeated answers or reloading before the deadline", () => {
    let w = reviewWord(fresh(), true, now);
    for (let i = 0; i < 20; i++) {
      expect(reviewWord(w, i % 2 === 0, now + i)).toBe(w);
    }
    expect(w).toMatchObject({
      status: "learning",
      successes: 1,
      dueAt: now + DAY,
    });
    expect(queueFor([w], "learn", [], now + DAY - 1)).toEqual([]);
    expect(queueFor([w], "review", [], now + DAY - 1)).toEqual([]);
    expect(queueFor([w], "review", [], now + DAY)).toEqual([w]);
    w = reviewWord(w, true, w.dueAt);
    expect(w.status).toBe("learning");
    expect(w.successes).toBe(2);
    w = reviewWord(w, true, w.dueAt);
    expect(w).toMatchObject({
      status: "learned",
      successes: 3,
      mastery: "scheduled",
      dueAt: now + 11 * DAY,
    });
  });
  it("an error on a due learned word resets evidence and starts the short retry", () => {
    const missed = reviewWord(
      {
        ...fresh(),
        status: "learned",
        successes: 7,
        mastery: "scheduled",
        lastReviewedAt: now - DAY,
        dueAt: now,
      },
      false,
      now,
    );
    expect(missed).toMatchObject({
      status: "learning",
      successes: 0,
      lapses: 1,
      dueAt: now + RETRY_DELAY,
    });
    expect(missed.mastery).toBeUndefined();
    expect(learningState(missed, now)).toBe("learning");
    expect(learningState(missed, missed.dueAt)).toBe("due");
    const retry = reviewWord(missed, true, missed.dueAt);
    expect(retry).toMatchObject({
      status: "learning",
      successes: 1,
      dueAt: now + RETRY_DELAY + DAY,
    });
  });
  it("every interval starts at the actual answer time and is bounded at 180 days", () => {
    let w = fresh(),
      at = now;
    for (let i = 0; i < 20; i++) {
      const delay = i === 1 ? 20 * DAY : 0;
      at = Math.max(at, w.dueAt) + delay;
      w = reviewWord(w, true, at);
      expect(w.dueAt - at).toBe(REVIEW_INTERVAL_DAYS[Math.min(i, 7)] * DAY);
    }
    expect(w.successes).toBe(8);
  });
  it("does not alter a schedule when the clock moves backwards", () => {
    const w = reviewWord(fresh(), true, now);
    expect(reviewWord(w, false, now - DAY)).toBe(w);
    expect(queueFor([w], "review", [], now - DAY)).toEqual([]);
  });
  it.each([NaN, Infinity, -1, 1.5, 8640000000000000])(
    "rejects invalid scheduling time %s",
    (at) => expect(() => reviewWord(fresh(), true, at)).toThrow(RangeError),
  );
  it("self-assessment never fabricates successes and can be undone", () => {
    const manual = setWordStatus(fresh(), "learned", now);
    expect(manual).toMatchObject({
      status: "learned",
      mastery: "manual",
      successes: 0,
      dueAt: now + DAY,
    });
    expect(setWordStatus(manual, "learned", now + 1000)).toBe(manual);
    const undone = setWordStatus(manual, "learning", now);
    expect(undone).toMatchObject({
      successes: 0,
      dueAt: 0,
      status: "learning",
    });
    expect(undone.mastery).toBeUndefined();
  });
  it("derives the three displayed states at the exact deadline without mutating words", () => {
    const original = fresh();
    expect(learningState(original, now)).toBe("learning");
    const scheduled = reviewWord(original, true, now);
    expect(learningState(scheduled, scheduled.dueAt - 1)).toBe("learning");
    expect(learningState(scheduled, scheduled.dueAt)).toBe("due");
    const learned = { ...scheduled, status: "learned" as const };
    expect(learningState(learned, now)).toBe("learned");
    expect(learningState(learned, learned.dueAt)).toBe("due");
    expect(scheduled.successes).toBe(1);
  });
  it("orders overdue retries before later deadlines deterministically", () => {
    const a = { ...fresh(), id: "a", dueAt: now - 10 };
    const b = { ...a, id: "b", dueAt: now - 20 };
    expect(queueFor([a, b], "review", [], now).map((w) => w.id)).toEqual([
      "b",
      "a",
    ]);
  });
});
describe("atomic attempts and persistence", () => {
  it("records an attempt only once, even with a stale snapshot and repeated transaction", () => {
    const state = { ...emptyStore(), words: [fresh()] };
    const next = recordPractice(state, state.words[0], true, now);
    expect(next.logs).toHaveLength(1);
    expect(state.logs).toHaveLength(0);
    expect(recordPractice(next, state.words[0], false, now + 100)).toBe(next);
  });
  it("does not recreate deleted words or grade an edited sense using a stale card", () => {
    const word = fresh();
    expect(
      recordPractice({ ...emptyStore(), words: [] }, word, true, now).logs,
    ).toEqual([]);
    const changed = {
      ...emptyStore(),
      words: [{ ...word, translation: "роща" }],
    };
    expect(recordPractice(changed, word, true, now)).toBe(changed);
    const changedSynonyms = {
      ...emptyStore(),
      words: [{ ...word, synonyms: ["grove"] }],
    };
    expect(recordPractice(changedSynonyms, word, true, now)).toBe(
      changedSynonyms,
    );
  });
  it("introduces a new sense once with a stable local ID and persists the schedule and goal", () => {
    const state = { ...emptyStore(), words: [], dailyGoal: 5 };
    const next = recordPractice(state, fresh(), true, now, true);
    expect(next.words[0].id).not.toBe(fresh().id);
    expect(next.logs[0].wordId).toBe(next.words[0].id);
    expect(recordPractice(next, fresh(), true, now + 100, true)).toBe(next);
    expect(parseBackup(createBackup(next))).toEqual(next);
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) || null,
      setItem: (k: string, v: string) => map.set(k, v),
    });
    saveStore(next);
    expect(loadStore().state).toEqual(next);
  });
  it("accepts old backups without claiming their old rapid successes are confirmed evidence", () => {
    const old = {
      ...emptyStore(),
      words: [{ ...fresh(), status: "learned" as const, successes: 3 }],
      dailyGoal: undefined,
    };
    const loaded = validateStore(old);
    expect(progressStats(loaded, now).confirmed).toBe(0);
    expect(progressStats(loaded, now).manual).toBe(1);
    const checked = reviewWord(loaded.words[0], true, now);
    expect(checked.successes).toBe(1);
    expect(checked.mastery).not.toBe("scheduled");
  });
});
describe("senses, synonyms and answer generation", () => {
  it("stores and imports two meanings independently and skips only the same meaning", () => {
    const a = makeWord("book", "книга");
    const b = makeWord("BOOK", "бронировать");
    const result = mergeWords([a], [b, makeWord(" book ", "книга")]);
    expect(result.added).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(b.concept).toBe("");
    expect(b.partOfSpeech).toBe("verb");
    expect(b.synonyms).toEqual(["reserve"]);
    expect(
      validateStore({ ...emptyStore(), words: result.words }).words,
    ).toHaveLength(2);
    const list = parseImport("word;translation\nbook;книга\nbook;бронировать");
    expect(new Set(list.map(meaningKey)).size).toBe(2);
    const next = recordPractice(
      { ...emptyStore(), words: [a, b] },
      a,
      true,
      now,
    );
    expect(next.words[1]).toBe(b);
  });
  it("never inherits a familiar spelling's unrelated example, art or synonyms", () => {
    const w = makeWord("key", "основной принцип");
    expect(w.concept).toBe("");
    expect(w.example).toBe("");
    expect(w.synonyms).toEqual([]);
    expect(w.definition).toBe("");
  });
  it("imports explicitly supplied sense metadata and rejects invalid synonym lists", () => {
    const [w] = parseImport(
      JSON.stringify([
        {
          word: "fascinate",
          translation: "очаровывать",
          partOfSpeech: "verb",
          synonyms: ["captivate"],
          example: "The stories fascinate children.",
        },
      ]),
    );
    expect(canPractice(w)).toBe(true);
    expect(w.partOfSpeech).toBe("verb");
    expect(() =>
      parseImport(JSON.stringify([{ word: "forest", synonyms: ["FOREST"] }])),
    ).toThrow();
  });
  it("a plain word-list import resets claimed schedule while full backups preserve it", () => {
    const w = reviewWord(fresh(), true, now);
    const [imported] = parseImport(JSON.stringify([w]));
    expect(imported.successes).toBe(0);
    expect(imported.lastReviewedAt).toBeUndefined();
    expect(imported.dueAt).toBe(0);
    expect(
      parseBackup(createBackup({ ...emptyStore(), words: [w] }))?.words[0],
    ).toEqual(w);
  });
  it("normalizes case, whitespace and typographic apostrophes without assuming other meanings are synonyms", () => {
    const w = { ...fresh(), synonyms: ["woods", "WOODLAND", "woods", ""] };
    expect(acceptedAnswers(w)).toHaveLength(3);
    expect(isCorrectAnswer(w, "  WOODS ")).toBe(true);
    expect(isCorrectAnswer(w, "tree")).toBe(false);
    expect(
      isCorrectAnswer({ ...fresh(), word: "don't", synonyms: [] }, "DON’T"),
    ).toBe(true);
  });
  it("masks every occurrence, case and synonym, including regex characters and multiword expressions", () => {
    const w = {
      ...fresh(),
      word: "a.b",
      synonyms: ["test phrase"],
      example: "A.B and a.b use test phrase, not axb.",
      definition: "a.b means test phrase.",
    };
    expect(maskedContext(w)).toBe("_____ and _____ use _____, not axb.");
    expect(maskedDefinition(w)).toBe("_____ means _____.");
    expect(maskedContext({ ...w, example: "Unrelated material." })).toBe("");
    expect(
      maskedContext({
        ...fresh(),
        word: "don't",
        synonyms: [],
        example: "Don’t stop. DON'T wait.",
      }),
    ).toBe("_____ stop. _____ wait.");
  });
  it("does not turn ordinary substrings into missing target words", () =>
    expect(
      maskedContext({
        ...fresh(),
        word: "rain",
        example: "The train arrived.",
      }),
    ).toBe(""));
  it.each([0, 0.25, 0.9, 1, NaN])(
    "all catalog cards have four normalized choices and safe negatives with RNG %s",
    (rng) => {
      for (const w of CATALOG) {
        const options = optionsFor(w, CATALOG, () => rng);
        expect(options).toHaveLength(4);
        expect(new Set(options.map((v) => v.toLowerCase())).size).toBe(4);
        expect(options).toContain(w.word);
        expect(
          options.filter((v) => !isCorrectAnswer(w, v)).length,
        ).toBeGreaterThanOrEqual(2);
        expect(canPractice(w)).toBe(true);
      }
    },
  );
  it("does not mistake reverse or transitive synonyms, equal translations or ambiguous same art for negatives", () => {
    const w = {
      ...fresh(),
      word: "custom",
      synonyms: ["river", "desert", "tower", "letter"],
      concept: "custom",
    };
    const pool = [
      { ...fresh(), word: "alias", synonyms: ["river", "meadow"] },
      { ...fresh(), word: "another", translation: w.translation, synonyms: [] },
      { ...fresh(), word: "same-art", concept: "custom", synonyms: [] },
    ];
    const wrong = optionsFor(w, pool, () => 0.5).filter(
      (v) => !isCorrectAnswer(w, v),
    );
    for (const v of ["alias", "meadow", "another", "same-art"])
      expect(wrong).not.toContain(v);
  });
  it("changes order with randomness instead of assigning every word a fixed answer position", () =>
    expect(optionsFor(fresh(), CATALOG, () => 0)).not.toEqual(
      optionsFor(fresh(), CATALOG, () => 0.9),
    ));
});
describe("honest progress and non-punitive goals", () => {
  it("counts distinct meanings today once, includes errors as effort and ignores future logs", () => {
    const s = {
      ...emptyStore(),
      logs: [
        { at: now, wordId: "a", correct: false },
        { at: now + 1, wordId: "a", correct: true },
        { at: now, wordId: "b", correct: true },
        { at: now + DAY, wordId: "future", correct: true },
      ],
    };
    expect(progressStats(s, now + 2)).toMatchObject({
      todayWords: 2,
      todayAttempts: 3,
      recentAttempts: 3,
      accuracy: 67,
    });
  });
  it("shows no invented accuracy with zero attempts; the three statuses partition the collection", () => {
    const s = {
      ...emptyStore(),
      words: [
        fresh(),
        { ...fresh(), id: "b", dueAt: now },
        { ...fresh(), id: "c", status: "learned" as const, dueAt: now + DAY },
      ],
    };
    const stats = progressStats(s, now);
    expect(stats.accuracy).toBeNull();
    expect(stats.learning + stats.learned + stats.due).toBe(s.words.length);
  });
  it("uses local calendar days for today and the seven-day window, including midnight boundaries", () => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    const midnight = date.getTime();
    const sixDaysAgo = new Date(midnight);
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    const s = {
      ...emptyStore(),
      logs: [
        { at: midnight - 1, wordId: "yesterday", correct: false },
        { at: midnight, wordId: "today", correct: true },
        { at: sixDaysAgo.getTime(), wordId: "edge", correct: true },
        { at: sixDaysAgo.getTime() - 1, wordId: "old", correct: false },
      ],
    };
    expect(localDay(midnight - 1)).not.toBe(localDay(midnight));
    expect(progressStats(s, now)).toMatchObject({
      todayWords: 1,
      recentAttempts: 3,
      accuracy: 67,
    });
  });
  it.each([-1, 51, 1.5, NaN, "10"])("rejects invalid goal %s", (goal) =>
    expect(() => validateStore({ ...emptyStore(), dailyGoal: goal })).toThrow(),
  );
  it("supports no daily goal and preserves it in backups", () =>
    expect(
      parseBackup(createBackup({ ...emptyStore(), dailyGoal: 0 }))?.dailyGoal,
    ).toBe(0));
});

describe("unknown grammar is not guessed", () => {
  it("requires a supplied part of speech for an unfamiliar meaning, even with a valid example", () => {
    expect(partOfSpeechFor(makeWord("credit card", "банковская карта"))).toBe(
      "unknown",
    );
    const w = makeWord("fascinate", "очаровывать");
    w.example = "These stories fascinate children.";
    expect(canPractice(w)).toBe(false);
    expect(optionsFor(w)).toEqual([]);
    const ready = { ...w, partOfSpeech: "verb" as const };
    expect(canPractice(ready)).toBe(true);
    expect(optionsFor(ready)).toHaveLength(4);
  });
  it("recovers a known legacy meaning’s editorial part of speech without inferring grammar from its spelling", () => {
    const legacy = { ...fresh(), partOfSpeech: undefined };
    expect(partOfSpeechFor(legacy)).toBe("noun");
    expect(canPractice(legacy)).toBe(true);
    expect(partOfSpeechFor({ ...legacy, translation: "чужое значение" })).toBe(
      "unknown",
    );
  });
});
