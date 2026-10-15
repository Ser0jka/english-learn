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
  reviewWord,
  speak,
  validPhrase,
  validPassage,
  highlightText,
  plural,
} from "../domain";
import type { StudyProps } from "../types";
import WordArt from "./WordArt";
import { materialRequest, useCapabilities } from "../useMaterials";

export function Flashcards({
  store,
  setStore,
  mode,
  notify,
  onHelp,
  onContext,
}: StudyProps) {
  const [deck, setDeck] = useState(() =>
    queueFor(store.words, mode, store.interests).filter(
      (w) => (w.concept || w.image) && w.translation,
    ),
  );
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const word = deck[index];
  useEffect(() => {
    if (word) onContext({ word });
  }, [word, onContext]);
  const options = useMemo(() => (word ? optionsFor(word) : []), [word]);
  const correctAnswers = word ? [word.word, ...word.synonyms] : [];
  const isCorrect = answer !== null && correctAnswers.includes(answer);
  const skipped = queueFor(store.words, mode, store.interests).filter(
    (w) => !(w.concept || w.image) || !w.translation,
  ).length;
  function choose(value: string) {
    if (answer !== null || !word) return;
    setAnswer(value);
    const correct = correctAnswers.includes(value);
    if (correct) setScore((s) => s + 1);
    setStore((s) => {
      const existing = s.words.find(
        (w) => normalize(w.word) === normalize(word.word),
      );
      const updated = reviewWord(
        existing || { ...word, addedAt: Date.now() },
        correct,
      );
      return {
        ...s,
        words: existing
          ? s.words.map((w) => (w.id === existing.id ? updated : w))
          : [...s.words, updated],
        logs: [...s.logs, { at: Date.now(), wordId: updated.id, correct }],
      };
    });
  }
  function next() {
    if (index + 1 >= deck.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
  }
  function restart() {
    setDeck(
      queueFor(store.words, mode, store.interests).filter(
        (w) => (w.concept || w.image) && w.translation,
      ),
    );
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
      if (e.key === "Enter" && answer !== null) {
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
              : "Начнём с ваших слов"}
        </h2>
        <p>
          {mode === "review"
            ? "На сегодня нет выученных слов, которым пора на повторение."
            : mode === "new"
              ? "Вы добавили все слова из стартовой подборки. Пополните словарь своими."
              : "Для карточек нужны слова с переводом и иллюстрацией. Добавьте их в разделе «Мои слова»."}
        </p>
        {skipped > 0 && (
          <p>
            {skipped} слов без перевода или изображения: дополните их в словаре.
          </p>
        )}
        <button className="button secondary" onClick={restart}>
          <RotateCcw size={16} />
          Проверить очередь
        </button>
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
        <p>Практика завершена. Ваш прогресс уже сохранён.</p>
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
          После ошибки слово возвращается в изучение. После трёх верных ответов
          подряд — переходит в выученные.
        </p>
        <button className="button primary" onClick={restart}>
          <RotateCcw size={17} />
          Новая практика
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
        <div className="thin-progress">
          <span style={{ width: `${(index / deck.length) * 100}%` }} />
        </div>
        <div className="flash-illustration">
          {word.image ? (
            <img src={word.image} alt="Иллюстрация к заданию" />
          ) : (
            <WordArt concept={word.concept} />
          )}
          <span className="image-label">
            {word.level} <span>•</span> VISUAL MEMORY
          </span>
          <button
            className="art-help"
            onClick={() => onHelp({ word })}
            aria-label="Справка о слове"
          >
            <HelpCircle size={20} />
          </button>
        </div>
        <div className="flash-content">
          <h2>Какое слово здесь спрятано?</h2>
          <p className="muted">
            Выберите подходящий ответ. Правильных вариантов может быть
            несколько.
          </p>
          <div className="answer-grid">
            {options.map((option, i) => {
              const correct =
                answer !== null && correctAnswers.includes(option);
              const wrong = answer === option && !isCorrect;
              return (
                <button
                  key={option}
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
                <p className="feedback-example">{word.example}</p>
              )}
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
              Повторения назначаются через 1, 3, 7, 14 и 30 дней после верных
              ответов.
            </p>
          </div>
        </div>
        {skipped > 0 && (
          <div className="panel small-panel">
            <Info size={20} />
            <p>
              {skipped} слов пропущено: добавьте перевод или картинку в словаре.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
function PhraseDetails({ phrase }: { phrase: Phrase }) {
  return (
    <div className="phrase-details">
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
  const available = useCapabilities();
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
      const word = makeWord(p.text, p.translation);
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
      <div className="assistant-strip">
        <span>
          {available
            ? "Нужны ещё варианты? Подберите выражения для своего слова."
            : "Встроенная подборка доступна сразу. Расширенный поиск — при подключении помощника."}
        </span>
        <button
          className="text-button gold"
          disabled={!available || !query.trim() || generating}
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
                <h3>
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
            В стартовой подборке нет совпадений. Попробуйте time, heart, book,
            forest или ice.
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
  const available = useCapabilities();
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
  const passage = passages.find((p) => p.id === passageId)!;
  const highlighted = mode === "new" ? relevant : store.words;
  const matches = highlighted.filter((w) =>
    highlightText(passage.text, [w]).some((part) => part.word),
  );
  useEffect(() => {
    onContext({ word: selected || matches[0], text: passage.text });
  }, [selected, passage, onContext, store.words]);
  const renderText = (text: string) =>
    highlightText(text, highlighted).map((part, i) =>
      part.word ? (
        <button
          key={i}
          className={`reading-word ${part.word.status === "learned" ? "known" : "learning"} ${selected?.id === part.word.id ? "selected" : ""}`}
          onClick={() => setSelected(part.word!)}
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
            {matches.length} слов из{" "}
            {mode === "new" ? "новой подборки" : "вашего словаря"}
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
          onClick={() => setShowTranslation(!showTranslation)}
        >
          {showTranslation ? "Скрыть перевод" : "Показать перевод"}
          <ChevronDown size={16} />
        </button>
        {showTranslation && (
          <div className="reading-translation">
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
          <button
            className="button secondary full"
            disabled={
              !available || generating || !relevant.some((w) => w.translation)
            }
            onClick={() => void createReading()}
          >
            {generating ? (
              <LoaderCircle size={15} className="spinning" />
            ) : (
              <Plus size={15} />
            )}
            {generating ? "Пишем историю…" : "Создать текст"}
          </button>
          {!available && (
            <span className="generator-caption">
              Доступно при подключении помощника. Ниже — готовые истории.
            </span>
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
          <div>
            <span className="legend-sample learning">учу</span>
            <span className="legend-sample known">знаю</span>
          </div>
        </div>
        {selected ? (
          <div className="panel reading-definition">
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
            <p className="word-translation">{selected.translation}</p>
            {selected.definition && <p>{selected.definition}</p>}
            <button
              className="text-button gold"
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
