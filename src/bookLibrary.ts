import manifest from "../public/data/books/manifest.json" with { type: "json" };
import { fetchBank } from "./wordBank";
import type { Phrase } from "./data";
import { normalize } from "./domain";

export const BOOK_LIBRARY = manifest.books;
export interface BookData {
  id: string;
  title: string;
  author: string;
  year: number;
  source: string;
  paragraphs: Array<{ text: string; section: string }>;
}
export function locateBookParagraph(
  book: BookData,
  requested: number,
  excerpt?: string,
) {
  if (excerpt) {
    if (book.paragraphs[requested]?.text.includes(excerpt)) return requested;
    return book.paragraphs.findIndex((paragraph) =>
      paragraph.text.includes(excerpt),
    );
  }
  return Number.isSafeInteger(requested) &&
    requested >= 0 &&
    requested < book.paragraphs.length
    ? requested
    : -1;
}
export const contextSignature = (
  phrase: Pick<Phrase, "text" | "translation" | "definition">,
) =>
  JSON.stringify([
    normalize(phrase.text),
    normalize(phrase.translation),
    phrase.definition || "",
  ]);
const loading = new Map<string, Promise<BookData>>();
export function loadBook(id: string): Promise<BookData> {
  const metadata = BOOK_LIBRARY.find((book) => book.id === id);
  if (!metadata)
    return Promise.reject(new Error("Книга не найдена в библиотеке."));
  if (!loading.has(id)) {
    const request = fetchBank(`/data/books/${id}.json`, metadata.sha256)
      .then((data) => {
        const book = data as Partial<BookData> | null;
        if (
          !book ||
          book.id !== id ||
          book.title !== metadata.title ||
          book.author !== metadata.author ||
          book.source !== metadata.source ||
          !Array.isArray(book.paragraphs) ||
          book.paragraphs.length !== metadata.paragraphs ||
          !book.paragraphs.every(
            (paragraph) =>
              typeof paragraph.text === "string" &&
              typeof paragraph.section === "string",
          )
        )
          throw new Error(
            "Не удалось прочитать книгу. Попробуйте загрузить её снова.",
          );
        return book as BookData;
      })
      .catch((error: unknown) => {
        loading.delete(id);
        throw error;
      });
    if (loading.size >= 2) loading.delete(loading.keys().next().value!);
    loading.set(id, request);
  }
  return loading.get(id)!;
}
