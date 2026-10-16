import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";
import Modal from "./Modal";
import {
  BOOK_LIBRARY,
  loadBook,
  locateBookParagraph,
  type BookData,
} from "../bookLibrary";

export function MarkedText({ text, match }: { text: string; match?: string }) {
  if (!match || !text.includes(match)) return <>{text}</>;
  return (
    <>
      {text.split(match).map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <mark>{match}</mark>}
          {part}
        </Fragment>
      ))}
    </>
  );
}

export default function BookReader({
  bookId,
  paragraph = 0,
  match,
  excerpt,
  onClose,
}: {
  bookId: string;
  paragraph?: number;
  match?: string;
  excerpt?: string;
  onClose: () => void;
}) {
  const metadata = BOOK_LIBRARY.find((book) => book.id === bookId);
  const [book, setBook] = useState<BookData | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(Math.floor(paragraph / 30));
  const [selectedParagraph, setSelectedParagraph] = useState(paragraph);
  const passage = useRef<HTMLParagraphElement>(null);
  const top = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    setError("");
    loadBook(bookId)
      .then((data) => {
        if (!active) return;
        const actual = locateBookParagraph(data, paragraph, excerpt);
        if (actual < 0) {
          setError(
            "Этот отрывок отсутствует в текущем издании. Открыто начало книги.",
          );
          setPage(0);
          setSelectedParagraph(-1);
          setBook(data);
          return;
        }
        setSelectedParagraph(actual);
        setPage(Math.floor(actual / 30));
        setBook(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Не удалось открыть книгу. Проверьте соединение и повторите.",
          );
      });
    return () => {
      active = false;
    };
  }, [bookId, paragraph, excerpt, revision]);
  useEffect(() => {
    if (!book) return;
    const frame = requestAnimationFrame(() => {
      const target = passage.current || top.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: passage.current ? "center" : "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [book, page]);
  const total = book ? Math.ceil(book.paragraphs.length / 30) : 0;
  return (
    <Modal
      title={metadata?.title || "Книга"}
      subtitle={
        metadata
          ? `${metadata.author} · ${metadata.year} · полный английский текст`
          : undefined
      }
      onClose={onClose}
      className="modal-book"
      wide
    >
      <div className="book-reader">
        {!book && !error && (
          <p className="book-loading" role="status">
            <LoaderCircle className="spinning" size={20} />
            Открываем книгу…
          </p>
        )}
        {error && (
          <div role="alert">
            <p>{error}</p>
            {!book && (
              <button
                className="button secondary"
                onClick={() => setRevision((value) => value + 1)}
              >
                Повторить загрузку
              </button>
            )}
            {metadata && (
              <a
                className="button secondary"
                href={metadata.source}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть оригинал
              </a>
            )}
          </div>
        )}
        {book && (
          <>
            <div className="book-page-controls">
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setPage(0)}
              >
                Начало книги
              </button>
              <span role="status">
                Страница {page + 1} из {total}
              </span>
            </div>
            <h3 ref={top} tabIndex={-1} className="book-page-heading">
              Абзацы {page * 30 + 1}–
              {Math.min((page + 1) * 30, book.paragraphs.length)}
            </h3>
            <div className="book-prose" lang="en">
              {book.paragraphs
                .slice(page * 30, (page + 1) * 30)
                .map((item, index) => {
                  const isPassage = page * 30 + index === selectedParagraph;
                  return (
                    <p
                      key={page * 30 + index}
                      ref={isPassage ? passage : undefined}
                      tabIndex={isPassage ? -1 : undefined}
                      className={
                        isPassage && match ? "book-selected-passage" : undefined
                      }
                    >
                      <MarkedText text={item.text} match={match} />
                    </p>
                  );
                })}
            </div>
            <nav className="book-page-controls" aria-label="Страницы книги">
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                <ArrowLeft size={16} />
                Назад
              </button>
              <button
                className="button primary"
                disabled={page >= total - 1}
                onClick={() => setPage((value) => value + 1)}
              >
                Дальше
                <ArrowRight size={16} />
              </button>
            </nav>
            <p className="muted small">
              Оригинальный текст {book.year} года. Переводы и пояснения в
              карточках подготовлены отдельно.
            </p>
            <div className="book-source-links">
              <a href={book.source} target="_blank" rel="noopener noreferrer">
                Издание Project Gutenberg <ExternalLink size={14} />
              </a>
              <a href={`/data/books/${bookId}.txt`} download>
                Скачать полный текст с лицензией
              </a>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
