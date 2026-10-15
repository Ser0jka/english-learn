import {
  CATALOG,
  INITIAL_WORDS,
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
export function validWord(value: unknown): value is Word {
  if (!value || typeof value !== "object") return false;
  const w = value as Word;
  return (
    [
      "id",
      "word",
      "translation",
      "phonetic",
      "definition",
      "example",
      "exampleRu",
      "concept",
      "level",
    ].every((k) => typeof w[k as keyof Word] === "string") &&
    ["learning", "learned"].includes(w.status) &&
    ["travel", "everyday", "ideas"].includes(w.topic) &&
    Array.isArray(w.synonyms) &&
    w.synonyms.every((s) => typeof s === "string") &&
    [w.successes, w.dueAt, w.addedAt].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
    ) &&
    (w.image === undefined ||
      (typeof w.image === "string" &&
        /^data:image\/(png|jpeg|webp);base64,/.test(w.image)))
  );
}
export function loadStore(): { state: Store; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: emptyStore(), error: "" };
    const s = JSON.parse(raw) as Store;
    if (
      s.version !== 1 ||
      !Array.isArray(s.words) ||
      !s.words.every(validWord) ||
      !Array.isArray(s.phraseIds) ||
      !s.phraseIds.every((id) => typeof id === "string") ||
      !Array.isArray(s.logs) ||
      !s.logs.every(
        (l) =>
          l &&
          Number.isFinite(l.at) &&
          typeof l.wordId === "string" &&
          typeof l.correct === "boolean",
      ) ||
      !Array.isArray(s.interests) ||
      !s.interests.every((i) => ["everyday", "travel", "ideas"].includes(i))
    )
      throw new Error();
    s.customPhrases = Array.isArray(s.customPhrases)
      ? s.customPhrases.filter(validPhrase)
      : [];
    s.customPassages = Array.isArray(s.customPassages)
      ? s.customPassages.filter(validPassage)
      : [];
    return { state: s, error: "" };
  } catch {
    return {
      state: emptyStore(),
      error:
        "Не удалось прочитать сохранённый словарь. Загружена стартовая подборка. Перед изменениями проверьте резервную копию.",
    };
  }
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
        : w.status === "learned" && w.dueAt <= now,
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
  const correct = [word.word, ...word.synonyms];
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
  const delimiter = first.includes("\t")
    ? "\t"
    : first.includes(";")
      ? ";"
      : ",";
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
    const headers = rows[0].map(normalize);
    const headerIndex = headers.findIndex((h) =>
      ["word", "слово", "english"].includes(h),
    );
    if (headerIndex >= 0) {
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
      typeof row.status === "string"
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
  if (!p || typeof p !== "object") return false;
  const v = p as Phrase;
  return (
    [
      "id",
      "text",
      "translation",
      "usage",
      "exceptions",
      "origin",
      "example",
      "exampleRu",
      "frequencyLabel",
    ].every((k) => typeof v[k as keyof Phrase] === "string") &&
    Array.isArray(v.keywords) &&
    v.keywords.every((w) => typeof w === "string") &&
    Number.isFinite(v.frequency) &&
    !!v.source &&
    typeof v.source.label === "string" &&
    typeof v.source.url === "string" &&
    /^https:\/\//.test(v.source.url)
  );
}
export function validPassage(p: unknown): p is Passage {
  if (!p || typeof p !== "object") return false;
  return [
    "id",
    "title",
    "subtitle",
    "text",
    "translation",
    "level",
    "type",
  ].every((k) => typeof (p as Record<string, unknown>)[k] === "string");
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
