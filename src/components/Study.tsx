import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Volume2,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Search,
  Shuffle,
  ChevronDown,
  Bookmark,
  BookOpen,
  ExternalLink,
  History,
  MessageCircle,
  Info,
  Clock3,
  CheckCircle2,
  Layers3,
  Plus,
  LoaderCircle,
} from "lucide-react";
import {
  CATALOG,
  PASSAGES,
  PHRASES,
  type Word,
  type Phrase,
  type Passage,
} from "../data";
import {
  makeWord,
  mergeWords,
  normalize,
  optionsFor,
  queueFor,
  recordPractice,
  acceptedAnswers,
  isCorrectAnswer,
  canPractice,
  maskedContext,
  maskedDefinition,
  speak,
  validPhrase,
  validPassage,
  highlightText,
  plural,
} from "../domain";
import type { StudyProps } from "../types";
import WordArt from "./WordArt";
import { materialRequest, useServiceStatus } from "../useMaterials";

import ServiceNotice from "./ServiceNotice";

export function Flashcards({
  store,
  setStore,
  mode,
  notify,
  onHelp,
  onContext,
  onAddWords,
  onNavigate,
  onModeChange,
  storageError,
  now,
}: StudyProps) {
  const [deck, setDeck] = useState(() =>
    queueFor(store.words, mode, store.interests, now).filter(canPractice),
  );
  const [index, setIndex] = useState(0);
  const answered = useRef(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = useRef<HTMLHeadingElement>(null);
  const word = deck[index];
  useEffect(() => {
    if (index > 0) question.current?.focus();
  }, [index]);
  const nextDue = store.words
    .filter(
      (w) => w.dueAt > now && (mode !== "learn" || w.status === "learning"),
    )
    .sort((a, b) => a.dueAt - b.dueAt)[0];
  useEffect(() => {
    onContext(
      word
        ? answer === null
          ? { assessmentLocked: true }
          : { word, assessmentLocked: false }
        : {
            text: "Очередь карточек пуста. Добавьте слова с переводом и иллюстрацией или измените режим.",
          },
    );
  }, [word, answer, onContext]);
  const options = useMemo(
    () => (word ? optionsFor(word, store.words) : []),
    [word],
  );
  const correctAnswers = word ? acceptedAnswers(word) : [];
  const isCorrect = answer !== null && isCorrectAnswer(word, answer);
  const skipped = (
    mode === "learn"
      ? store.words.filter((w) => w.status === "learning")
      : queueFor(store.words, mode, store.interests, now)
  ).filter((w) => !canPractice(w)).length;
  useEffect(() => {
    if (!deck.length && !finished) {
      const eligible = queueFor(store.words, mode, store.interests, now).filter(
        canPractice,
      );
      if (eligible.length) setDeck(eligible);
    }
  }, [store.words, now, mode, store.interests, deck.length, finished]);
  function choose(value: string) {
    if (answered.current || answer !== null || !word) return;
    const at = Date.now();
    const correct = isCorrectAnswer(word, value);
    const result = recordPractice(store, word, correct, at, mode === "new");
    if (result === store) {
      notify("Срок или состояние слова изменились. Обновите очередь.");
      restart();
      return;
    }
    answered.current = true;
    setAnswer(value);
    if (correct) setScore((s) => s + 1);
    setStore((s) => recordPractice(s, word, correct, at, mode === "new"));
  }
  function next() {
    if (index + 1 >= deck.length) {
      setFinished(true);
      return;
    }
    answered.current = false;
    onContext({ assessmentLocked: true });
    setIndex((i) => i + 1);
    setAnswer(null);
  }
  function restart() {
    setDeck(
      queueFor(store.words, mode, store.interests, Date.now()).filter(
        canPractice,
      ),
    );
    answered.current = false;
    setIndex(0);
    setAnswer(null);
    setScore(0);
    setFinished(false);
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input,textarea,select,[role="dialog"]')
      )
        return;
      if (/^[1-6]$/.test(e.key) && answer === null) {
        const value = options[Number(e.key) - 1];
        if (value) choose(value);
      }
      if (
        e.key === "Enter" &&
        answer !== null &&
        !e.repeat &&
        !(e.target instanceof Element && e.target.closest("button,a"))
      ) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  if (!deck.length)
    return (
      <div className="empty-state panel">
        <div className="empty-icon">
          <Layers3 size={30} />
        </div>
        <h2>
          {mode === "review"
            ? "Пока можно выдохнуть"
            : mode === "new"
              ? "Вся подборка уже у вас"
              : store.words.some(
                    (w) => w.status === "learning" && canPractice(w),
                  )
                ? "На сегодня всё по расписанию"
                : "Начнём с ваших слов"}
        </h2>
        <p>
          {mode === "review"
            ? "Сейчас нет слов, которым пора на повторение. Изучаемые слова тоже появятся здесь в назначенный срок."
            : mode === "new"
              ? "Вы добавили все слова из стартовой подборки. Пополните словарь своими."
              : "Новые слова доступны сразу, повторные — только по сроку. Для задания нужны перевод, часть речи и картинка или пример с этим словом."}
        </p>
        {skipped > 0 && (
          <p>
            {skipped} слов пока без задания: добавьте перевод, картинку или
            пример и проверьте синонимы.
          </p>
        )}
        {nextDue && (
          <p className="next-review">
            Ближайшее повторение:{" "}
            {new Date(nextDue.dueAt).toLocaleString("ru-RU", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        )}
        <div className="empty-actions">
          {skipped > 0 ? (
            <button
              className="button primary"
              onClick={() => onNavigate("words")}
            >
              Дополнить карточки
            </button>
          ) : mode === "review" ? (
            <button
              className="button primary"
              onClick={() => onModeChange("learn")}
            >
              Изучать слова
            </button>
          ) : mode === "learn" && nextDue ? (
            <button
              className="button primary"
              onClick={() => onNavigate("reading")}
            >
              Читать со своими словами
            </button>
          ) : (
            <button className="button primary" onClick={onAddWords}>
              Добавить слова
            </button>
          )}
          <button className="button secondary" onClick={restart}>
            <RotateCcw size={16} />
            Проверить очередь
          </button>
        </div>
      </div>
    );
  if (finished)
    return (
      <div className="session-finish panel">
        <div className="celebration">
          <Sparkles size={38} />
        </div>
        <span className="eyebrow">ЕЩЁ ОДИН ШАГ ВПЕРЁД</span>
        <h2>Слова становятся ближе.</h2>
        <p>
          {storageError
            ? "Практика завершена. Прогресс хранится в этой вкладке: сохраните резервную копию через предупреждение вверху страницы."
            : "Практика завершена. Ваш прогресс уже сохранён в этом браузере."}
        </p>
        <div className="finish-stats">
          <div>
            <strong>{deck.length}</strong>
            <span>карточек пройдено</span>
          </div>
          <div>
            <strong>{score}</strong>
            <span>верных ответов</span>
          </div>
          <div>
            <strong>{Math.round((score / deck.length) * 100)}%</strong>
            <span>точность</span>
          </div>
        </div>
        <p className="muted small">
          Ошибка возвращает слово в «Учу», следующая проверка — через 5 минут.
          «Выучил» — после трёх успешных проверок по сроку: через 1 день, затем
          3 дня. Повтор сразу после ответа не повышает статус.
        </p>
        <button className="button primary" onClick={restart}>
          <RotateCcw size={17} />
          Новая практика
        </button>
      </div>
    );
  if (options.length !== 4)
    return (
      <div className="empty-state panel">
        <Info size={28} />
        <h2>Нужны однозначные варианты ответа</h2>
        <p>
          Для этого значения не хватает безопасных неверных вариантов: синонимы
          пересекаются с доступной подборкой. Проверьте значение и список
          синонимов в словаре. Ответ и прогресс не засчитаны.
        </p>
        <button className="button primary" onClick={() => onNavigate("words")}>
          Открыть словарь
        </button>
      </div>
    );
  return (
    <div className="study-layout">
      <div className="flash-panel panel">
        <div className="study-top">
          <span className="eyebrow">
            <span className="status-dot learning" />
            {mode === "review"
              ? "ПОВТОРЯЕМ ЗНАКОМОЕ"
              : mode === "new"
                ? "ОТКРЫВАЕМ НОВОЕ"
                : "ЗАПОМИНАЕМ ЧЕРЕЗ ОБРАЗЫ"}
          </span>
          <span className="muted small">
            {index + 1} <span className="faint">/ {deck.length}</span>
          </span>
        </div>
        <div
          className="thin-progress"
          role="progressbar"
          aria-label="Пройдено карточек"
          aria-valuemin={0}
          aria-valuemax={deck.length}
          aria-valuenow={index + (answer !== null ? 1 : 0)}
        >
          <span style={{ width: `${(index / deck.length) * 100}%` }} />
        </div>
        <div className="flash-illustration">
          {word.image ? (
            <img src={word.image} alt="Иллюстрация к заданию" />
          ) : word.concept ? (
            <WordArt concept={word.concept} />
          ) : (
            <div className="context-art">
              <BookOpen size={54} />
              <span>Слово в контексте</span>
            </div>
          )}
          <span className="image-label">
            {word.image || word.concept ? "ОБРАЗ И КОНТЕКСТ" : "КОНТЕКСТ"}
          </span>
          <button
            className="art-help"
            onClick={() =>
              onHelp(answer === null ? { assessmentLocked: true } : { word })
            }
            aria-label="Справка о слове"
          >
            <HelpCircle size={20} />
          </button>
        </div>
        <div className="flash-content">
          <h2 ref={question} tabIndex={-1}>
            Какое слово здесь спрятано?
          </h2>
          <p className="muted">
            Выберите один подходящий ответ. После ответа покажем все подходящие
            синонимы и перевод.
          </p>
          {maskedDefinition(word) && (
            <p className="card-definition" lang="en">
              {maskedDefinition(word)}
            </p>
          )}
          {maskedContext(word) && (
            <p className="card-context" lang="en">
              {maskedContext(word)}
            </p>
          )}
          {mode === "new" && (
            <p className="muted small">
              Из фиксированной редакционной подборки. Выбранные темы идут
              первыми; уровень и частотность автоматически не оцениваются.
            </p>
          )}
          <div className="answer-grid">
            {options.map((option, i) => {
              const correct = answer !== null && isCorrectAnswer(word, option);
              const wrong = answer === option && !isCorrect;
              return (
                <button
                  key={option}
                  lang="en"
                  aria-label={
                    answer === null
                      ? option
                      : `${option}${correct ? " — правильный вариант" : wrong ? " — неверный ответ" : ""}${answer === option ? ", ваш ответ" : ""}`
                  }
                  disabled={answer !== null}
                  className={`answer-option ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`}
                  onClick={() => choose(option)}
                >
                  <span className="answer-number">
                    {correct ? (
                      <Check size={16} />
                    ) : wrong ? (
                      <X size={16} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {option}
                  {answer === option && (
                    <span className="chosen-label">Ваш ответ</span>
                  )}
                </button>
              );
            })}
          </div>
          {answer !== null ? (
            <div
              className={`answer-feedback ${isCorrect ? "success" : "error"}`}
              role="status"
            >
              <div className="feedback-title">
                {isCorrect ? <CheckCircle2 size={20} /> : <X size={20} />}
                <strong>
                  {isCorrect
                    ? "Верно. Отличная работа!"
                    : "Неверно. Давайте запомним."}
                </strong>
                <button
                  className="icon-button"
                  aria-label="Прослушать слово"
                  onClick={() => {
                    if (!speak(word.word))
                      notify("Озвучка не поддерживается браузером.");
                  }}
                >
                  <Volume2 size={18} />
                </button>
              </div>
              <p>
                {correctAnswers.map((w, i) => (
                  <span key={w}>
                    {i > 0 ? " · " : ""}
                    <b>{w}</b> — {word.translation}
                  </span>
                ))}
              </p>
              {word.example && (
                <p className="feedback-example" lang="en">
                  {word.example}
                </p>
              )}
              {word.exampleRu && (
                <p className="feedback-translation">{word.exampleRu}</p>
              )}
              <p className="feedback-sense">
                Здесь проверяется значение «{word.translation}». Синонимы
                подходят к этому значению, а не ко всем употреблениям слова.
              </p>
              <p className="feedback-schedule">
                Следующая проверка:{" "}
                {new Date(
                  store.words.find(
                    (w) =>
                      w.id === word.id ||
                      (w.word === word.word &&
                        w.translation === word.translation),
                  )?.dueAt || 0,
                ).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </p>
            </div>
          ) : (
            <div className="answer-hint">
              <Info size={15} />
              Сначала доверьтесь образу. Перевод появится после ответа.
            </div>
          )}
          <div className="flash-footer">
            <span className="small muted">
              <Check size={15} />
              {score} верно за практику
            </span>
            <button
              className="button primary"
              disabled={answer === null}
              onClick={next}
            >
              {index + 1 === deck.length ? "Завершить" : "Следующая карточка"}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>
      <aside className="study-aside">
        <div className="aside-note">
          <span className="eyebrow">
            МЕНЬШЕ ЗУБРЁЖКИ.
            <br />
            БОЛЬШЕ СВЯЗЕЙ.
          </span>
          <h3>
            Увидеть.
            <br />
            Узнать.
            <br />
            <em>Запомнить.</em>
          </h3>
          <p>Образы помогают связать новое слово с тем, что уже вам знакомо.</p>
          <div className="note-line" />
          <span className="small muted">
            Не спешите. Один осмысленный ответ полезнее десяти случайных.
          </span>
        </div>
        <div className="panel small-panel">
          <Clock3 size={20} />
          <div>
            <strong>В своём ритме</strong>
            <p>
              После верных ответов: 1, 3, 7, 14, 30, 60, 120, 180 дней. После
              ошибки — 5 минут и начало последовательности заново. Засчитываются
              только ответы по сроку.
            </p>
          </div>
        </div>
        {skipped > 0 && (
          <div className="panel small-panel">
            <Info size={20} />
            <p>
              {skipped} слов пропущено: дополните перевод, иллюстрацию или
              пример в словаре.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
function PhraseDetails({ phrase }: { phrase: Phrase }) {
  return (
    <div className="phrase-details" id={`details-${phrase.id}`}>
      {phrase.generated && (
        <p className="generated-note">
          <Sparkles size={14} />
          Материал подобран помощником. Проверьте употребление по словарю;
          история и цитаты не приписываются источникам.
        </p>
      )}
      <div className="detail-block">
        <span className="detail-icon">
          <MessageCircle size={17} />
        </span>
        <div>
          <h4>Когда и как употреблять</h4>
          <p>{phrase.usage}</p>
        </div>
      </div>
      <div className="detail-block">
        <span className="detail-icon">
          <Info size={17} />
        </span>
        <div>
          <h4>Нюансы и исключения</h4>
          <p>{phrase.exceptions}</p>
        </div>
      </div>
      <div className="detail-block">
        <span className="detail-icon">
          <History size={17} />
        </span>
        <div>
          <h4>История выражения</h4>
          <p>{phrase.origin}</p>
        </div>
      </div>
      <div className="phrase-example">
        <span className="eyebrow">УЧЕБНЫЙ ПРИМЕР · НЕ ЦИТАТА</span>
        <p>“{phrase.example}”</p>
        <span>{phrase.exampleRu}</span>
      </div>
      {phrase.quote && (
        <div className="source-quote">
          <span className="eyebrow">ИЗ ЛИТЕРАТУРЫ</span>
          <blockquote>“{phrase.quote.text}”</blockquote>
          <p>{phrase.quote.translation}</p>
          <a href={phrase.quote.url} target="_blank" rel="noreferrer">
            {phrase.quote.author}
            <ExternalLink size={13} />
          </a>
        </div>
      )}
      <a
        className="source-link"
        href={phrase.source.url}
        target="_blank"
        rel="noreferrer"
      >
        Проверить значение: {phrase.source.label}
        <ExternalLink size={13} />
      </a>
    </div>
  );
}
export function Phrases({
  store,
  setStore,
  mode,
  notify,
  onHelp,
  onContext,
}: StudyProps) {
  const [query, setQuery] = useState("");
  const connection = useServiceStatus();
  const { available } = connection;
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const allPhrases = [...PHRASES, ...store.customPhrases];
  async function findMore() {
    if (!query.trim() || !available || generating) return;
    request.current = new AbortController();
    setGenerating(true);
    setGenerationError("");
    try {
      const data = await materialRequest<{ phrases: Phrase[] }>(
        "phrases",
        { word: query.trim() },
        request.current.signal,
      );
      if (!Array.isArray(data.phrases) || !data.phrases.every(validPhrase))
        throw new Error(
          "Помощник вернул неполный материал. Попробуйте ещё раз.",
        );
      const fresh = data.phrases.filter(
        (p) => !allPhrases.some((v) => normalize(v.text) === normalize(p.text)),
      );
      setStore((s) => ({
        ...s,
        customPhrases: [...s.customPhrases, ...fresh],
      }));
      setOnlySaved(false);
      notify(
        fresh.length
          ? `Добавлено выражений: ${fresh.length}`
          : "Других выражений пока не нашлось. Попробуйте другое слово.",
      );
    } catch (e) {
      if (!request.current?.signal.aborted)
        setGenerationError(
          e instanceof Error ? e.message : "Не удалось получить выражения.",
        );
    } finally {
      setGenerating(false);
    }
  }

  const [onlySaved, setOnlySaved] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const phrases = allPhrases
    .filter(
      (p) =>
        (!onlySaved || store.phraseIds.includes(p.id)) &&
        (!query ||
          [p.text, p.translation, ...p.keywords].some((t) =>
            normalize(t).includes(normalize(query)),
          )),
    )
    .sort((a, b) => a.frequency - b.frequency);
  const contextPhrase = phrases.find((p) => p.id === open) || phrases[0];
  useEffect(() => {
    onContext(
      contextPhrase
        ? { phrase: contextPhrase }
        : {
            text: query
              ? `Выражения со словом ${query}`
              : "Английские устойчивые выражения",
          },
    );
  }, [contextPhrase, query, onContext]);
  function toggle(p: Phrase) {
    const saved = store.phraseIds.includes(p.id);
    setStore((s) => {
      const word = {
        ...makeWord(p.text, p.translation),
        partOfSpeech: "phrase" as const,
      };
      // An idiom's meaning is not the literal meaning of a keyword.
      const concept = "";
      return {
        ...s,
        phraseIds: saved
          ? s.phraseIds.filter((id) => id !== p.id)
          : [...s.phraseIds, p.id],
        words: saved
          ? s.words.filter((w) => w.id !== `phrase-${p.id}`)
          : mergeWords(s.words, [
              {
                ...word,
                id: `phrase-${p.id}`,
                concept,
                example: p.example,
                exampleRu: p.exampleRu,
                definition: p.usage,
              },
            ]).words,
      };
    });
    notify(
      saved ? "Выражение убрано из изучаемых" : "Выражение добавлено в словарь",
    );
  }
  return (
    <>
      <div className="phrase-search panel">
        <div className="search-field">
          <Search size={20} />
          <input
            aria-label="Найти выражения по слову"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите слово: time, book, heart…"
          />
          {query && (
            <button
              className="icon-button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          className="button secondary"
          onClick={() => {
            const choices = queueFor(store.words, mode, store.interests).filter(
              (w) => allPhrases.some((p) => p.keywords.includes(w.word)),
            );
            if (!choices.length) {
              notify(
                "Для ваших слов пока нет выражений в подборке. Попробуйте поиск по time или book.",
              );
              return;
            }
            setQuery(choices[Math.floor(Math.random() * choices.length)].word);
            setOnlySaved(false);
          }}
        >
          <Shuffle size={17} />
          Слово из моего списка
        </button>
      </div>
      <ServiceNotice connection={connection} />
      <div className="assistant-strip">
        <span>
          {available
            ? "Нужны ещё варианты? Подберите выражения для своего слова."
            : "Встроенная подборка доступна сразу. Расширенный поиск — при подключении помощника."}
        </span>
        <button
          className="text-button gold"
          disabled={!available || !query.trim() || generating}
          aria-busy={generating}
          onClick={() => void findMore()}
        >
          {generating ? (
            <LoaderCircle size={14} className="spinning" />
          ) : (
            <Sparkles size={14} />
          )}
          {generating ? "Подбираем…" : "Найти ещё выражения"}
        </button>
      </div>
      {generationError && (
        <p className="form-error" role="alert">
          {generationError}
        </p>
      )}
      <div className="phrase-filter-row">
        <div className="filter-chips">
          {["", "time", "heart", "book", "journey"].map((v) => (
            <button
              key={v}
              className={query === v && !onlySaved ? "active" : ""}
              aria-pressed={query === v && !onlySaved}
              onClick={() => {
                setQuery(v);
                setOnlySaved(false);
              }}
            >
              {v || "Все выражения"}
            </button>
          ))}
        </div>
        <button
          className={`text-button ${onlySaved ? "gold" : ""}`}
          aria-pressed={onlySaved}
          onClick={() => setOnlySaved(!onlySaved)}
        >
          <Bookmark size={15} fill={onlySaved ? "currentColor" : "none"} />
          Учу · {store.phraseIds.length}
        </button>
      </div>
      <div className="list-caption">
        <span>
          {phrases.length}{" "}
          {plural(phrases.length, ["выражение", "выражения", "выражений"])} в
          подборке
        </span>
        <span>
          По распространённости <Info size={13} />
        </span>
      </div>
      <div className="phrase-list">
        {phrases.map((p, i) => (
          <article
            key={p.id}
            className={`phrase-item panel ${open === p.id ? "is-open" : ""}`}
          >
            <div className="phrase-row">
              <span className="phrase-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="phrase-title">
                <h3 lang="en">
                  {p.text}
                  <button
                    className="inline-sound"
                    aria-label={`Прослушать ${p.text}`}
                    onClick={() => {
                      if (!speak(p.text))
                        notify("Озвучка не поддерживается этим браузером.");
                    }}
                  >
                    <Volume2 size={15} />
                  </button>
                </h3>
                <p>{p.translation}</p>
                <span className="frequency">
                  <span /> {p.frequencyLabel}
                </span>
              </div>
              <button
                className={`button learn-phrase ${store.phraseIds.includes(p.id) ? "saved" : "secondary"}`}
                aria-pressed={store.phraseIds.includes(p.id)}
                aria-label={`${store.phraseIds.includes(p.id) ? "Не изучать" : "Учить"}: ${p.text}`}
                onClick={() => toggle(p)}
              >
                {store.phraseIds.includes(p.id) ? (
                  <Check size={15} />
                ) : (
                  <Plus size={15} />
                )}
                {store.phraseIds.includes(p.id) ? "Изучаю" : "Учить"}
              </button>
              <button
                className={`expand-button ${open === p.id ? "expanded" : ""}`}
                aria-expanded={open === p.id}
                aria-controls={open === p.id ? `details-${p.id}` : undefined}
                aria-label={`Подробнее: ${p.text}`}
                onClick={() => setOpen(open === p.id ? null : p.id)}
              >
                <ChevronDown size={20} />
              </button>
            </div>
            {open === p.id && (
              <>
                <PhraseDetails phrase={p} />
                <div className="phrase-bottom">
                  <button
                    className="text-button"
                    onClick={() => onHelp({ phrase: p })}
                  >
                    <HelpCircle size={16} />
                    Спросить об этом выражении
                    <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      {!phrases.length && (
        <div className="empty-state panel">
          <Search size={28} />
          <h2>
            {onlySaved ? "Пока без сохранённых выражений" : "Здесь пока тихо"}
          </h2>
          <p>
            {onlySaved
              ? "Нажмите «Учить» у подходящего выражения — оно появится здесь и в вашем словаре. Если включён поиск, попробуйте очистить его."
              : "В стартовой подборке нет совпадений. Попробуйте time, heart, book, forest или ice."}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setOnlySaved(false);
            }}
          >
            Показать подборку
          </button>
        </div>
      )}
      <p className="content-note">
        <Info size={14} />
        Встроенные выражения — стартовая подборка с источниками. Материалы
        помощника помечены отдельно и требуют проверки. Частотность
        приблизительна. Учебные примеры отделены от цитат; переводы выполнены
        для приложения.
      </p>
    </>
  );
}
export function Reading({
  store,
  setStore,
  mode,
  onHelp,
  onContext,
  notify,
}: StudyProps) {
  const relevant =
    mode === "new"
      ? queueFor(store.words, mode, store.interests)
      : store.words.filter(
          (w) => w.status === (mode === "review" ? "learned" : "learning"),
        );
  const passages = [...PASSAGES, ...store.customPassages];
  const connection = useServiceStatus();
  const { available } = connection;
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const coverage = (text: string) =>
    relevant.filter((w) => highlightText(text, [w]).some((part) => part.word))
      .length;
  const ranked = [...passages].sort(
    (a, b) => coverage(b.text) - coverage(a.text),
  );
  const [passageId, setPassageId] = useState(ranked[0].id);
  const [showTranslation, setShowTranslation] = useState(false);
  const [selected, setSelected] = useState<Word | null>(null);
  const [senseChosen, setSenseChosen] = useState(false);
  const passage = passages.find((p) => p.id === passageId)!;
  const highlighted =
    mode === "new" ? mergeWords(store.words, relevant).words : store.words;
  const matches = highlighted.filter((w) =>
    highlightText(passage.text, [w]).some((part) => part.word),
  );
  const selectedSenses = selected
    ? mergeWords(highlighted, CATALOG).words.filter(
        (w) => normalize(w.word) === normalize(selected.word),
      )
    : [];
  const ambiguous = selectedSenses.length > 1 && !senseChosen;
  useEffect(() => {
    onContext({
      word: selected && !ambiguous ? selected : undefined,
      text: passage.text,
    });
  }, [selected, ambiguous, passage, onContext, store.words]);
  const renderText = (text: string) =>
    highlightText(text, highlighted).map((part, i) =>
      part.word ? (
        <button
          key={i}
          className={`reading-word ${part.word.status === "learned" ? "known" : "learning"} ${selected?.id === part.word.id ? "selected" : ""}`}
          aria-label={`${part.text} — показать значение`}
          aria-pressed={selected?.id === part.word.id}
          onClick={() => {
            setSelected(part.word!);
            setSenseChosen(false);
          }}
        >
          {part.text}
        </button>
      ) : (
        part.text
      ),
    );
  async function createReading() {
    const words = relevant.filter((w) => w.translation).slice(0, 15);
    if (!words.length) {
      notify("Для нового текста добавьте слова с переводом.");
      return;
    }
    if (!available || generating) return;
    request.current = new AbortController();
    setGenerating(true);
    setGenerationError("");
    try {
      const data = await materialRequest<{ passage: Passage }>(
        "reading",
        {
          words: words.map((w) => ({
            word: w.word,
            translation: w.translation,
          })),
        },
        request.current.signal,
      );
      if (!validPassage(data.passage))
        throw new Error("Помощник вернул неполный текст. Попробуйте ещё раз.");
      setStore((s) => ({
        ...s,
        customPassages: [...s.customPassages, data.passage],
      }));
      setPassageId(data.passage.id);
      setSelected(null);
      setShowTranslation(false);
      notify("Новая история готова и сохранена");
    } catch (e) {
      if (!request.current?.signal.aborted)
        setGenerationError(
          e instanceof Error ? e.message : "Не удалось создать текст.",
        );
    } finally {
      setGenerating(false);
    }
  }
  return (
    <div className="reading-layout">
      <article className="reading-paper panel">
        <div className="reading-toolbar">
          <span className="reading-type">
            <BookOpen size={16} />
            {passage.type}
          </span>
          <span className="level-badge">{passage.level}</span>
        </div>
        <div className="reading-title">
          <span className="eyebrow">A SMALL STORY. A BIGGER VOCABULARY.</span>
          <h2>{passage.title}</h2>
          <p>{passage.subtitle}</p>
        </div>
        <div className="reading-meta">
          <span>
            <Clock3 size={14} />2 минуты
          </span>
          <span>
            <Bookmark size={14} />
            {matches.length} значений из{" "}
            {mode === "new" ? "словаря и новой подборки" : "вашего словаря"}
          </span>
        </div>
        <div className="reading-text" lang="en">
          {passage.text.split("\n\n").map((p, i) => (
            <p key={i}>{renderText(p)}</p>
          ))}
        </div>
        <button
          className="translation-toggle"
          aria-expanded={showTranslation}
          aria-controls={showTranslation ? "reading-translation" : undefined}
          onClick={() => setShowTranslation(!showTranslation)}
        >
          {showTranslation ? "Скрыть перевод" : "Показать перевод"}
          <ChevronDown size={16} />
        </button>
        {showTranslation && (
          <div className="reading-translation" id="reading-translation">
            {passage.translation.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        <div className="reading-bottom">
          <span className="small muted">
            {passages.findIndex((p) => p.id === passage.id) + 1} /{" "}
            {passages.length} историй
          </span>
          <div className="row-buttons">
            <button
              className="icon-button"
              aria-label="Предыдущий текст"
              onClick={() => {
                setPassageId(
                  passages[
                    (passages.findIndex((p) => p.id === passage.id) +
                      passages.length -
                      1) %
                      passages.length
                  ].id,
                );
                setSelected(null);
                setShowTranslation(false);
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setPassageId(
                  passages[
                    (passages.findIndex((p) => p.id === passage.id) + 1) %
                      passages.length
                  ].id,
                );
                setSelected(null);
                setShowTranslation(false);
              }}
            >
              Другая история
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </article>
      <aside className="reading-aside">
        <div className="panel reading-generator">
          <span className="eyebrow">
            <Sparkles size={14} />
            ИСТОРИЯ ИЗ ВАШИХ СЛОВ
          </span>
          <p>Новый небольшой текст с лексикой из выбранного режима.</p>
          <ServiceNotice connection={connection} />
          <button
            className="button secondary full"
            disabled={
              !available || generating || !relevant.some((w) => w.translation)
            }
            aria-busy={generating}
            onClick={() => void createReading()}
          >
            {generating ? (
              <LoaderCircle size={15} className="spinning" />
            ) : (
              <Plus size={15} />
            )}
            {generating ? "Пишем историю…" : "Создать текст"}
          </button>
          {!relevant.some((w) => w.translation) && (
            <p className="generator-caption">
              В этом режиме нет слов с переводом. Добавьте слова или выберите
              другой режим. Готовые истории можно читать сразу.
            </p>
          )}
          {generationError && (
            <p className="form-error" role="alert">
              {generationError}
            </p>
          )}
        </div>
        <div className="panel small-panel reading-legend">
          <span className="eyebrow">ЗНАКОМЫЕ СЛОВА РЯДОМ</span>
          <p>Нажмите на выделенное слово, чтобы вспомнить его значение.</p>
          <p>
            Подсветка ищет совпадения в написании. Подходящее к контексту
            значение выберите сами; чтение не повышает статус слова.
          </p>
          <div>
            <span className="legend-sample learning">учу</span>
            <span className="legend-sample known">знаю</span>
          </div>
        </div>
        {selected ? (
          <div
            className="panel reading-definition"
            role="region"
            aria-label={`Значение: ${selected.word}`}
            aria-live="polite"
          >
            <div className="section-label">
              <span className="eyebrow">СЛОВО ИЗ ТЕКСТА</span>
              <button
                className="icon-button"
                aria-label="Закрыть значение"
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </button>
            </div>
            <h3>
              {selected.word}
              <button
                className="icon-button"
                aria-label="Прослушать выбранное слово"
                onClick={() => {
                  if (!speak(selected.word))
                    notify("Озвучка не поддерживается браузером.");
                }}
              >
                <Volume2 size={18} />
              </button>
            </h3>
            {selected.phonetic && (
              <span className="phonetic">/{selected.phonetic}/</span>
            )}
            {selectedSenses.length > 1 && (
              <div className="sense-picker">
                <p>
                  В словаре и подборке несколько значений. Выберите подходящее к
                  тексту — автоматически значение не определяется.
                </p>
                {selectedSenses.map((w) => (
                  <button
                    className="button secondary"
                    key={w.id}
                    aria-pressed={senseChosen && w.id === selected.id}
                    onClick={() => {
                      setSelected(w);
                      setSenseChosen(true);
                    }}
                  >
                    {w.translation}
                  </button>
                ))}
              </div>
            )}
            {!ambiguous && (
              <>
                <p className="word-translation">{selected.translation}</p>
                {selected.definition && <p>{selected.definition}</p>}
              </>
            )}
            <button
              className="text-button gold"
              disabled={ambiguous}
              onClick={() => onHelp({ word: selected, text: passage.text })}
            >
              Спросить о слове
              <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <div className="aside-note">
            <span className="quote-mark">“</span>
            <h3>
              Не каждое слово.
              <br />
              <em>Сначала — смысл.</em>
            </h3>
            <p>
              Попробуйте прочитать историю целиком, а затем вернуться к
              незнакомым словам.
            </p>
          </div>
        )}
        <div className="reading-selector">
          <span className="eyebrow">В ЭТОЙ ПОДБОРКЕ</span>
          {ranked.map((p, i) => (
            <button
              key={p.id}
              className={p.id === passage.id ? "active" : ""}
              aria-pressed={p.id === passage.id}
              onClick={() => {
                setPassageId(p.id);
                setSelected(null);
                setShowTranslation(false);
              }}
            >
              <span>0{i + 1}</span>
              <div>
                {p.title}
                <small>{p.level} · 2 мин</small>
              </div>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
