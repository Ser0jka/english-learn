import GeneratedWords from "./GeneratedWords";
import WordPicker from "./WordPicker";
import BookContexts from "./BookContexts";
import BookLibrary from "./BookLibrary";
import { contextSignature } from "../bookLibrary";
import { PHRASE_BANK } from "../phraseBank";
import { useWordLibrary } from "../useLibrary";
import LibraryNotice from "./LibraryNotice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canFindExpressions,
  englishQuery,
  expressionMeanings,
  phraseMatchesQuery,
} from "../phraseSearch";
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
  studySessionFor,
  recordPractice,
  acceptedAnswers,
  isCorrectAnswer,
  canPractice,
  maskedContext,
  maskedDefinition,
  meaningKey,
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
import { bankEntry } from "../wordBank";

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
  const [generateOpen, setGenerateOpen] = useState(false);
  const vocabulary = useRef(store.words);
  const [deck, setDeck] = useState(() =>
    studySessionFor(store.words, mode, store.interests, now),
  );
  const [index, setIndex] = useState(0);
  const answered = useRef(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const word = deck[index];
  useEffect(() => {
    if (answer === null || !window.matchMedia("(max-width: 760px)").matches)
      return;
    const frame = requestAnimationFrame(() => {
      feedback.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [answer]);
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
    () => (word ? optionsFor(word, vocabulary.current) : []),
    [word],
  );
  const correctAnswers = word ? acceptedAnswers(word) : [];
  const isCorrect = answer !== null && isCorrectAnswer(word, answer);
  const skipped =
    mode === "new"
      ? 0
      : (mode === "learn"
          ? store.words.filter((w) => w.status === "learning")
          : queueFor(store.words, mode, store.interests, now)
        ).filter((w) => !canPractice(w)).length;
  useEffect(() => {
    if (!deck.length && !finished) {
      const eligible = studySessionFor(store.words, mode, store.interests, now);
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
    vocabulary.current = store.words;
    setDeck(studySessionFor(store.words, mode, store.interests, Date.now()));
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
              ? "Вы добавили все доступные значения из подборки. Пополните словарь своими."
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
      {generateOpen && (
        <GeneratedWords
          store={store}
          setStore={setStore}
          notify={notify}
          onClose={() => setGenerateOpen(false)}
        />
      )}
      {mode === "new" && (
        <div className="study-actions">
          <button
            className="button secondary"
            onClick={() => setGenerateOpen(true)}
          >
            <Sparkles size={16} />
            Подобрать слова с ИИ
          </button>
        </div>
      )}
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
        <div
          className={`flash-illustration${word.image || word.concept ? "" : " definition-illustration"}`}
        >
          {word.image ? (
            <img src={word.image} alt="Иллюстрация к заданию" />
          ) : word.concept ? (
            <WordArt concept={word.concept} />
          ) : (
            <div className="context-art">
              <BookOpen size={54} />
              <span>
                {bankEntry(word) ? "Словарное значение" : "Слово в контексте"}
              </span>
            </div>
          )}
          <span className="image-label">
            {word.image || word.concept
              ? "ОБРАЗ И КОНТЕКСТ"
              : bankEntry(word)
                ? "ОПРЕДЕЛЕНИЕ"
                : "КОНТЕКСТ"}
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
            Выберите слово. Перевод и подходящие синонимы появятся после ответа.
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
              ref={feedback}
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
              Верные ответы увеличивают интервал. После ошибки слово скоро
              вернётся на повторение.
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
function PhraseDetails({
  phrase,
  store,
  setStore,
  available,
}: Pick<StudyProps, "store" | "setStore"> & {
  phrase: Phrase;
  available: boolean;
}) {
  return (
    <div className="phrase-details" id={`details-${phrase.id}`}>
      {phrase.generated && (
        <p className="generated-note">
          <Sparkles size={14} />
          Подобрано ИИ
        </p>
      )}
      <div className="detail-block">
        <span className="detail-icon">
          <MessageCircle size={17} />
        </span>
        <div>
          <h4>{phrase.dictionary ? "Значение" : "Когда и как употреблять"}</h4>
          {!phrase.dictionary && <p>{phrase.usage}</p>}
          {phrase.definition && <p lang="en">{phrase.definition}</p>}
        </div>
      </div>
      {!phrase.dictionary && phrase.exceptions.trim() && (
        <div className="detail-block">
          <span className="detail-icon">
            <Info size={17} />
          </span>
          <div>
            <h4>Нюансы и исключения</h4>
            <p>{phrase.exceptions}</p>
          </div>
        </div>
      )}
      {!phrase.dictionary && (
        <div className="detail-block">
          <span className="detail-icon">
            <History size={17} />
          </span>
          <div>
            <h4>История выражения</h4>
            <p>{phrase.origin}</p>
          </div>
        </div>
      )}
      {phrase.example ? (
        <div className="phrase-example">
          <span className="eyebrow">
            {phrase.dictionary
              ? "СЛОВАРНЫЙ ПРИМЕР"
              : phrase.generated
                ? "УЧЕБНЫЙ ПРИМЕР ПОМОЩНИКА"
                : "УЧЕБНЫЙ ПРИМЕР"}
          </span>
          <p lang="en">“{phrase.example}”</p>
          {phrase.exampleRu && <span>{phrase.exampleRu}</span>}
        </div>
      ) : null}
      <BookContexts
        phrase={phrase}
        store={store}
        setStore={setStore}
        available={available}
      />
      <a
        className="source-link"
        href={phrase.source.url}
        target="_blank"
        rel="noreferrer"
      >
        Открыть словарь
        <ExternalLink size={13} />
      </a>
    </div>
  );
}
export function Phrases({
  store,
  setStore,
  notify,
  onHelp,
  onContext,
  onAddWords,
  initialWord,
}: StudyProps & { initialWord?: Word | null }) {
  const [query, setQuery] = useState(initialWord?.word || "");
  const [selectedWord, setSelectedWord] = useState(initialWord || null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const connection = useServiceStatus();
  const { available } = connection;
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const request = useRef<AbortController | null>(null);
  const attempted = useRef(new Set<string>());
  const [composing, setComposing] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  useWordLibrary("words", Boolean(query.trim()));
  const phraseLibrary = useWordLibrary("phrases");
  const [visible, setVisible] = useState(24);
  const allPhrases = useMemo(
    () =>
      [
        ...PHRASES,
        ...(phraseLibrary.status === "ready" ? PHRASE_BANK : []),
        ...store.customPhrases,
      ].map((phrase) => {
        const cached = store.bookContexts?.[phrase.id];
        return cached?.signature === contextSignature(phrase)
          ? { ...phrase, bookQuotes: cached.quotes }
          : phrase;
      }),
    [store.customPhrases, store.bookContexts, phraseLibrary.status],
  );
  const personalWords = useMemo(() => {
    const seen = new Set<string>();
    return [...store.words]
      .sort((a, b) => b.addedAt - a.addedAt)
      .filter((word) => {
        const spelling = normalize(word.word);
        if (seen.has(spelling)) return false;
        seen.add(spelling);
        return true;
      })
      .slice(0, 6);
  }, [store.words]);
  function search(value: string, word: Word | null = null, resetSaved = true) {
    request.current?.abort();
    request.current = null;
    setGenerating(false);
    setGenerationError("");
    setQuery(value);
    setSelectedWord(word);
    if (resetSaved) setOnlySaved(false);
    setOpen(null);
  }
  const requestKey = JSON.stringify([
    englishQuery(query),
    selectedWord?.translation || "",
  ]);
  const findMore = useCallback(async () => {
    if (!canFindExpressions(query) || !available || request.current) return;
    attempted.current.add(requestKey);
    const controller = new AbortController();
    request.current = controller;
    setGenerating(true);
    setGenerationError("");
    try {
      const data = await materialRequest<{ phrases: Phrase[] }>(
        "phrases",
        {
          word: englishQuery(query),
          ...(selectedWord ? { translation: selectedWord.translation } : {}),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!Array.isArray(data.phrases) || !data.phrases.every(validPhrase))
        throw new Error(
          "Помощник вернул неполный материал. Попробуйте ещё раз.",
        );
      const fresh = data.phrases.filter(
        (p) =>
          !allPhrases.some(
            (v) =>
              normalize(v.text) === normalize(p.text) &&
              normalize(v.translation) === normalize(p.translation),
          ),
      );
      setStore((s) => ({
        ...s,
        customPhrases: [
          ...s.customPhrases,
          ...fresh.filter(
            (p) =>
              !s.customPhrases.some(
                (v) =>
                  normalize(v.text) === normalize(p.text) &&
                  normalize(v.translation) === normalize(p.translation),
              ),
          ),
        ],
      }));
      setOnlySaved(false);
      notify(
        fresh.length
          ? `Добавлено выражений: ${fresh.length}`
          : "Других выражений пока не нашлось. Попробуйте другое слово.",
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setGenerationError(
          e instanceof Error ? e.message : "Не удалось получить выражения.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setGenerating(false);
      }
    }
  }, [
    query,
    available,
    requestKey,
    selectedWord,
    allPhrases,
    setStore,
    notify,
  ]);

  const [onlySaved, setOnlySaved] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setVisible(24), [query, onlySaved]);
  const phrases = allPhrases
    .filter(
      (p) =>
        (!onlySaved || store.phraseIds.includes(p.id)) &&
        phraseMatchesQuery(p, query),
    )
    .sort((a, b) => a.frequency - b.frequency);
  const matchingCount = allPhrases.filter((phrase) =>
    phraseMatchesQuery(phrase, query),
  ).length;
  const meanings = expressionMeanings(query, store.words);
  const results = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !available ||
      onlySaved ||
      generating ||
      composing ||
      phraseLibrary.status === "loading" ||
      matchingCount > 0 ||
      englishQuery(query).length < 2 ||
      !canFindExpressions(query) ||
      attempted.current.has(requestKey)
    )
      return;
    const timer = window.setTimeout(() => {
      if (!composing) void findMore();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    available,
    onlySaved,
    generating,
    phraseLibrary.status,
    matchingCount,
    query,
    requestKey,
    findMore,
    composing,
  ]);
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
        sourcePhraseId: p.id,
      };
      // An idiom's meaning is not the literal meaning of a keyword.
      const concept = "";
      return {
        ...s,
        phraseIds: saved
          ? s.phraseIds.filter((id) => id !== p.id)
          : [...s.phraseIds, p.id],
        words: saved
          ? s.words.filter((w) => meaningKey(w) !== meaningKey(word))
          : mergeWords(s.words, [
              {
                ...word,
                id: `phrase-${p.id}`,
                concept,
                example: p.example,
                exampleRu: p.exampleRu,
                definition: word.bankId ? word.definition : p.usage,
              },
            ]).words.map((w) =>
              meaningKey(w) === meaningKey(word)
                ? { ...w, sourcePhraseId: p.id }
                : w,
            ),
      };
    });
    notify(
      saved ? "Выражение убрано из изучаемых" : "Выражение добавлено в словарь",
    );
  }
  return (
    <>
      <form
        className="phrase-search panel"
        role="search"
        aria-label="Поиск выражений"
        onSubmit={(event) => {
          event.preventDefault();
          if (composing) return;
          setOnlySaved(false);
          if (!matchingCount) void findMore();
          else {
            results.current?.focus({ preventScroll: true });
            results.current?.scrollIntoView({
              block: "start",
              behavior: "auto",
            });
          }
        }}
      >
        <div className="search-field">
          <Search size={20} />
          <input
            aria-label="Найти выражения по слову"
            value={query}
            onChange={(e) => search(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              search(e.currentTarget.value);
            }}
            maxLength={100}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            aria-describedby="phrase-search-hint"
            placeholder="Английское слово — например, dream"
          />
          {query && (
            <button
              className="icon-button"
              onClick={() => search("", null, false)}
              aria-label="Очистить поиск"
              type="button"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          className="button primary"
          type="submit"
          disabled={
            !query.trim() ||
            generating ||
            (!matchingCount && (!available || !canFindExpressions(query)))
          }
        >
          <Search size={17} /> Найти выражения
        </button>
        <p className="muted small" id="phrase-search-hint">
          Просто введите слово. Перевод и выражения найдём сами — добавлять в
          словарь заранее не нужно.
        </p>
      </form>
      <div className="phrase-personal-actions">
        <button className="text-button" onClick={() => setPickerOpen(true)}>
          <BookOpen size={17} /> Выбрать своё слово
        </button>
        <button className="text-button" onClick={onAddWords}>
          <Plus size={17} /> Добавить слово
        </button>
      </div>
      {meanings.length > 1 && (
        <details className="phrase-meanings panel">
          <summary>Уточнить значение слова</summary>
          <p className="muted small">
            Необязательно: выберите значение для следующего подбора.
          </p>
          <div className="filter-chips">
            <button
              aria-pressed={!selectedWord}
              className={!selectedWord ? "active" : ""}
              onClick={() => search(query)}
            >
              Любое значение
            </button>
            {meanings.map((word) => (
              <button
                key={meaningKey(word)}
                aria-pressed={selectedWord?.translation === word.translation}
                className={
                  selectedWord?.translation === word.translation ? "active" : ""
                }
                onClick={() => search(word.word, word)}
              >
                {word.translation}
              </button>
            ))}
          </div>
        </details>
      )}
      {selectedWord && (
        <p className="muted small phrase-target">
          Выбрано: <strong lang="en">{selectedWord.word}</strong> —{" "}
          {selectedWord.translation}. Подбор с ИИ учитывает это значение.
        </p>
      )}
      {phraseLibrary.status !== "ready" && (
        <LibraryNotice
          status={phraseLibrary.status}
          onRetry={phraseLibrary.retry}
        />
      )}
      <ServiceNotice connection={connection} />
      <div className="assistant-strip">
        {!query.trim() && (
          <span>
            {available
              ? "Готовые выражения появятся сразу. Если совпадений нет, помощник подберёт новые."
              : "Ищите выражения в готовой подборке. Помощник сейчас недоступен."}
          </span>
        )}
        <button
          className="text-button gold"
          disabled={!available || !canFindExpressions(query) || generating}
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
      {query.trim() && !canFindExpressions(query) && (
        <p className="muted small">
          Для нового подбора введите слово или выражение на английском. По
          переводу можно искать в готовой подборке.
        </p>
      )}
      {generating && (
        <div className="phrase-search-progress panel">
          <p role="status">
            <LoaderCircle size={20} className="spinning" /> Подбираем выражения
            и примеры для «{query.trim()}»…
          </p>
          <button
            className="text-button"
            onClick={() => {
              request.current?.abort();
              request.current = null;
              setGenerating(false);
            }}
          >
            Отменить подбор
          </button>
        </div>
      )}
      {generationError && (
        <div className="form-error" role="alert">
          <p>{generationError}</p>
          <button
            className="button secondary"
            disabled={generating}
            onClick={() => void findMore()}
          >
            Повторить подбор
          </button>
        </div>
      )}
      {personalWords.length > 0 && (
        <p className="muted small">Быстрый выбор из вашего словаря</p>
      )}
      <div className="phrase-filter-row">
        <div className="filter-chips">
          <button
            className={!query && !onlySaved ? "active" : ""}
            aria-pressed={!query && !onlySaved}
            onClick={() => search("")}
          >
            Все выражения
          </button>
          {personalWords.map((word) => (
            <button
              key={word.id}
              className={
                normalize(query) === normalize(word.word) && !onlySaved
                  ? "active"
                  : ""
              }
              aria-pressed={
                normalize(query) === normalize(word.word) && !onlySaved
              }
              title={word.translation}
              onClick={() => search(word.word, word)}
            >
              {word.word}
            </button>
          ))}
        </div>
        <button
          className={`text-button ${onlySaved ? "gold" : ""}`}
          aria-pressed={onlySaved}
          onClick={() => {
            request.current?.abort();
            request.current = null;
            setGenerating(false);
            setGenerationError("");
            setOnlySaved(!onlySaved);
          }}
        >
          <Bookmark size={15} fill={onlySaved ? "currentColor" : "none"} />
          Учу · {store.phraseIds.length}
        </button>
      </div>
      <div
        className="list-caption"
        ref={results}
        tabIndex={-1}
        role="status"
        aria-live="polite"
      >
        <span>
          {phrases.length}{" "}
          {plural(phrases.length, ["выражение", "выражения", "выражений"])} в
          подборке
        </span>
      </div>
      <div className="phrase-list">
        {phrases.slice(0, visible).map((p, i) => (
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
                <PhraseDetails
                  phrase={p}
                  store={store}
                  setStore={setStore}
                  available={available}
                />
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
      {phrases.length > visible && (
        <button
          className="button secondary full"
          onClick={() => setVisible((v) => v + 24)}
        >
          Показать ещё · осталось {phrases.length - visible}
        </button>
      )}
      {!phrases.length && !generating && phraseLibrary.status === "ready" && (
        <div className="empty-state panel">
          <Search size={28} />
          <h2>
            {onlySaved
              ? "Пока без сохранённых выражений"
              : "Готовых выражений пока нет"}
          </h2>
          <p>
            {onlySaved
              ? "Нажмите «Учить» у подходящего выражения — оно появится здесь и в вашем словаре. Если включён поиск, попробуйте очистить его."
              : available
                ? "Для этого слова нет совпадений в готовой подборке. Помощник может подобрать употребляемые выражения и примеры — без выдуманных идиом."
                : "Совпадений пока нет. Попробуйте другое слово или вернитесь к подбору, когда помощник снова станет доступен."}
          </p>
          {!onlySaved && available && (
            <button
              className="button primary"
              disabled={generating || !canFindExpressions(query)}
              onClick={() => void findMore()}
            >
              {generating ? "Подбираем…" : "Подобрать с ИИ"}
            </button>
          )}
          <button className="button secondary" onClick={() => search("")}>
            Показать подборку
          </button>
        </div>
      )}
      <BookLibrary />
      {pickerOpen && (
        <WordPicker
          words={store.words}
          onClose={() => setPickerOpen(false)}
          onPick={(word) => {
            search(word.word, word);
            setPickerOpen(false);
          }}
          onAdd={() => {
            setPickerOpen(false);
            onAddWords();
          }}
        />
      )}
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
          <p>Выберите значение, которое подходит по смыслу.</p>
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
                <p>Выберите подходящее значение.</p>
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
