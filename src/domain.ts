import { encodeStoredJson, decodeStoredJson } from "./storageCodec";
import { validAppearance, type Appearance } from "./appearance";
import {
  CATALOG,
  INITIAL_WORDS,
  PHRASES,
  PASSAGES,
  type Word,
  type Topic,
  type Phrase,
  type Passage,
} from "./data";
import { newId } from "./id";
import { findBankWord } from "./wordBank";

export interface PracticeLog {
  at: number;
  wordId: string;
  correct: boolean;
  kind?: "scheduled";
}
export interface Store {
  version: 1;
  customPhrases: Phrase[];
  customPassages: Passage[];
  words: Word[];
  phraseIds: string[];
  logs: PracticeLog[];
  interests: Topic[];
  dailyGoal?: number;
  appearance?: Appearance;
}
export const STORAGE_KEY = "lexi.workspace.v1";
export const emptyStore = (): Store => ({
  version: 1,
  customPhrases: [],
  customPassages: [],
  words: INITIAL_WORDS.map((w) => ({ ...w })),
  phraseIds: [],
  logs: [],
  interests: [],
  dailyGoal: 10,
});
import { normalize, meaningKey, reviewWord, isEligible } from "./learning";
export {
  normalize,
  meaningKey,
  reviewWord,
  queueFor,
  studySessionFor,
  optionsFor,
  acceptedAnswers,
  isCorrectAnswer,
  learningState,
  setWordStatus,
  canPractice,
  maskedContext,
  maskedDefinition,
} from "./learning";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const shortText = (
  value: unknown,
  max: number,
  empty = false,
): value is string =>
  typeof value === "string" &&
  value.length <= max &&
  (empty || value.trim().length > 0);
const timestamp = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 8640000000000000;
const httpsUrl = (value: unknown): value is string => {
  if (!shortText(value, 2000)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
export function validWord(value: unknown): value is Word {
  if (!isRecord(value)) return false;
  return (
    (value.partOfSpeech === undefined ||
      ["noun", "verb", "adjective", "adverb", "phrase", "unknown"].includes(
        value.partOfSpeech as string,
      )) &&
    (value.lastReviewedAt === undefined || timestamp(value.lastReviewedAt)) &&
    (value.lapses === undefined ||
      (Number.isSafeInteger(value.lapses) && (value.lapses as number) >= 0)) &&
    (value.mastery === undefined ||
      value.mastery === "manual" ||
      value.mastery === "scheduled") &&
    (value.bankId === undefined ||
      (typeof value.bankId === "string" &&
        /^\d{8}-[nvar]$/.test(value.bankId))) &&
    (value.generated === undefined || typeof value.generated === "boolean") &&
    (value.sourcePhraseId === undefined ||
      shortText(value.sourcePhraseId, 200)) &&
    shortText(value.id, 200) &&
    shortText(value.word, 100) &&
    /[a-z]/i.test(value.word) &&
    shortText(value.translation, 300, true) &&
    [
      "phonetic",
      "definition",
      "example",
      "exampleRu",
      "concept",
      "level",
    ].every((k) => shortText(value[k], 4000, true)) &&
    (value.status === "learning" || value.status === "learned") &&
    (value.topic === "travel" ||
      value.topic === "everyday" ||
      value.topic === "ideas") &&
    Array.isArray(value.synonyms) &&
    value.synonyms.length <= 20 &&
    value.synonyms.every(
      (v) =>
        shortText(v, 100) && normalize(v) !== normalize(value.word as string),
    ) &&
    new Set(value.synonyms.map((v) => normalize(v as string))).size ===
      value.synonyms.length &&
    typeof value.successes === "number" &&
    Number.isSafeInteger(value.successes) &&
    value.successes >= 0 &&
    timestamp(value.dueAt) &&
    timestamp(value.addedAt) &&
    (value.image === undefined ||
      (shortText(value.image, 900000) &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(
          value.image,
        )))
  );
}
export function validateStore(value: unknown): Store {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    (value.appearance !== undefined && !validAppearance(value.appearance)) ||
    !Array.isArray(value.words) ||
    value.words.length > 20000 ||
    !value.words.every(validWord) ||
    new Set(value.words.map((w) => w.id)).size !== value.words.length ||
    new Set(value.words.map(meaningKey)).size !== value.words.length ||
    !Array.isArray(value.phraseIds) ||
    !value.phraseIds.every((v) => shortText(v, 200)) ||
    !Array.isArray(value.logs) ||
    value.logs.length > 100000 ||
    !value.logs.every(
      (l) =>
        isRecord(l) &&
        timestamp(l.at) &&
        shortText(l.wordId, 200) &&
        typeof l.correct === "boolean" &&
        (l.kind === undefined || l.kind === "scheduled"),
    ) ||
    (value.dailyGoal !== undefined &&
      (!Number.isSafeInteger(value.dailyGoal) ||
        (value.dailyGoal as number) < 0 ||
        (value.dailyGoal as number) > 50)) ||
    !Array.isArray(value.interests) ||
    !value.interests.every((i) =>
      ["everyday", "travel", "ideas"].includes(i as string),
    )
  ) {
    throw new Error(
      "Резервная копия содержит некорректные данные словаря или прогресса.",
    );
  }
  const customPhrases =
    value.customPhrases === undefined ? [] : value.customPhrases;
  const customPassages =
    value.customPassages === undefined ? [] : value.customPassages;
  if (
    !Array.isArray(customPhrases) ||
    !customPhrases.every(validPhrase) ||
    customPhrases.some(
      (p) => p.id.startsWith("wnphrase-") || PHRASES.some((b) => b.id === p.id),
    ) ||
    !Array.isArray(customPassages) ||
    !customPassages.every(validPassage) ||
    customPassages.some((p) => PASSAGES.some((b) => b.id === p.id)) ||
    new Set(customPhrases.map((p) => p.id)).size !== customPhrases.length ||
    new Set(customPassages.map((p) => p.id)).size !== customPassages.length
  ) {
    throw new Error(
      "Резервная копия содержит некорректные выражения или тексты.",
    );
  }
  return {
    version: 1,
    words: value.words,
    phraseIds: [...new Set(value.phraseIds as string[])],
    logs: value.logs as unknown as PracticeLog[],
    interests: [...new Set(value.interests as Topic[])],
    customPhrases,
    customPassages,
    ...(value.appearance === undefined
      ? {}
      : { appearance: value.appearance as Appearance }),
    ...(value.dailyGoal === undefined
      ? {}
      : { dailyGoal: value.dailyGoal as number }),
  };
}
export function loadStore(): {
  state: Store;
  error: string;
  raw: string | null;
} {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return {
      state: raw
        ? validateStore(JSON.parse(decodeStoredJson(raw)))
        : emptyStore(),
      error: "",
      raw,
    };
  } catch {
    return {
      state: emptyStore(),
      raw,
      error:
        "Не удалось прочитать сохранённый словарь. Загружена стартовая подборка. Исходные данные не перезаписаны; перед изменениями проверьте резервную копию.",
    };
  }
}
export class StorageConflictError extends Error {
  constructor() {
    super(
      "Словарь изменён в другой вкладке. Экспортируйте свои изменения и перезагрузите страницу, чтобы открыть сохранённую версию.",
    );
    this.name = "StorageConflictError";
  }
}
export function saveStore(state: Store, expectedRaw?: string | null): string {
  validateStore(state);
  if (
    expectedRaw !== undefined &&
    localStorage.getItem(STORAGE_KEY) !== expectedRaw
  )
    throw new StorageConflictError();
  const raw = encodeStoredJson(JSON.stringify(state));
  localStorage.setItem(STORAGE_KEY, raw);
  return raw;
}
export function createBackup(state: Store): string {
  return JSON.stringify(
    {
      ...state,
      backupType: "lexi-workspace",
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}
export function parseBackup(text: string): Store | null {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
  if (!isRecord(data) || data.backupType !== "lexi-workspace") return null;
  return validateStore(data);
}
export function removeWord(state: Store, id: string): Store {
  const word = state.words.find((w) => w.id === id);
  if (!word) return state;
  const associated = new Set(
    [...PHRASES, ...state.customPhrases]
      .filter(
        (p) =>
          normalize(p.text) === normalize(word.word) &&
          normalize(p.translation) === normalize(word.translation),
      )
      .map((p) => p.id),
  );
  return {
    ...state,
    words: state.words.filter((w) => w.id !== id),
    phraseIds: state.phraseIds.filter(
      (p) => p !== word.sourcePhraseId && !associated.has(p),
    ),
  };
}
export function mergeWords(existing: Word[], incoming: Word[]) {
  const seen = new Set(existing.map(meaningKey));
  const ids = new Set(existing.map((w) => w.id));
  const added = incoming.filter((w) => {
    const key = meaningKey(w);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    words: [
      ...existing,
      ...added.map((w) => {
        let id = w.id;
        while (ids.has(id) || id.length > 200) id = newId();
        ids.add(id);
        return id === w.id ? w : { ...w, id };
      }),
    ],
    added: added.length,
    duplicates: incoming.length - added.length,
  };
}
function parseRows(text: string): string[][] {
  const first = text.split(/\r?\n/)[0];
  const counts: Record<string, number> = { "\t": 0, ";": 0, ",": 0 };
  let inQuotes = false;
  for (let i = 0; i < first.length; i++) {
    if (first[i] === '"') {
      if (inQuotes && first[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && Object.hasOwn(counts, first[i])) counts[first[i]]++;
  }
  const delimiter = Object.keys(counts).sort(
    (a, b) => counts[b] - counts[a],
  )[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("В файле не закрыта кавычка. Проверьте CSV.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function makeWord(
  word: string,
  translation: string,
  status: Word["status"] = "learning",
): Word {
  const known =
    CATALOG.find(
      (w) =>
        normalize(w.word) === normalize(word) &&
        (!translation.trim() ||
          normalize(w.translation) === normalize(translation)),
    ) || findBankWord(word, translation);
  return {
    ...(known || {
      phonetic: "",
      definition: "",
      example: "",
      exampleRu: "",
      synonyms: [],
      concept: "",
      level: "—",
      topic: "everyday" as const,
      partOfSpeech: "unknown" as const,
    }),
    id: newId(),
    word: normalize(word),
    translation: translation.trim() || known?.translation || "",
    status,
    successes: 0,
    mastery: status === "learned" ? "manual" : undefined,
    dueAt: status === "learned" ? Date.now() + 86400000 : 0,
    addedAt: Date.now(),
  };
}
export function parseImport(text: string): Word[] {
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) throw new Error("Файл пуст. Добавьте хотя бы одно слово.");
  let values: unknown[];
  if (clean.startsWith("[") || clean.startsWith("{")) {
    let data;
    try {
      data = JSON.parse(clean);
    } catch {
      throw new Error("Не удалось прочитать JSON. Проверьте формат файла.");
    }
    values = Array.isArray(data) ? data : data.words;
    if (!Array.isArray(values))
      throw new Error("В JSON должен быть массив words или список слов.");
  } else {
    const rows = parseRows(clean);
    let wordCol = 0,
      translationCol = 1,
      statusCol = 2;
    if (!rows.length) throw new Error("В файле нет слов.");
    const headers = rows[0].map(normalize);
    const headerIndex = headers.findIndex((h) =>
      ["word", "слово", "english"].includes(h),
    );
    if (
      headerIndex >= 0 &&
      headers.some((h) =>
        ["translation", "перевод", "russian", "status", "статус"].includes(h),
      )
    ) {
      wordCol = headerIndex;
      translationCol = headers.findIndex((h) =>
        ["translation", "перевод", "russian"].includes(h),
      );
      statusCol = headers.findIndex((h) => ["status", "статус"].includes(h));
      rows.shift();
    }
    values = rows.map((r) => ({
      word: r[wordCol],
      translation: r[translationCol] || "",
      status: r[statusCol] || "learning",
    }));
  }
  if (values.length > 2000)
    throw new Error("Можно загрузить не больше 2000 слов за один раз.");
  const words = values.map((v, i) => {
    const row =
      typeof v === "string" ? { word: v } : (v as Record<string, unknown>);
    if (
      !row ||
      typeof row.word !== "string" ||
      !row.word.trim() ||
      row.word.length > 100 ||
      !/[a-z]/i.test(row.word)
    )
      throw new Error(
        `Строка ${i + 1}: нужно английское слово или выражение до 100 символов.`,
      );
    if (
      row.translation !== undefined &&
      (typeof row.translation !== "string" || row.translation.length > 300)
    )
      throw new Error(`Строка ${i + 1}: некорректный перевод.`);
    const statuses: Record<string, Word["status"]> = {
      learning: "learning",
      learned: "learned",
      учу: "learning",
      выучил: "learned",
      выучено: "learned",
    };
    const status =
      typeof row.status === "string" &&
      Object.hasOwn(statuses, normalize(row.status))
        ? statuses[normalize(row.status)]
        : row.status === undefined
          ? "learning"
          : undefined;
    if (!status)
      throw new Error(
        `Строка ${i + 1}: статус должен быть learning или learned.`,
      );
    const result = makeWord(
      row.word,
      typeof row.translation === "string" ? row.translation : "",
      status,
    );
    // A list imports vocabulary and self-assessed status, never manufactured review history.
    for (const field of [
      "partOfSpeech",
      "synonyms",
      "definition",
      "example",
      "exampleRu",
      "concept",
      "phonetic",
      "image",
    ] as const) {
      if (row[field] !== undefined)
        Object.assign(result, { [field]: row[field] });
    }
    if (!validWord(result))
      throw new Error(
        `Строка ${i + 1}: проверьте часть речи, синонимы, контекст или изображение.`,
      );
    if (validWord(row))
      return {
        ...row,
        ...{
          id: result.id,
          word: result.word,
          status: result.status,
          successes: 0,
          dueAt: result.dueAt,
          lastReviewedAt: undefined,
          lapses: 0,
          mastery: result.mastery,
        },
      };
    return result;
  });
  if (!words.length) throw new Error("В файле нет слов.");
  return words;
}
export const localDay = (at: number) =>
  new Date(at).toLocaleDateString("en-CA");
export function streak(logs: PracticeLog[], now = Date.now()) {
  const days = new Set(logs.map((l) => localDay(l.at)));
  let count = 0;
  const cursor = new Date(now);
  if (!days.has(localDay(cursor.getTime())))
    cursor.setDate(cursor.getDate() - 1);
  while (days.has(localDay(cursor.getTime()))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
export function speak(text: string) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function validPhrase(p: unknown): p is Phrase {
  if (!isRecord(p)) return false;
  const quote = p.quote;
  return (
    shortText(p.id, 200) &&
    shortText(p.text, 100) &&
    ["translation", "usage", "exceptions", "origin", "frequencyLabel"].every(
      (k) => shortText(p[k], 4000),
    ) &&
    ["example", "exampleRu"].every((k) => shortText(p[k], 4000, true)) &&
    (p.definition === undefined || shortText(p.definition, 4000)) &&
    (p.dictionary === undefined || typeof p.dictionary === "boolean") &&
    (p.bankId === undefined ||
      (typeof p.bankId === "string" && /^\d{8}-[nvar]$/.test(p.bankId))) &&
    Array.isArray(p.keywords) &&
    p.keywords.every((k) => shortText(k, 100)) &&
    typeof p.frequency === "number" &&
    Number.isFinite(p.frequency) &&
    p.frequency >= 0 &&
    isRecord(p.source) &&
    shortText(p.source.label, 300) &&
    httpsUrl(p.source.url) &&
    (p.generated === undefined || typeof p.generated === "boolean") &&
    (quote === undefined ||
      (isRecord(quote) &&
        ["text", "translation", "author"].every((k) =>
          shortText(quote[k], 4000),
        ) &&
        httpsUrl(quote.url) &&
        (quote.kind === undefined ||
          (typeof quote.kind === "string" &&
            ["book", "article", "play", "speech"].includes(quote.kind))) &&
        ["title", "location", "note"].every(
          (k) => quote[k] === undefined || shortText(quote[k], 1000),
        )))
  );
}
export function validPassage(p: unknown): p is Passage {
  if (!isRecord(p)) return false;
  return (
    shortText(p.id, 200) &&
    ["title", "subtitle"].every((k) => shortText(p[k], 200)) &&
    ["text", "translation"].every((k) => shortText(p[k], 7000)) &&
    shortText(p.level, 20) &&
    shortText(p.type, 100)
  );
}

export function plural(count: number, forms: [string, string, string]) {
  const rule = new Intl.PluralRules("ru").select(count);
  return forms[rule === "one" ? 0 : rule === "few" ? 1 : 2];
}
export function highlightText(
  text: string,
  words: Word[],
): Array<{ text: string; word?: Word }> {
  const candidates = [...words]
    .filter((w) => w.word.trim())
    .sort((a, b) => b.word.length - a.word.length);
  if (!candidates.length) return [{ text }];
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    "\\b(" + candidates.map((w) => escape(w.word)).join("|") + ")\\b",
    "gi",
  );
  const parts: Array<{ text: string; word?: Word }> = [];
  let position = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index!;
    if (index > position) parts.push({ text: text.slice(position, index) });
    parts.push({
      text: match[0],
      word: candidates.find((w) => normalize(w.word) === normalize(match[0])),
    });
    position = index + match[0].length;
  }
  if (position < text.length) parts.push({ text: text.slice(position) });
  return parts;
}

// A single immutable transaction keeps attempts and the schedule consistent, including double clicks.
export function recordPractice(
  state: Store,
  snapshot: Word,
  correct: boolean,
  now = Date.now(),
  introduce = false,
): Store {
  const existing =
    state.words.find((w) => w.id === snapshot.id) ||
    state.words.find((w) => meaningKey(w) === meaningKey(snapshot));
  if (!existing && !introduce) return state;
  if (
    existing &&
    (meaningKey(existing) !== meaningKey(snapshot) ||
      existing.status !== snapshot.status ||
      existing.successes !== snapshot.successes ||
      JSON.stringify([
        existing.synonyms,
        existing.example,
        existing.concept,
        existing.image,
        existing.definition,
        existing.partOfSpeech,
        existing.bankId,
      ]) !==
        JSON.stringify([
          snapshot.synonyms,
          snapshot.example,
          snapshot.concept,
          snapshot.image,
          snapshot.definition,
          snapshot.partOfSpeech,
          snapshot.bankId,
        ]) ||
      existing.dueAt !== snapshot.dueAt ||
      existing.lastReviewedAt !== snapshot.lastReviewedAt ||
      !isEligible(existing, now))
  )
    return state;
  const source = existing || {
    ...snapshot,
    id: newId(),
    addedAt: now,
  };
  const updated = reviewWord(source, correct, now);
  if (updated === source) return state;
  return {
    ...state,
    words: existing
      ? state.words.map((w) => (w.id === existing.id ? updated : w))
      : [...state.words, updated],
    logs: [
      ...state.logs,
      { at: now, wordId: updated.id, correct, kind: "scheduled" },
    ],
  };
}
export function progressStats(state: Store, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const logs = state.logs.filter((l) => l.at <= now);
  const today = logs.filter((l) => localDay(l.at) === localDay(now));
  const recent = logs.filter((l) => l.at >= start.getTime());
  const due = state.words.filter(
    (w) => (w.dueAt > 0 || w.status === "learned") && w.dueAt <= now,
  );
  return {
    todayWords: new Set(today.map((l) => l.wordId)).size,
    todayAttempts: today.length,
    recentAttempts: recent.length,
    accuracy: recent.length
      ? Math.round(
          (recent.filter((l) => l.correct).length / recent.length) * 100,
        )
      : null,
    due: due.length,
    learning: state.words.filter(
      (w) => w.status === "learning" && !due.includes(w),
    ).length,
    learned: state.words.filter(
      (w) => w.status === "learned" && !due.includes(w),
    ).length,
    confirmed: state.words.filter(
      (w) => w.status === "learned" && w.mastery === "scheduled",
    ).length,
    manual: state.words.filter(
      (w) => w.status === "learned" && w.mastery !== "scheduled",
    ).length,
  };
}
