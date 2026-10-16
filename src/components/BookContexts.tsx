import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ExternalLink, LoaderCircle } from "lucide-react";
import type { Phrase, PhraseQuote } from "../data";
import type { StudyProps } from "../types";
import { validPhraseQuote } from "../domain";
import { contextSignature } from "../bookLibrary";
import { materialRequest } from "../useMaterials";
import BookReader, { MarkedText } from "./BookReader";

export default function BookContexts({
  phrase,
  store,
  setStore,
  available,
}: Pick<StudyProps, "store" | "setStore"> & {
  phrase: Phrase;
  available: boolean;
}) {
  const signature = contextSignature(phrase);
  const saved = store.bookContexts?.[phrase.id];
  const initial =
    saved?.signature === signature ? saved.quotes : phrase.bookQuotes || [];
  const [quotes, setQuotes] = useState(initial);
  const [status, setStatus] = useState<
    "idle" | "loading" | "found" | "not-found" | "unavailable"
  >(initial.length ? "found" : phrase.contextStatus || "idle");
  const [reading, setReading] = useState<PhraseQuote | null>(null);
  const request = useRef<AbortController | null>(null);
  const autoStarted = useRef(
    Boolean(phrase.quote || initial.length || phrase.contextStatus),
  );
  useEffect(() => () => request.current?.abort(), []);
  const { id, text, translation, definition, usage } = phrase;
  const find = useCallback(async () => {
    if (!available) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    try {
      const response = await materialRequest<{
        contexts: Array<{ id: string; status: string; quotes: PhraseQuote[] }>;
      }>(
        "contexts",
        {
          phrases: [
            {
              id,
              text,
              translation,
              ...(definition ? { definition: definition.slice(0, 1500) } : {}),
              ...(usage ? { usage: usage.slice(0, 1500) } : {}),
            },
          ],
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const result = response.contexts?.find((item) => item.id === id);
      if (
        !result ||
        !["found", "not-found", "unavailable"].includes(result.status) ||
        !Array.isArray(result.quotes) ||
        result.quotes.length > 3 ||
        !result.quotes.every(validPhraseQuote)
      )
        throw new Error("Invalid book context");
      if (result.status === "unavailable") {
        setStatus("unavailable");
        return;
      }
      if (!result.quotes.length) {
        setStatus("not-found");
        return;
      }
      setQuotes(result.quotes);
      setStatus("found");
      setStore((state) => ({
        ...state,
        bookContexts: Object.fromEntries([
          ...Object.entries(state.bookContexts || {})
            .filter(([key]) => key !== id)
            .slice(-499),
          [id, { signature, quotes: result.quotes }],
        ]),
        customPhrases: state.customPhrases.map((item) =>
          item.id === id
            ? { ...item, bookQuotes: result.quotes, contextStatus: "found" }
            : item,
        ),
      }));
    } catch {
      if (!controller.signal.aborted) setStatus("unavailable");
    }
  }, [
    available,
    id,
    text,
    translation,
    definition,
    usage,
    signature,
    setStore,
  ]);
  useEffect(() => {
    if (available && !autoStarted.current) {
      autoStarted.current = true;
      void find();
    }
  }, [available, find]);
  const shown = [...(phrase.quote ? [phrase.quote] : []), ...quotes].filter(
    (quote, index, all) =>
      all.findIndex(
        (other) => other.text === quote.text && other.url === quote.url,
      ) === index,
  );
  return (
    <section className="book-contexts" aria-label="Контекст из книг">
      {shown.map((quote, index) => (
        <figure
          className="source-quote"
          key={`${quote.bookId || quote.url}:${quote.paragraph ?? index}`}
        >
          <span className="eyebrow">
            {quote.kind === "article"
              ? "ИЗ СТАТЬИ"
              : quote.kind === "speech"
                ? "ИЗ ВЫСТУПЛЕНИЯ"
                : quote.kind === "play"
                  ? "ИЗ ПЬЕСЫ"
                  : "ИЗ КНИГИ"}
          </span>
          <blockquote lang="en">
            {quote.bookId ? (
              <button
                className="context-excerpt"
                onClick={() => setReading(quote)}
                aria-label={`Читать отрывок в книге «${quote.title || "книга"}»`}
              >
                “<MarkedText text={quote.text} match={quote.match} />”
              </button>
            ) : (
              <a
                className="context-excerpt"
                href={quote.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Прочитать «${quote.title || "источник отрывка"}» (новая вкладка)`}
              >
                “<MarkedText text={quote.text} match={quote.match} />”
              </a>
            )}
          </blockquote>
          {quote.translationKind === "summary" && (
            <span className="eyebrow">КОРОТКО ПО-РУССКИ</span>
          )}
          <p>{quote.translation}</p>
          <figcaption>
            {quote.title && <cite>{quote.title}</cite>}
            <p className="context-attribution">
              {quote.author}
              {quote.location && ` · ${quote.location}`}
            </p>
            {quote.note && <p>{quote.note}</p>}
            {quote.bookId && (
              <button
                className="button secondary full"
                onClick={() => setReading(quote)}
              >
                <BookOpen size={16} />
                Читать полный текст в приложении
              </button>
            )}
            <a
              className="context-full-text"
              href={quote.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${quote.bookId ? "Открыть издание" : "Читать полный текст"}: ${quote.title || quote.author}, ${quote.author} (новая вкладка)`}
            >
              {quote.bookId
                ? "Открыть издание Project Gutenberg"
                : "Читать полный текст"}{" "}
              <ExternalLink size={15} aria-hidden="true" />
            </a>
            {quote.bookId && (
              <p className="context-model-note">
                Пояснения и сопоставление значения подготовлены помощником.
              </p>
            )}
          </figcaption>
        </figure>
      ))}
      {status === "loading" && (
        <p role="status" className="book-search-status">
          <LoaderCircle size={17} className="spinning" />
          Ищем употребления в книгах и проверяем значение…
        </p>
      )}
      {status === "not-found" && (
        <p className="muted small" role="status">
          В загруженных книгах подходящий пример этого значения пока не найден.
        </p>
      )}
      {status === "unavailable" && (
        <p className="muted small" role="status">
          Не удалось подобрать книжный пример. Выражение и учебный пример
          сохранены.
        </p>
      )}
      {!available && !shown.length && status === "idle" && (
        <p className="muted small">
          Подбор книжного примера сейчас недоступен. Полные книги можно открыть
          в библиотеке раздела.
        </p>
      )}
      {available && status !== "loading" && (
        <button className="text-button gold" onClick={() => void find()}>
          {status === "unavailable"
            ? "Повторить поиск в книгах"
            : shown.length
              ? "Найти ещё контекст в книгах"
              : "Искать контекст в книгах"}
        </button>
      )}
      {reading?.bookId && (
        <BookReader
          bookId={reading.bookId}
          paragraph={reading.paragraph}
          match={reading.match}
          excerpt={reading.text}
          onClose={() => setReading(null)}
        />
      )}
    </section>
  );
}
