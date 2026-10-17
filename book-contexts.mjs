import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

/** @typedef {{id:string,title:string,author:string,year:number,source:string,sha256:string,paragraphs:number}} BookMeta */
/** @typedef {{text:string,section:string}} Paragraph */
/** @typedef {{book:BookMeta,paragraph:number,text:string,section:string,words:string[]}} Row */
/** @typedef {{id:string,text:string,author:string,title:string,url:string,location:string,bookId:string,paragraph:number,match:string,kind:'book'}} BookCandidate */
/** @type {Promise<{rows:Row[],index:Map<string,Set<number>>,books:BookMeta[]}> | undefined} */
let corpus;
const directory = new URL(
  process.argv.includes("--dev")
    ? "./public/data/books/"
    : "./dist/data/books/",
  import.meta.url,
);
/** @param {string} value */
const words = (value) =>
  [...value.matchAll(/[a-z]+(?:['’][a-z]+)*/gi)].map((match) => ({
    value: match[0].toLowerCase().replaceAll("’", "'"),
    start: match.index,
    end: match.index + match[0].length,
  }));

async function loadCorpus() {
  // Tests and an unbuilt development checkout can use the checked-in corpus.
  const manifestBytes = await readFile(
    new URL("manifest.json", directory),
  ).catch(() =>
    readFile(new URL("./public/data/books/manifest.json", import.meta.url)),
  );
  const manifest = JSON.parse(manifestBytes.toString());
  /** @type {BookMeta[]} */
  const books = manifest.books;
  /** @type {Row[]} */
  const rows = [];
  /** @type {Map<string,Set<number>>} */
  const index = new Map();
  for (const book of books) {
    const bytes = await readFile(new URL(`${book.id}.json`, directory)).catch(
      () =>
        readFile(
          new URL(`./public/data/books/${book.id}.json`, import.meta.url),
        ),
    );
    if (createHash("sha256").update(bytes).digest("hex") !== book.sha256)
      throw new Error("Book checksum mismatch");
    /** @type {{paragraphs:Paragraph[]}} */
    const data = JSON.parse(bytes.toString());
    if (data.paragraphs.length !== book.paragraphs)
      throw new Error("Incomplete book");
    for (const [paragraph, item] of data.paragraphs.entries()) {
      const tokens = words(item.text).map((token) => token.value);
      const row = rows.length;
      rows.push({ book, paragraph, ...item, words: tokens });
      for (const token of new Set(tokens)) {
        if (!index.has(token)) index.set(token, new Set());
        index.get(token)?.add(row);
      }
    }
  }
  return { rows, index, books };
}
function getCorpus() {
  if (!corpus)
    corpus = loadCorpus().catch((error) => {
      corpus = undefined;
      throw error;
    });
  return corpus;
}

const irregular = [
  ["be", "am", "is", "are", "was", "were", "been", "being"],
  ["give", "gives", "gave", "given", "giving"],
  ["take", "takes", "took", "taken", "taking"],
  ["get", "gets", "got", "gotten", "getting"],
  ["go", "goes", "went", "gone", "going"],
  ["come", "comes", "came", "coming"],
  ["make", "makes", "made", "making"],
  ["have", "has", "had", "having"],
  ["do", "does", "did", "done", "doing"],
  ["put", "puts", "putting"],
  ["set", "sets", "setting"],
  ["keep", "keeps", "kept", "keeping"],
  ["break", "breaks", "broke", "broken", "breaking"],
  ["hold", "holds", "held", "holding"],
  ["find", "finds", "found", "finding"],
  ["leave", "leaves", "left", "leaving"],
  ["run", "runs", "ran", "running"],
  ["fall", "falls", "fell", "fallen", "falling"],
  ["bring", "brings", "brought", "bringing"],
  ["stand", "stands", "stood", "standing"],
  ["cut", "cuts", "cutting"],
  ["feel", "feels", "felt", "feeling"],
  ["learn", "learns", "learned", "learnt", "learning"],
  ["lose", "loses", "lost", "losing"],
];
/** @param {string} word */
function forms(word) {
  const known = irregular.find((group) => group.includes(word));
  if (known) return new Set(known);
  const base = word;
  return new Set([
    base,
    base + "s",
    base + "es",
    base.endsWith("e") ? base + "d" : base + "ed",
    base.endsWith("e") ? base.slice(0, -1) + "ing" : base + "ing",
    ...(/[^aeiou]y$/.test(base)
      ? [base.slice(0, -1) + "ies", base.slice(0, -1) + "ied"]
      : []),
  ]);
}
const possessives = new Set([
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
  "one's",
  "someone's",
]);
/** Whether an example uses the requested expression, with bounded verb forms.
 * @param {string} phrase @param {string} context */
export function phraseOccurs(phrase, context) {
  let target = words(phrase).map((word) => word.value);
  if (target[0] === "to" && target.length > 2) target = target.slice(1);
  if (!target.length) return false;
  const tokens = words(context);
  const initial = forms(target[0]);
  return tokens.some(
    (token, index) =>
      initial.has(token.value) &&
      target.slice(1).every((part, offset) => {
        const previous = tokens[index + offset],
          next = tokens[index + offset + 1];
        return (
          next &&
          /^[\s\-\u2010-\u2015]+$/.test(
            context.slice(previous.end, next.start),
          ) &&
          (["one's", "someone's"].includes(part)
            ? possessives.has(next.value)
            : part === next.value)
        );
      }),
  );
}
/** Exact contiguous occurrences, with bounded initial verb inflections.
 * @param {string} phrase @param {number} limit @returns {Promise<BookCandidate[]>} */
export async function findBookCandidates(phrase, limit = 6) {
  if (typeof phrase !== "string" || phrase.length > 100) return [];
  const target = words(phrase.trim()).map((token) => token.value);
  if (target.length < 2 || target.length > 12) return [];
  const { rows, index } = await getCorpus();
  const initial = forms(target[0]);
  const ids = new Set(
    [...initial].flatMap((form) => [...(index.get(form) || [])]),
  );
  /** @type {Array<{row:Row,start:number}>} */
  const found = [];
  for (const id of ids) {
    const row = rows[id];
    if (row.words.length < 12) continue;
    const positions = words(row.text);
    const start = row.words.findIndex(
      (token, i) =>
        initial.has(token) &&
        target
          .slice(1)
          .every(
            (part, offset) =>
              positions[i + offset + 1] &&
              /^[\s\-\u2010-\u2015]+$/.test(
                row.text.slice(
                  positions[i + offset].end,
                  positions[i + offset + 1].start,
                ),
              ) &&
              (["one's", "someone's"].includes(part)
                ? possessives.has(row.words[i + offset + 1])
                : row.words[i + offset + 1] === part),
          ),
    );
    if (start >= 0) found.push({ row, start });
  }
  found.sort(
    (a, b) =>
      Math.abs(a.row.text.length - 450) - Math.abs(b.row.text.length - 450),
  );
  /** @type {BookCandidate[]} */
  const results = [];
  const counts = new Map();
  for (const { row, start } of found) {
    if ((counts.get(row.book.id) || 0) >= (limit <= 3 ? 1 : 2)) continue;
    const tokens = words(row.text);
    const matchStart = tokens[start].start;
    const matchEnd = tokens[start + target.length - 1].end;
    let left = 0,
      right = row.text.length;
    if (right > 1000) {
      const sentence = row.text.lastIndexOf(". ", matchStart);
      left =
        sentence >= Math.max(0, matchStart - 220)
          ? sentence + 2
          : Math.max(
              0,
              row.text.lastIndexOf(" ", Math.max(0, matchStart - 180)) + 1,
            );
      const end = row.text.indexOf(". ", matchEnd);
      right =
        end >= 0 && end - matchEnd < 500
          ? end + 1
          : Math.min(row.text.length, matchEnd + 420);
    }
    if (right - left > 1800) continue;
    results.push({
      id: `${row.book.id}:${row.paragraph}:${left}-${right}`,
      text: row.text.slice(left, right),
      author: row.book.author,
      title: row.book.title,
      url: row.book.source,
      kind: "book",
      location: `${row.section ? row.section + " · " : ""}Абзац ${row.paragraph + 1} · ${row.book.year}`,
      bookId: row.book.id,
      paragraph: row.paragraph,
      match: row.text.slice(matchStart, matchEnd),
    });
    counts.set(row.book.id, (counts.get(row.book.id) || 0) + 1);
    if (results.length >= Math.min(12, Math.max(1, limit))) break;
  }
  return results;
}
