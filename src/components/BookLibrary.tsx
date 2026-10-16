import { useState } from "react";
import { BookOpen } from "lucide-react";
import { BOOK_LIBRARY } from "../bookLibrary";
import Modal from "./Modal";
import BookReader from "./BookReader";

export default function BookLibrary() {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState("");
  return (
    <>
      <div className="book-library-bar panel">
        <span>
          <BookOpen size={18} />
          Контекст из {BOOK_LIBRARY.length} книг
        </span>
        <button className="text-button gold" onClick={() => setOpen(true)}>
          Открыть библиотеку
        </button>
      </div>
      {open && (
        <Modal
          title="Книги для контекста"
          subtitle="Полные английские тексты. Откройте книгу или найдите её отрывки в справке выражений."
          onClose={() => setOpen(false)}
        >
          <div className="word-picker">
            <ul className="word-picker-list">
              {BOOK_LIBRARY.map((book) => (
                <li key={book.id}>
                  <button
                    className="word-picker-option"
                    onClick={() => {
                      setOpen(false);
                      setReading(book.id);
                    }}
                  >
                    <span>
                      <strong lang="en">{book.title}</strong>
                      <span>
                        {book.author} · {book.year}
                      </span>
                    </span>
                    <BookOpen size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
      {reading && (
        <BookReader
          key={reading}
          bookId={reading}
          onClose={() => setReading("")}
        />
      )}
    </>
  );
}
