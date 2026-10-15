import {
  CATALOG,
  INITIAL_WORDS,
  PHRASES,
  type Word,
  type Mode,
  type Topic,
  type Phrase,
  type Passage,
} from "./data";
export interface PracticeLog {
  at: number;
  wordId: string;
  correct: boolean;
}
export interface Store {
  version: 1;
  customPhrases: Phrase[];
  customPassages: Passage[];
  words: Word[];
  phraseIds: string[];
  logs: PracticeLog[];
  interests: Topic[];
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
});
export const normalize = (s: string) =>
  s.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
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
    !Array.isArray(value.words) ||
    value.words.length > 10000 ||
    !value.words.every(validWord) ||
    new Set(value.words.map((w) => w.id)).size !== value.words.length ||
    new Set(value.words.map((w) => normalize(w.word))).size !==
      value.words.length ||
    !Array.isArray(value.phraseIds) ||
    !value.phraseIds.every((v) => shortText(v, 200)) ||
    !Array.isArray(value.logs) ||
    value.logs.length > 100000 ||
    !value.logs.every(
      (l) =>
        isRecord(l) &&
        timestamp(l.at) &&
        shortText(l.wordId, 200) &&
        typeof l.correct === "boolean",
    ) ||
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
    !Array.isArray(customPassages) ||
    !customPassages.every(validPassage) ||
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
  };
}
export function loadStore(): { state: Store; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      state: raw ? validateStore(JSON.parse(raw)) : emptyStore(),
      error: "",
    };
  } catch {
    return {
      state: emptyStore(),
      error:
        "Не удалось прочитать сохранённый словарь. Загружена стартовая подборка. Исходные данные не перезаписаны; перед изменениями проверьте резервную копию.",
    };
  }
}
export function saveStore(state: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      .filter((p) => normalize(p.text) === normalize(word.word))
      .map((p) => p.id),
  );
  return {
    ...state,
    words: state.words.filter((w) => w.id !== id),
    phraseIds: state.phraseIds.filter((p) => !associated.has(p)),
  };
}
export function queueFor(
  words: Word[],
  mode: Mode,
  interests: Topic[] = [],
  now = Date.now(),
): Word[] {
  if (mode === "new")
    return CATALOG.filter(
      (w) => !words.some((v) => normalize(v.word) === normalize(w.word)),
    ).sort(
      (a, b) =>
        Number(interests.includes(b.topic)) -
          Number(interests.includes(a.topic)) || a.addedAt - b.addedAt,
    );
  return words
    .filter((w) =>
      mode === "learn"
        ? w.status === "learning"
        : (w.status === "learned" || w.dueAt > 0) && w.dueAt <= now,
    )
    .sort((a, b) => a.dueAt - b.dueAt);
}
export function reviewWord(
  word: Word,
  correct: boolean,
  now = Date.now(),
): Word {
  const successes = correct ? word.successes + 1 : 0;
  return {
    ...word,
    successes,
    status:
      correct && successes >= 3
        ? "learned"
        : correct
          ? word.status
          : "learning",
    dueAt:
      now +
      (correct
        ? [1, 3, 7, 14, 30][Math.min(Math.max(successes - 1, 0), 4)] * 86400000
        : 5 * 60000),
  };
}
export function optionsFor(word: Word): string[] {
  const correct = [
    ...new Map(
      [word.word, ...word.synonyms]
        .filter((v) => v.trim())
        .map((v) => [normalize(v), v]),
    ).values(),
  ];
  const wrong = CATALOG.filter(
    (w) => !correct.includes(w.word) && w.concept !== word.concept,
  ).map((w) => w.word);
  const offset =
    [...word.id].reduce((n, c) => n + c.charCodeAt(0), 0) % wrong.length;
  const incorrect = [...wrong.slice(offset), ...wrong.slice(0, offset)].slice(
    0,
    Math.max(2, 4 - correct.length),
  );
  return [...correct, ...incorrect]
    .map((s, i) => ({
      s,
      n: (s.charCodeAt(0) * 13 + s.length * 7 + i * 19) % 101,
    }))
    .sort((a, b) => a.n - b.n)
    .map((v) => v.s);
}
export function mergeWords(existing: Word[], incoming: Word[]) {
  const seen = new Set(existing.map((w) => normalize(w.word)));
  const added = incoming.filter((w) => {
    const key = normalize(w.word);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    words: [...existing, ...added],
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
  const known = CATALOG.find((w) => normalize(w.word) === normalize(word));
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
    }),
    id: crypto.randomUUID(),
    word: normalize(word),
    translation: translation.trim() || known?.translation || "",
    status,
    successes: status === "learned" ? 3 : 0,
    dueAt: 0,
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
    if (validWord(row)) return { ...row, id: result.id, word: result.word };
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
  return (
    shortText(p.id, 200) &&
    shortText(p.text, 100) &&
    [
      "translation",
      "usage",
      "exceptions",
      "origin",
      "example",
      "exampleRu",
      "frequencyLabel",
    ].every((k) => shortText(p[k], 4000)) &&
    Array.isArray(p.keywords) &&
    p.keywords.every((k) => shortText(k, 100)) &&
    typeof p.frequency === "number" &&
    Number.isFinite(p.frequency) &&
    p.frequency >= 0 &&
    isRecord(p.source) &&
    shortText(p.source.label, 300) &&
    httpsUrl(p.source.url) &&
    (p.generated === undefined || typeof p.generated === "boolean") &&
    (p.quote === undefined ||
      (isRecord(p.quote) &&
        ["text", "translation", "author"].every((k) =>
          shortText((p.quote as Record<string, unknown>)[k], 4000),
        ) &&
        httpsUrl(p.quote.url)))
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
