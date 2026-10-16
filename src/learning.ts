import {
  CATALOG,
  PHRASES,
  type Word,
  type Mode,
  type Topic,
  type LearningState,
  type PartOfSpeech,
} from "./data";
import { WORD_BANK, NEW_SESSION_SIZE, bankEntry } from "./wordBank";
export const DAY = 86400000;
export const RETRY_DELAY = 5 * 60000;
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120, 180] as const;
export const MASTERY_SUCCESSES = 3;
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
// A dictionary entry is a meaning, not just a spelling. Its ID stays stable on edits.
export const meaningKey = (w: Pick<Word, "word" | "translation">) =>
  JSON.stringify([normalize(w.word), normalize(w.translation)]);
export const acceptedAnswers = (word: Word) => [
  ...new Map(
    [word.word, ...word.synonyms]
      .filter((v) => v.trim())
      .map((v) => [normalize(v), v.trim()]),
  ).values(),
];
export const isCorrectAnswer = (word: Word, answer: string) =>
  acceptedAnswers(word).some((v) => normalize(v) === normalize(answer));
export function learningState(word: Word, now = Date.now()): LearningState {
  return (word.dueAt > 0 || word.status === "learned") && word.dueAt <= now
    ? "due"
    : word.status;
}
export function isEligible(word: Word, now = Date.now()) {
  return (
    word.dueAt <= now &&
    (word.lastReviewedAt === undefined || word.lastReviewedAt < now)
  );
}
export function queueFor(
  words: Word[],
  mode: Mode,
  interests: Topic[] = [],
  now = Date.now(),
): Word[] {
  if (mode === "new") {
    const existing = new Set(words.map(meaningKey));
    return [...CATALOG, ...WORD_BANK]
      .filter((w) => !existing.has(meaningKey(w)))
      .sort(
        (a, b) =>
          Number(interests.includes(b.topic)) -
            Number(interests.includes(a.topic)) || a.addedAt - b.addedAt,
      );
  }
  return words
    .filter(
      (w) =>
        isEligible(w, now) &&
        (mode === "learn"
          ? w.status === "learning"
          : learningState(w, now) === "due"),
    )
    .sort(
      (a, b) =>
        a.dueAt - b.dueAt || a.addedAt - b.addedAt || a.id.localeCompare(b.id),
    );
}
export function studySessionFor(
  words: Word[],
  mode: Mode,
  interests: Topic[] = [],
  now = Date.now(),
) {
  const result: Word[] = [];
  for (const word of queueFor(words, mode, interests, now)) {
    if (canPractice(word)) result.push(word);
    if (mode === "new" && result.length === NEW_SESSION_SIZE) break;
  }
  return result;
}
export function reviewWord(
  word: Word,
  correct: boolean,
  now = Date.now(),
): Word {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now > 8640000000000000 - DAY * 180
  )
    throw new RangeError("Некорректное время повторения.");
  if (!isEligible(word, now)) return word;
  const successes = correct
    ? Math.min(
        (word.lastReviewedAt === undefined ? 0 : word.successes) + 1,
        REVIEW_INTERVAL_DAYS.length,
      )
    : 0;
  return {
    ...word,
    successes,
    lastReviewedAt: now,
    lapses: Math.min(
      (word.lapses || 0) + (correct ? 0 : 1),
      Number.MAX_SAFE_INTEGER,
    ),
    status: !correct
      ? "learning"
      : successes >= MASTERY_SUCCESSES
        ? "learned"
        : word.status,
    mastery: !correct
      ? undefined
      : successes >= MASTERY_SUCCESSES
        ? "scheduled"
        : word.mastery,
    dueAt:
      now + (correct ? REVIEW_INTERVAL_DAYS[successes - 1] * DAY : RETRY_DELAY),
  };
}
export function setWordStatus(
  word: Word,
  status: Word["status"],
  now = Date.now(),
): Word {
  if (!Number.isSafeInteger(now) || now < 0 || now > 8640000000000000 - DAY)
    throw new RangeError("Некорректное время отметки.");
  if (status === word.status) return word;
  return {
    ...word,
    status,
    successes: 0,
    lastReviewedAt: undefined,
    mastery: status === "learned" ? "manual" : undefined,
    dueAt: status === "learned" ? now + DAY : 0,
  };
}
const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function maskedContext(word: Word): string {
  const pattern = new RegExp(
    "(?<![a-z])(" +
      acceptedAnswers(word)
        .sort((a, b) => b.length - a.length)
        .map((v) => escapeRegex(v.normalize("NFKC")).replace(/[’‘']/g, "['’‘]"))
        .join("|") +
      ")(?![a-z])",
    "gi",
  );
  const example = word.example.normalize("NFKC");
  if (!pattern.test(example)) return "";
  pattern.lastIndex = 0;
  return example.replace(pattern, "_____");
}
const readiness = new WeakMap<Word, boolean>();
export function partOfSpeechFor(word: Word): PartOfSpeech {
  if (word.partOfSpeech && word.partOfSpeech !== "unknown")
    return word.partOfSpeech;
  return (
    CATALOG.find((w) => meaningKey(w) === meaningKey(word))?.partOfSpeech ||
    "unknown"
  );
}
export function canPractice(word: Word) {
  const cached = readiness.get(word);
  if (cached !== undefined) return cached;
  const result =
    !!word.translation.trim() &&
    partOfSpeechFor(word) !== "unknown" &&
    !!(
      word.concept ||
      word.image ||
      maskedContext(word) ||
      (bankEntry(word) && maskedDefinition(word).trim())
    ) &&
    optionsFor(word, CATALOG, () => 0.5).length === 4;
  readiness.set(word, result);
  return result;
}
export const PARTS_OF_SPEECH: Record<PartOfSpeech, string> = {
  noun: "Существительное",
  verb: "Глагол",
  adjective: "Прилагательное",
  adverb: "Наречие",
  phrase: "Выражение",
  unknown: "Не указана",
};
// Editorial distractors are a local teaching resource, not AI-generated definitions.
const curated: Record<string, string[]> = {
  forest: ["desert", "meadow", "cave", "island"],
  journey: ["arrival", "destination", "departure", "delay"],
  book: ["newspaper", "letter", "notebook", "magazine"],
  bridge: ["tunnel", "tower", "fence", "gate"],
  ocean: ["river", "pond", "waterfall", "stream"],
  coffee: ["tea", "juice", "water", "milk"],
  window: ["door", "mirror", "shelf", "ceiling"],
  mountain: ["valley", "plain", "cliff", "hill"],
  time: ["distance", "weight", "speed", "temperature"],
  light: ["shadow", "darkness", "heat", "sound"],
  rain: ["snow", "fog", "wind", "hail"],
  key: ["lock", "handle", "hinge", "bell"],
  heart: ["lung", "brain", "stomach", "liver"],
  dream: ["memory", "obstacle", "nightmare", "routine"],
  courage: ["fear", "patience", "wisdom", "curiosity"],
  bloom: ["wither", "freeze", "fade", "fall"],
  home: ["office", "station", "shop", "hotel"],
  sunrise: ["sunset", "midnight", "noon", "evening"],
  ice: ["steam", "snow", "water", "frost"],
  gold: ["silver", "copper", "iron", "brass"],
  road: ["pavement", "railway", "runway", "canal"],
  leaf: ["root", "stem", "branch", "seed"],
  peace: ["conflict", "noise", "anger", "fear"],
  opportunity: ["obstacle", "requirement", "decision", "consequence"],
};
const fallback: Record<PartOfSpeech, string[]> = {
  noun: [
    "river",
    "desert",
    "tower",
    "letter",
    "milk",
    "valley",
    "shadow",
    "lock",
  ],
  verb: [
    "cancel",
    "borrow",
    "repair",
    "forget",
    "carry",
    "close",
    "freeze",
    "wait",
  ],
  adjective: [
    "heavy",
    "empty",
    "rough",
    "distant",
    "dark",
    "narrow",
    "wet",
    "cold",
  ],
  adverb: [
    "slowly",
    "rarely",
    "quietly",
    "nearby",
    "often",
    "already",
    "almost",
    "never",
  ],
  phrase: PHRASES.map((p) => p.text),
  unknown: [
    "river",
    "desert",
    "tower",
    "letter",
    "milk",
    "valley",
    "shadow",
    "lock",
  ],
};
function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const value = random();
    const bounded = Number.isFinite(value)
      ? Math.max(0, Math.min(value, 1 - Number.EPSILON))
      : 0.5;
    const j = Math.floor(bounded * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function optionsFor(
  word: Word,
  pool: Word[] = CATALOG,
  random: () => number = Math.random,
): string[] {
  const pos = partOfSpeechFor(word);
  if (pos === "unknown") return [];
  const accepted = acceptedAnswers(word),
    blocked = new Set(accepted.map(normalize));
  const bank = bankEntry(word);
  if (bank) {
    const translations = (value: string) =>
      value.split(/[;,]/).map(normalize).filter(Boolean);
    const meanings = translations(word.translation);
    for (const candidate of pool) {
      const labels = acceptedAnswers(candidate);
      if (
        labels.some((label) => blocked.has(normalize(label))) ||
        translations(candidate.translation).some((value) =>
          meanings.includes(value),
        )
      )
        for (const label of labels) blocked.add(normalize(label));
    }
    const wrong = shuffled(
      bank.distractors.filter((value) => !blocked.has(normalize(value))),
      random,
    );
    const positives = [
      word.word,
      ...shuffled(
        accepted.filter((v) => normalize(v) !== normalize(word.word)),
        random,
      ).slice(0, 1),
    ];
    const needed = 4 - positives.length;
    return wrong.length < needed
      ? []
      : shuffled([...positives, ...wrong.slice(0, needed)], random);
  }
  const all = [...CATALOG, ...pool];
  // Exclude reverse/transitive synonyms too. A known valid alternative must never be marked wrong.
  const graph = new Map<string, Set<string>>();
  for (const w of all) {
    const labels = acceptedAnswers(w).map(normalize);
    for (const label of labels) {
      const edges = graph.get(label) || new Set<string>();
      for (const other of labels) edges.add(other);
      graph.set(label, edges);
    }
  }
  const pending = [...blocked];
  for (let i = 0; i < pending.length; i++) {
    for (const neighbor of graph.get(pending[i]) || []) {
      if (!blocked.has(neighbor)) {
        blocked.add(neighbor);
        pending.push(neighbor);
      }
    }
  }
  const translations = (s: string) =>
    s.split(/[;,]/).map(normalize).filter(Boolean);
  const meaning = translations(word.translation);
  for (const w of all)
    if (
      (w.concept && w.concept === word.concept) ||
      translations(w.translation).some((t) => meaning.includes(t))
    )
      for (const label of acceptedAnswers(w)) blocked.add(normalize(label));
  const special =
    word.word === "book" && pos === "verb"
      ? ["cancel", "borrow", "buy", "lend"]
      : word.word === "light" && pos === "adjective"
        ? ["heavy", "dark", "empty", "bright"]
        : word.word === "key" && word.translation === "клавиша"
          ? ["screen", "mouse", "speaker", "cable"]
          : word.word === "dream" && word.translation === "сон во время сна"
            ? ["memory", "thought", "story", "nightmare"]
            : CATALOG.some(
                  (w) =>
                    meaningKey(w) === meaningKey(word) &&
                    w.partOfSpeech === pos,
                )
              ? curated[normalize(word.word)] || []
              : [];
  const candidates = [
    ...shuffled(special, random),
    ...shuffled(
      all.filter(
        (w) =>
          partOfSpeechFor(w) === pos &&
          normalize(w.word).includes(" ") ===
            normalize(word.word).includes(" "),
      ),
      random,
    )
      .sort(
        (a, b) =>
          Number(b.topic === word.topic) - Number(a.topic === word.topic) ||
          Number(b.level === word.level) - Number(a.level === word.level),
      )
      .map((w) => w.word),
    ...shuffled(fallback[pos], random),
  ];
  const wrong = [
    ...new Map(
      candidates
        .filter((v) => !blocked.has(normalize(v)))
        .map((v) => [normalize(v), v]),
    ).values(),
  ];
  const positives = [
    word.word,
    ...shuffled(
      accepted.filter((v) => normalize(v) !== normalize(word.word)),
      random,
    ).slice(0, 1),
  ];
  const needed = 4 - positives.length;
  if (wrong.length < needed) return [];
  return shuffled([...positives, ...wrong.slice(0, needed)], random);
}

export function maskedDefinition(word: Word) {
  const labels = acceptedAnswers(word)
    .sort((a, b) => b.length - a.length)
    .map((v) => escapeRegex(v.normalize("NFKC")).replace(/[’‘']/g, "['’‘]"));
  return labels.length
    ? word.definition
        .normalize("NFKC")
        .replace(
          new RegExp("(?<![a-z])(" + labels.join("|") + ")(?![a-z])", "gi"),
          "_____",
        )
    : "";
}
