import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import type { Word } from "../data";
import { normalize } from "../domain";
import Modal from "./Modal";

export default function WordPicker({
  words,
  onPick,
  onAdd,
  onClose,
}: {
  words: Word[];
  onPick: (word: Word) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(30);
  const matches = useMemo(() => {
    const query = normalize(search);
    return words
      .filter((word) =>
        [word.word, word.translation].some((value) =>
          normalize(value).includes(query),
        ),
      )
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [words, search]);
  return (
    <Modal
      title="Выберите своё слово"
      subtitle="Найдите выражения для любого слова из вашего словаря."
      onClose={onClose}
    >
      <div className="word-picker">
        <div className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            data-autofocus
            aria-label="Найти своё слово или перевод"
            placeholder="Слово или перевод"
            maxLength={300}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(30);
            }}
          />
        </div>
        <p className="muted small" role="status">
          Найдено: {matches.length}
        </p>
        <ul className="word-picker-list">
          {matches.slice(0, limit).map((word) => (
            <li key={word.id}>
              <button
                className="word-picker-option"
                onClick={() => onPick(word)}
              >
                <span>
                  <strong lang="en">{word.word}</strong>
                  <span>{word.translation}</span>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {!matches.length && (
          <p className="muted">
            {words.length
              ? "Совпадений нет. Попробуйте другой запрос или добавьте слово."
              : "Здесь появятся ваши слова. Добавьте одно или загрузите список."}
          </p>
        )}
        {matches.length > limit && (
          <button
            className="button secondary full"
            onClick={() => setLimit((value) => value + 30)}
          >
            Показать ещё слова
          </button>
        )}
        <button className="button primary full" onClick={onAdd}>
          <Plus size={17} />
          Добавить слово
        </button>
      </div>
    </Modal>
  );
}
