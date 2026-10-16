import { useEffect, useRef, useState } from "react";
import { Sparkles, LoaderCircle } from "lucide-react";
import Modal from "./Modal";
import ServiceNotice from "./ServiceNotice";
import { materialRequest, useServiceStatus } from "../useMaterials";
import { TOPICS, type Topic, type Word } from "../data";
import { mergeWords, validWord } from "../domain";
import { canPractice } from "../learning";
import type { StudyProps } from "../types";
export default function GeneratedWords({
  store,
  setStore,
  notify,
  onClose,
}: Pick<StudyProps, "store" | "setStore" | "notify"> & {
  onClose: () => void;
}) {
  const connection = useServiceStatus();
  const [topic, setTopic] = useState<Topic>(store.interests[0] || "everyday");
  const [request, setRequest] = useState(
    "Полезные слова для повседневного общения",
  );
  const [words, setWords] = useState<Word[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function generate() {
    if (busy || !connection.available || !request.trim()) return;
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const data = await materialRequest<{ words: Word[] }>(
        "words",
        {
          topic,
          request: request.trim(),
          exclude: [
            ...new Set([
              ...store.words.slice(-100).map((w) => w.word),
              ...words.map((w) => w.word),
            ]),
          ].slice(-100),
        },
        abort.current.signal,
      );
      if (
        !Array.isArray(data.words) ||
        data.words.length > 10 ||
        !data.words.every(
          (w) => validWord(w) && w.generated === true && canPractice(w),
        )
      )
        throw new Error("Помощник вернул неполные карточки. Повторите запрос.");
      const fresh = mergeWords(store.words, data.words).words.slice(
        store.words.length,
      );
      if (!fresh.length)
        throw new Error(
          "Новых значений не нашлось. Уточните тему и повторите.",
        );
      setWords(fresh);
      setChosen(fresh.map((w) => w.id));
    } catch (e) {
      if (!abort.current?.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Не удалось подобрать слова.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Подобрать слова с ИИ"
      subtitle="Небольшая подборка по вашей теме. Добавляйте только нужное."
      onClose={onClose}
      wide
    >
      <div className="form-body">
        <ServiceNotice connection={connection} />
        <p className="muted small">
          Это материал подключённой языковой модели. Перевод и пример могут
          содержать ошибки; проверьте их перед сохранением. Новые рисунки здесь
          не создаются.
        </p>
        <p className="muted small">
          Для исключения повторов в запрос включаются до 100 последних слов.
        </p>
        <label>
          Направление
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value as Topic)}
            disabled={busy}
          >
            {Object.entries(TOPICS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Какие слова подобрать?
          <textarea
            maxLength={200}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            disabled={busy}
            rows={3}
          />
        </label>
        <button
          className="button primary"
          disabled={busy || !connection.available || !request.trim()}
          aria-busy={busy}
          onClick={() => void generate()}
        >
          {busy ? (
            <LoaderCircle className="spinning" size={16} />
          ) : (
            <Sparkles size={16} />
          )}{" "}
          {busy
            ? "Подбираем слова…"
            : words.length
              ? "Подобрать ещё"
              : "Создать до 10 карточек"}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!!words.length && (
          <fieldset className="generated-word-list">
            <legend>Выберите слова для изучения</legend>
            {words.map((w) => (
              <label className="generated-word-choice" key={w.id}>
                <input
                  type="checkbox"
                  aria-label={`Добавить ${w.word}`}
                  checked={chosen.includes(w.id)}
                  disabled={busy}
                  onChange={() =>
                    setChosen((ids) =>
                      ids.includes(w.id)
                        ? ids.filter((id) => id !== w.id)
                        : [...ids, w.id],
                    )
                  }
                />
                <span>
                  <strong lang="en">{w.word}</strong> — {w.translation}
                  <span className="generated-word-example" lang="en">
                    {w.example}
                  </span>
                  <span className="muted small">{w.exampleRu}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {!!words.length && (
          <button
            className="button primary full"
            disabled={busy || !chosen.length}
            onClick={() => {
              const selected = words.filter((w) => chosen.includes(w.id));
              const count = mergeWords(store.words, selected).added;
              if (!count) {
                setError("Эти значения уже добавлены.");
                return;
              }
              setStore((s) => ({
                ...s,
                words: mergeWords(s.words, selected).words,
              }));
              notify(
                `Добавлено значений: ${count}. Откройте «Учу сейчас» для практики.`,
              );
              onClose();
            }}
          >
            Добавить выбранные · {chosen.length}
          </button>
        )}
      </div>
    </Modal>
  );
}
