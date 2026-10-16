import { useBottomNavigation } from "./useBottomNavigation";
import { usePwa } from "./usePwa";
import PwaSettings from "./components/PwaSettings";
import { DEFAULT_APPEARANCE, applyAppearance } from "./appearance";
import AppearanceSettings from "./components/AppearanceSettings";
import GeneratedWords from "./components/GeneratedWords";
import { useWordLibrary } from "./useLibrary";
import LibraryNotice from "./components/LibraryNotice";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  CloudDownload,
  Clock3,
  Flower2,
  Layers3,
  LayoutGrid,
  Library,
  Menu,
  MoreHorizontal,
  Plus,
  Quote,
  Search,
  Settings2,
  Sparkles,
  Sprout,
  Volume2,
  X,
  RotateCcw,
  Compass,
  Target,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import {
  CATALOG,
  PHRASES,
  TOPICS,
  type Mode,
  type Page,
  type Word,
  type Topic,
} from "./data";
import {
  loadStore,
  saveStore,
  StorageConflictError,
  createBackup,
  plural,
  localDay,
  mergeWords,
  normalize,
  queueFor,
  speak,
  STORAGE_KEY,
  progressStats,
  learningState,
  setWordStatus,
  canPractice,
  meaningKey,
  type Store,
} from "./domain";
import type { HelpContext, NoticeAction } from "./types";
import WordArt from "./components/WordArt";
import { AddWords, WordEditor } from "./components/WordForms";
import { Flashcards, Phrases, Reading } from "./components/Study";
import Help from "./components/Help";
import Modal from "./components/Modal";
import { useStudyClock } from "./useStudyClock";

const NAV = [
  { id: "home" as Page, label: "Обзор", icon: LayoutGrid },
  { id: "cards" as Page, label: "Карточки", icon: Layers3 },
  { id: "phrases" as Page, label: "Слова в выражениях", icon: Quote },
  { id: "reading" as Page, label: "Чтение", icon: BookOpen },
  { id: "words" as Page, label: "Мои слова", icon: Library },
];
const MODES = [
  { id: "learn" as Mode, label: "Учу сейчас", icon: Sprout },
  { id: "review" as Mode, label: "Повторяю", icon: RotateCcw },
  { id: "new" as Mode, label: "Новые слова", icon: Sparkles },
];
const PAGE_COPY: Record<Page, [string, string]> = {
  home: [
    "Каждое слово — новый мир.",
    "Немного любопытства. Немного практики. И английский становится ближе.",
  ],
  cards: [
    "От образа — к слову.",
    "Запоминайте не перевод, а ощущение. Так слова остаются с вами.",
  ],
  phrases: [
    "У слов есть своя история.",
    "Устойчивые выражения, живые примеры и чуть больше смысла.",
  ],
  reading: [
    "Слова оживают в историях.",
    "Читайте, замечайте знакомое и открывайте новое между строк.",
  ],
  words: [
    "Ваш мир английских слов.",
    "Коллекция, которая растёт вместе с вами. Одно слово за другим.",
  ],
};
function getPage(): Page {
  const hash = window.location.hash.slice(1);
  return NAV.some((n) => n.id === hash) ? (hash as Page) : "home";
}
export default function App() {
  const pwa = usePwa();
  const [initial] = useState(loadStore);
  const [store, setStore] = useState<Store>(initial.state);
  const spellingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of store.words)
      counts.set(normalize(w.word), (counts.get(normalize(w.word)) || 0) + 1);
    return counts;
  }, [store.words]);
  const now = useStudyClock(store.words);
  const stats = progressStats(store, now);
  const dailyGoal = store.dailyGoal ?? 10;
  const [page, setPage] = useState<Page>(getPage);
  const [mode, setMode] = useState<Mode>("learn");
  const needsWordBank =
    mode === "new" ||
    store.words.some((w) => w.bankId && w.partOfSpeech !== "phrase");
  const needsPhraseBank = store.words.some(
    (w) => w.bankId && w.partOfSpeech === "phrase",
  );
  const wordLibrary = useWordLibrary("words", needsWordBank);
  const storedPhraseLibrary = useWordLibrary("phrases", needsPhraseBank);
  const librariesReady =
    (!needsWordBank || wordLibrary.status === "ready") &&
    (!needsPhraseBank || storedPhraseLibrary.status === "ready");
  const [addOpen, setAddOpen] = useState(false);
  const [phraseWord, setPhraseWord] = useState<Word | null>(null);
  const [generateWords, setGenerateWords] = useState(false);
  const appearance = store.appearance ?? DEFAULT_APPEARANCE;
  useEffect(() => applyAppearance(appearance), [appearance]);
  const [edit, setEdit] = useState<Word | null>(null);
  const [help, setHelp] = useState<HelpContext | null>(null);
  const [currentHelp, setCurrentHelp] = useState<HelpContext>({
    word: initial.state.words[0] || CATALOG[0],
  });
  useEffect(() => {
    if (page === "home" || page === "words")
      setCurrentHelp({
        word: store.words[0],
        text: store.words.length
          ? "Ваш словарь английских слов"
          : "Как добавить слова и начать изучение английского",
      });
  }, [page, store.words]);
  const [settings, setSettings] = useState(false);
  const [mobile, setMobile] = useState(false);
  const bottomNavigation = useBottomNavigation(mobile);
  const [toast, setToast] = useState("");
  const [toastAction, setToastAction] = useState<NoticeAction | null>(null);
  const [welcome, setWelcome] = useState(() => {
    try {
      return (
        !localStorage.getItem("lexi.welcome.seen") &&
        !localStorage.getItem(STORAGE_KEY)
      );
    } catch {
      return false;
    }
  });
  const previousPage = useRef(page);
  useEffect(() => {
    document.title = `${NAV.find((n) => n.id === page)?.label || "Lexi"} · Lexi`;
    if (previousPage.current !== page) {
      previousPage.current = page;
      requestAnimationFrame(() =>
        document.getElementById("page-title")?.focus(),
      );
    }
  }, [page]);
  function dismissWelcome() {
    setWelcome(false);
    try {
      localStorage.setItem("lexi.welcome.seen", "1");
    } catch {
      notify("Подсказка скрыта на текущую сессию.");
    }
  }

  const [storageError, setStorageError] = useState(initial.error);
  const [query, setQuery] = useState("");
  const [wordFilter, setWordFilter] = useState("all");
  const [wordLimit, setWordLimit] = useState(48);
  useEffect(() => setWordLimit(48), [query, wordFilter]);
  const recovery = useRef(false);
  const storageSnapshot = useRef(initial.raw);
  const storageConflict = useRef(false);
  useEffect(() => {
    const handle = (event: StorageEvent) => {
      if (
        (event.key === STORAGE_KEY || event.key === null) &&
        event.newValue !== storageSnapshot.current
      ) {
        storageConflict.current = true;
        setStorageError(new StorageConflictError().message);
      }
    };
    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (
      storageConflict.current ||
      (store === initial.state && (initial.error || initial.raw !== null))
    )
      return;
    try {
      if (initial.error && !recovery.current) {
        const old = localStorage.getItem(STORAGE_KEY);
        if (old) localStorage.setItem(`${STORAGE_KEY}.recovery`, old);
        recovery.current = true;
      }
      storageSnapshot.current = saveStore(store, storageSnapshot.current);
      setStorageError("");
    } catch (error) {
      if (error instanceof StorageConflictError) {
        storageConflict.current = true;
        setStorageError(error.message);
        return;
      }
      setStorageError(
        "Память браузера недоступна или заполнена. Экспортируйте словарь, чтобы сохранить изменения.",
      );
    }
  }, [store, initial]);
  useEffect(() => {
    const listener = () => setPage(getPage());
    window.addEventListener("hashchange", listener);
    return () => {
      window.removeEventListener("hashchange", listener);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(".sidebar button, .sidebar a"),
      ).filter(
        (el) =>
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden",
      );
    document.querySelector<HTMLElement>(".mobile-close")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
      if (e.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [mobile]);
  function go(next: Page) {
    if (next === "cards") setCurrentHelp({ assessmentLocked: true });
    setPage(next);
    window.location.hash = next;
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function expressionsFor(word: Word) {
    setPhraseWord(word);
    go("phrases");
  }
  function notify(message: string, action?: NoticeAction) {
    setToast(message);
    setToastAction(action || null);
    if (timer.current) clearTimeout(timer.current);
    if (!action) timer.current = setTimeout(() => setToast(""), 6500);
  }
  function exportWords() {
    const blob = new Blob([createBackup(store)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexi-words-${localDay(Date.now())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Словарь и весь прогресс сохранены в резервную копию");
  }
  const learning = stats.learning;
  const learned = stats.learned;
  const daily = Math.min(stats.todayWords, dailyGoal);
  const activeNav = NAV.find((n) => n.id === page)!;
  const shownWords = store.words
    .filter(
      (w) =>
        (wordFilter === "all" ||
          (wordFilter === "incomplete"
            ? !canPractice(w)
            : learningState(w, now) === wordFilter)) &&
        (!query ||
          [w.word, w.translation].some((v) =>
            normalize(v).includes(normalize(query)),
          )),
    )
    .sort((a, b) => b.addedAt - a.addedAt);
  const studyProps = {
    store,
    setStore,
    mode,
    now,
    notify,
    onHelp: setHelp,
    onContext: setCurrentHelp,
    onAddWords: () => setAddOpen(true),
    onNavigate: go,
    onModeChange: setMode,
    storageError,
  };
  const shell = (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          type="button"
          tabIndex={-1}
          aria-label="Скрыть навигацию"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <a
            href="#home"
            className="brand"
            aria-label="Lexi — на главную"
            onClick={() => go("home")}
          >
            <span className="brand-icon">
              <Sparkles size={24} strokeWidth={1.25} />
            </span>
            <span>
              lexi<span className="brand-period">.</span>
            </span>
            <span className="brand-caption">СЛОВА СО СМЫСЛОМ</span>
          </a>
          <button
            className="mobile-close icon-button"
            onClick={() => setMobile(false)}
            aria-label="Закрыть меню"
          >
            <X size={21} />
          </button>
        </div>
        <div className="workspace-label">ВАШЕ ПРОСТРАНСТВО</div>
        <nav aria-label="Основная навигация">
          {NAV.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              onClick={() => go(n.id)}
              className={`nav-link ${page === n.id ? "active" : ""}`}
              aria-current={page === n.id ? "page" : undefined}
            >
              <n.icon size={19} strokeWidth={1.65} />
              <span>{n.label}</span>
              {n.id === "words" ? (
                <span className="nav-count">{store.words.length}</span>
              ) : page === n.id ? (
                <span className="nav-active-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-daily">
          <div className="sidebar-daily-title">
            <span className="tiny-sun">
              <Flower2 size={19} />
            </span>
            В своём ритме
          </div>
          <div className="daily-label">
            <span>{dailyGoal ? "Цель на сегодня" : "Практика сегодня"}</span>
            <b>
              {stats.todayWords}
              {dailyGoal > 0 && <span> / {dailyGoal}</span>}
            </b>
          </div>
          {dailyGoal > 0 && (
            <div
              className="daily-track"
              role="progressbar"
              aria-label="Разных значений отработано сегодня"
              aria-valuemin={0}
              aria-valuemax={dailyGoal}
              aria-valuenow={daily}
            >
              <span style={{ width: `${(daily / dailyGoal) * 100}%` }} />
            </div>
          )}
          <p>
            {dailyGoal > 0 && daily >= dailyGoal
              ? "Цель выполнена. Можно закончить на сегодня."
              : "Считаем разные значения, а не повторные нажатия. Цель можно изменить или отключить."}
          </p>
        </div>
        <div className="sidebar-bottom">
          <button
            className="nav-link"
            onClick={() => {
              setMobile(false);
              setSettings(true);
            }}
          >
            <Settings2 size={18} />
            <span>Мои предпочтения</span>
          </button>
          <button
            className="profile"
            onClick={() => {
              setMobile(false);
              setSettings(true);
            }}
          >
            <span className="avatar">
              L<span />
            </span>
            <span>
              <strong>Любопытный ум</strong>
              <small>Личное пространство</small>
            </span>
            <MoreHorizontal size={19} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={mobile}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobile(true)}
              aria-label="Открыть меню"
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Моё пространство
              <ChevronRight size={13} />
              <strong>{activeNav.label}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className={`save-status ${storageError ? "save-error" : ""}`}>
              <CloudDownload size={16} />
              <span>
                {storageError
                  ? "Есть несохранённые данные"
                  : "Сохранено на устройстве"}
              </span>
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Поиск в словаре"
              onClick={() => {
                go("words");
                setTimeout(
                  () => document.getElementById("dictionary-search")?.focus(),
                  50,
                );
              }}
            >
              <Search size={19} />
            </button>
            <button
              className="top-help"
              onClick={() =>
                setHelp(
                  page === "cards" && currentHelp.assessmentLocked !== false
                    ? { assessmentLocked: true }
                    : currentHelp,
                )
              }
              aria-label="Открыть помощника"
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main id="main-content" data-page={page} tabIndex={-1}>
          <div className="mode-bar">
            <div className="mode-switch" aria-label="Режим обучения">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  aria-pressed={mode === m.id}
                  className={mode === m.id ? "active" : ""}
                  onClick={() => {
                    if (page === "cards")
                      setCurrentHelp({ assessmentLocked: true });
                    setMode(m.id);
                  }}
                >
                  <m.icon size={16} />
                  {m.label}
                  {m.id === "review" &&
                    queueFor(store.words, "review", [], now).length > 0 && (
                      <span className="mode-count">
                        {queueFor(store.words, "review", [], now).length}
                      </span>
                    )}
                </button>
              ))}
            </div>
            <span className="mode-caption">
              <span className="live-dot" />В вашем темпе
            </span>
          </div>
          {storageError && (
            <div className="storage-warning" role="alert">
              {storageError}
              <button className="text-button" onClick={exportWords}>
                Экспортировать
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "home"
                  ? "MAKE WORDS YOUR OWN"
                  : "YOUR LITTLE ENGLISH RITUAL"}
              </span>
              <h1 id="page-title" tabIndex={-1}>
                {PAGE_COPY[page][0]}
              </h1>
              <p>{PAGE_COPY[page][1]}</p>
            </div>
            {page === "words" ? (
              <div className="row-buttons word-actions">
                <button
                  className="button secondary"
                  aria-label="Подобрать слова с ИИ"
                  onClick={() => setGenerateWords(true)}
                >
                  <Sparkles size={16} />
                  <span className="wide-action-label">
                    Подобрать слова с ИИ
                  </span>
                  <span className="compact-action-label" aria-hidden="true">
                    Слова с ИИ
                  </span>
                </button>
                <button
                  className="button secondary export-button"
                  onClick={exportWords}
                >
                  <ArrowDownToLine size={16} />
                  Экспорт
                </button>
                <button
                  className="button primary"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus size={17} />
                  Добавить слова
                </button>
              </div>
            ) : page === "home" ? (
              <div className="streak-pill">
                <Clock3 size={16} />
                <strong>{stats.todayWords}</strong>
                <span>значений сегодня</span>
              </div>
            ) : null}
          </div>
          {page === "home" && welcome && (
            <section className="welcome-card" aria-label="Как начать">
              <span className="welcome-icon">
                <Sparkles size={24} />
              </span>
              <div className="welcome-content">
                <h2>Ваш английский начинается здесь</h2>
                <p>
                  Для старта — 12 учебных примеров. Добавляйте свои слова и
                  меняйте пометки «Учу» / «Выучил». Прогресс сохраняется в этом
                  браузере.
                </p>
                <div className="row-buttons">
                  <button
                    className="button secondary"
                    onClick={() => {
                      dismissWelcome();
                      go("cards");
                    }}
                  >
                    Попробовать карточки
                    <ArrowRight size={16} />
                  </button>
                  <button
                    className="text-button gold"
                    onClick={() => {
                      dismissWelcome();
                      setAddOpen(true);
                    }}
                  >
                    Добавить первое слово
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <button
                className="icon-button"
                aria-label="Скрыть подсказку первого запуска"
                onClick={dismissWelcome}
              >
                <X size={18} />
              </button>
            </section>
          )}
          {page === "home" && (
            <Home
              store={store}
              mode={mode}
              now={now}
              go={go}
              onAdd={() => setAddOpen(true)}
              onEdit={setEdit}
              setStore={setStore}
              notify={notify}
            />
          )}
          {page === "cards" &&
            ((needsWordBank && wordLibrary.status !== "ready") ||
            (needsPhraseBank && storedPhraseLibrary.status !== "ready") ? (
              <LibraryNotice
                status={
                  (needsWordBank && wordLibrary.status === "error") ||
                  (needsPhraseBank && storedPhraseLibrary.status === "error")
                    ? "error"
                    : "loading"
                }
                onRetry={() => {
                  wordLibrary.retry();
                  storedPhraseLibrary.retry();
                }}
              />
            ) : (
              <Flashcards key={mode} {...studyProps} />
            ))}
          {page === "phrases" && (
            <Phrases
              key={phraseWord?.id || "browse"}
              {...studyProps}
              initialWord={phraseWord}
            />
          )}
          {page === "reading" && <Reading key={mode} {...studyProps} />}
          {page === "words" && (
            <>
              <div className="dictionary-toolbar">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    id="dictionary-search"
                    aria-label="Поиск слова или перевода"
                    placeholder="Найти слово или перевод…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Очистить поиск слов"
                      onClick={() => setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="filter-chips">
                  {[
                    { id: "all", label: `Все · ${store.words.length}` },
                    { id: "learning", label: `Учу · ${learning}` },
                    { id: "learned", label: `Выучил · ${learned}` },
                    { id: "due", label: `Пора повторить · ${stats.due}` },
                    ...(librariesReady &&
                    store.words.some((w) => !canPractice(w))
                      ? [
                          {
                            id: "incomplete",
                            label: `Без карточки · ${store.words.filter((w) => !canPractice(w)).length}`,
                          },
                        ]
                      : []),
                  ].map((f) => (
                    <button
                      key={f.id}
                      className={wordFilter === f.id ? "active" : ""}
                      aria-pressed={wordFilter === f.id}
                      onClick={() => setWordFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="sr-only" aria-live="polite">
                Найдено слов: {shownWords.length}
              </p>
              <div className="word-grid">
                {shownWords.slice(0, wordLimit).map((w) => (
                  <article key={w.id} className="word-tile panel">
                    <button
                      className="word-tile-main"
                      onClick={() => setEdit(w)}
                      aria-label={`Открыть слово ${w.word}${(spellingCounts.get(normalize(w.word)) || 0) > 1 ? ` — ${w.translation}` : ""}`}
                    >
                      <div className="word-tile-art">
                        {w.image ? (
                          <img src={w.image} alt={w.word} />
                        ) : w.concept ? (
                          <WordArt concept={w.concept} />
                        ) : (
                          <div className="word-tile-placeholder">
                            <BookOpen size={42} />
                            <span>
                              {w.bankId
                                ? "Словарная карточка"
                                : "Без иллюстрации"}
                            </span>
                          </div>
                        )}
                        <span
                          className={`word-status ${learningState(w, now) === "due" ? "due" : w.status === "learned" ? "known" : "learning"}`}
                        >
                          {w.status === "learned" ? (
                            <Check size={12} />
                          ) : (
                            <span className="status-dot learning" />
                          )}
                          {learningState(w, now) === "due"
                            ? "Пора повторить"
                            : w.status === "learned"
                              ? "Выучил"
                              : "Учу"}
                        </span>
                      </div>
                      <div className="word-tile-copy">
                        <h3 lang="en">{w.word}</h3>
                        <p>{w.translation || "Добавьте перевод"}</p>
                        <p className="word-review-note">
                          {w.mastery === "scheduled"
                            ? "Подтверждено по расписанию"
                            : w.status === "learned"
                              ? "Отмечено вами; проверка ещё нужна"
                              : `Успешных проверок подряд: ${Math.min(w.successes, 3)} / 3`}
                          {w.dueAt > now
                            ? ` · ${new Date(w.dueAt).toLocaleDateString("ru-RU")}`
                            : ""}
                        </p>
                        <span className="phonetic">
                          {w.phonetic
                            ? `/${w.phonetic}/`
                            : w.concept
                              ? "Личная коллекция"
                              : w.bankId
                                ? "Словарная карточка"
                                : w.generated
                                  ? "Материал ИИ"
                                  : "Добавьте иллюстрацию"}
                        </span>
                      </div>
                    </button>
                    <div className="word-tile-footer">
                      <button
                        className="text-button word-phrase-link"
                        aria-label={`Выражения со словом ${w.word} — ${w.translation}`}
                        onClick={() => expressionsFor(w)}
                      >
                        <Quote size={16} /> Найти выражения
                      </button>
                      <span className="level-badge">{w.level}</span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setStore((s) => ({
                            ...s,
                            words: s.words.map((v) =>
                              v.id === w.id
                                ? setWordStatus(
                                    v,
                                    v.status === "learning"
                                      ? "learned"
                                      : "learning",
                                  )
                                : v,
                            ),
                          }));
                          notify(
                            w.status === "learning"
                              ? "Отмечено как выученное по самооценке. Проверка — через день."
                              : "Слово возвращено в изучение",
                          );
                        }}
                      >
                        {w.status === "learning" ? (
                          <CheckCheck size={15} />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                        {w.status === "learning"
                          ? "Уже знаю"
                          : "Вернуть в изучение"}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Произнести ${w.word}`}
                        onClick={() => {
                          if (!speak(w.word))
                            notify("Озвучка не поддерживается браузером.");
                        }}
                      >
                        <Volume2 size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {shownWords.length > wordLimit && (
                <button
                  className="button secondary full"
                  onClick={() => setWordLimit((n) => n + 48)}
                >
                  Показать ещё слова · осталось {shownWords.length - wordLimit}
                </button>
              )}
              {!shownWords.length && (
                <div className="empty-state panel">
                  <Library size={30} />
                  <h2>
                    {query
                      ? "Не нашли такого слова"
                      : store.words.length
                        ? wordFilter === "learned"
                          ? "Пока нет выученных слов"
                          : wordFilter === "incomplete"
                            ? "Все карточки готовы"
                            : "В этом списке пока нет слов"
                        : "Здесь будет ваша коллекция"}
                  </h2>
                  <p>
                    {query
                      ? "Попробуйте другой запрос или сбросьте фильтры."
                      : store.words.length
                        ? "Откройте все слова, чтобы продолжить практику."
                        : "Добавьте первое слово или загрузите список. Для карточек нужны перевод, часть речи и картинка или пример."}
                  </p>
                  {store.words.length > 0 && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setQuery("");
                        setWordFilter("all");
                      }}
                    >
                      Сбросить фильтры
                    </button>
                  )}
                  <button
                    className="button primary"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus size={16} />
                    Добавить слова
                  </button>
                </div>
              )}
              <p className="content-note">
                <ShieldCheck size={14} />
                Словарь хранится в этом браузере. Регулярно экспортируйте его:
                это ваша резервная копия и способ перенести слова на другое
                устройство.
              </p>
            </>
          )}
        </main>
        <footer className="main-footer">
          <span>
            <Sparkles size={13} />
            Создавайте связи, а не списки.
          </span>
          <span>
            Сделано для любопытных <span className="footer-star">✦</span>
          </span>
        </footer>
      </div>
      {addOpen && (
        <AddWords
          store={store}
          setStore={setStore}
          notify={notify}
          onClose={() => setAddOpen(false)}
          onOpenWord={setEdit}
          onAdded={
            page === "phrases"
              ? (words) => {
                  if (words[0]) expressionsFor(words[0]);
                }
              : undefined
          }
        />
      )}
      {edit && (
        <WordEditor
          word={edit}
          words={store.words}
          setStore={setStore}
          notify={notify}
          onClose={() => setEdit(null)}
          onHelp={() => {
            setHelp({ word: edit });
            setEdit(null);
          }}
        />
      )}
      {generateWords && (
        <GeneratedWords
          store={store}
          setStore={setStore}
          notify={notify}
          onClose={() => setGenerateWords(false)}
        />
      )}
      {help && <Help context={help} onClose={() => setHelp(null)} />}
      {settings && (
        <Modal
          title="В вашем ритме"
          subtitle="Английский, который интересен именно вам."
          onClose={() => setSettings(false)}
        >
          <div className="form-body">
            <span className="eyebrow">ЧТО ВАМ БЛИЖЕ?</span>
            <p className="muted">Выберите темы, которые вам интересны.</p>
            <div className="interest-options">
              {(Object.entries(TOPICS) as [Topic, string][]).map(
                ([id, label]) => (
                  <button
                    key={id}
                    className={store.interests.includes(id) ? "active" : ""}
                    aria-pressed={store.interests.includes(id)}
                    onClick={() =>
                      setStore((s) => ({
                        ...s,
                        interests: s.interests.includes(id)
                          ? s.interests.filter((i) => i !== id)
                          : [...s.interests, id],
                      }))
                    }
                  >
                    <span>
                      {id === "travel" ? (
                        <Compass size={20} />
                      ) : id === "ideas" ? (
                        <Sparkles size={20} />
                      ) : (
                        <Flower2 size={20} />
                      )}
                    </span>
                    {label}
                    <span className="interest-check">
                      {store.interests.includes(id) && <Check size={15} />}
                    </span>
                  </button>
                ),
              )}
            </div>
            <PwaSettings pwa={pwa} storageError={storageError} />
            <AppearanceSettings
              value={appearance}
              onChange={(appearance) => setStore((s) => ({ ...s, appearance }))}
            />
            <label>
              Ежедневная цель (разных значений)
              <select
                value={dailyGoal}
                onChange={(e) =>
                  setStore((s) => ({
                    ...s,
                    dailyGoal: Number(e.target.value),
                  }))
                }
              >
                {[
                  0,
                  5,
                  10,
                  15,
                  20,
                  30,
                  50,
                  ...(![0, 5, 10, 15, 20, 30, 50].includes(dailyGoal)
                    ? [dailyGoal]
                    : []),
                ]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Без цели" : n}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted small">
              Правильный и ошибочный самостоятельный ответ учитываются как
              практика. Повтор одного значения в тот же день не увеличивает
              цель; чтение и справка не меняют владение словом.
            </p>
            <div className="privacy-note">
              <ShieldCheck size={20} />
              <div>
                <strong>Ваши слова остаются с вами</strong>
                <p>
                  Прогресс сохраняется на устройстве. При очистке данных
                  браузера он удалится — сохраните копию словаря.
                </p>
              </div>
            </div>
            <button className="button secondary full" onClick={exportWords}>
              <ArrowDownToLine size={17} />
              Экспортировать словарь
            </button>
            <a
              className="text-button"
              href="/data/word-bank-credits.txt"
              target="_blank"
              rel="noreferrer"
            >
              Источники и лицензии
            </a>
            <button
              className="button primary full"
              onClick={() => setSettings(false)}
            >
              Всё готово
              <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          <span className="toast-message">{toast}</span>
          {toastAction && (
            <button
              className="toast-action"
              onClick={() => {
                const action = toastAction;
                setToast("");
                setToastAction(null);
                action.onClick();
              }}
            >
              {toastAction.label}
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Скрыть уведомление"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
  return (
    <>
      {shell}
      {!mobile && (
        <nav
          ref={bottomNavigation}
          className="mobile-bottom-nav"
          aria-label="Навигация на телефоне"
        >
          {NAV.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              aria-current={page === n.id ? "page" : undefined}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={22} />
              <span>
                {n.id === "phrases"
                  ? "Выражения"
                  : n.id === "words"
                    ? "Словарь"
                    : n.label}
              </span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
function Home({
  store,
  mode,
  now,
  go,
  onAdd,
  onEdit,
  setStore,
  notify,
}: {
  store: Store;
  mode: Mode;
  now: number;
  go: (page: Page) => void;
  onAdd: () => void;
  onEdit: (w: Word) => void;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  notify: (s: string) => void;
}) {
  const learning = store.words.filter((w) => w.status === "learning");
  const learned = store.words.filter((w) => w.status === "learned");
  const due = queueFor(store.words, "review", [], now);
  const stats = progressStats(store, now);
  const accuracy = stats.accuracy;
  const discovery =
    queueFor(store.words, "new", store.interests)[0] || CATALOG[14];
  const existing = store.words.find(
    (w) => meaningKey(w) === meaningKey(discovery),
  );
  const features = [
    {
      page: "cards" as Page,
      icon: Layers3,
      title: "Узнавайте через образы",
      text: "Одна картинка. Несколько слов. Новая связь в памяти.",
      tag: "КАРТОЧКИ",
      class: "visual",
      art: "forest",
      count: `${queueFor(store.words, mode, store.interests, now).filter(canPractice).length} в очереди`,
    },
    {
      page: "phrases" as Page,
      icon: Quote,
      title: "Находите больше смысла",
      text: "Живые выражения и истории, которые за ними стоят.",
      tag: "СЛОВА В ВЫРАЖЕНИЯХ",
      class: "phrases",
      art: "book",
      count: `${PHRASES.length + store.customPhrases.length} выражений`,
    },
    {
      page: "reading" as Page,
      icon: BookOpen,
      title: "Читайте между строк",
      text: "Маленькие истории с вашими знакомыми словами.",
      tag: "ЧТЕНИЕ",
      class: "reading",
      art: "window",
      count: `${3 + store.customPassages.length} историй`,
    },
  ];
  return (
    <>
      <section className="hero">
        <div className="hero-image" />
        <div className="hero-grain" />
        <div className="hero-copy">
          <span className="hero-kicker">
            <span />
            НЕ ПРОСТО УЧИТЬ. ЧУВСТВОВАТЬ.
          </span>
          <h2>
            Слова становятся
            <br />
            <em>частью тебя.</em>
          </h2>
          <p>
            Через образы, истории и маленькие открытия.
            <br />
            Твой английский — гораздо больше, чем список слов.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => go("cards")}>
              Начать практику
              <ArrowRight size={17} />
            </button>
            <button className="button hero-secondary" onClick={onAdd}>
              <Plus size={17} />
              Добавить слова
            </button>
          </div>
        </div>
        <div className="hero-caption">
          <span className="hero-caption-line" />
          <span>
            A LITTLE EVERY DAY.
            <br />A WHOLE NEW WORLD.
          </span>
          <Sparkles size={22} />
        </div>
      </section>
      <section className="stats-grid" aria-label="Ваш прогресс">
        <div className="stat-card panel">
          <span className="stat-icon brass">
            <Library size={21} strokeWidth={1.5} />
          </span>
          <div>
            <span className="stat-label">Значений в коллекции</span>
            <div className="stat-value">
              {store.words.length}
              <span>ваш личный словарь</span>
            </div>
          </div>
          <button
            className="stat-link"
            onClick={() => go("words")}
            aria-label="Открыть мой словарь"
          >
            <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="stat-card panel">
          <span className="stat-icon sage">
            <Sprout size={22} strokeWidth={1.5} />
          </span>
          <div>
            <span className="stat-label">Выучил сейчас</span>
            <div className="stat-value">
              {stats.learned}
              <span>
                {stats.learning} учу · {stats.due} пора повторить
              </span>
            </div>
          </div>
        </div>
        <div className="stat-card panel">
          <span className="stat-icon silver">
            <Target size={22} strokeWidth={1.5} />
          </span>
          <div>
            <span className="stat-label">Точность за 7 дней</span>
            <div className="stat-value">
              {accuracy === null ? "—" : `${accuracy}%`}
              <span>
                {accuracy === null
                  ? "начните первую практику"
                  : `${stats.recentAttempts} ответов · ${stats.todayWords} значений сегодня`}
              </span>
            </div>
          </div>
        </div>
      </section>
      <section
        className="learning-summary panel"
        aria-label="Как считается прогресс"
      >
        <div>
          <strong>Пора повторить: {stats.due}</strong>
          <p>
            Статусы выше не пересекаются: «Пора повторить» выделяется из «Учу» и
            «Выучил», когда наступает срок.
          </p>
          <button className="text-button gold" onClick={() => go("cards")}>
            Открыть практику выбранного режима <ArrowRight size={15} />
          </button>
        </div>
        <div>
          <strong>Подтверждено по расписанию: {stats.confirmed}</strong>
          <p>
            {stats.manual} отмечено как выученное без трёх подтверждённых
            проверок. Самооценка и стартовые примеры не считаются
            доказательством запоминания.
          </p>
        </div>
        <div>
          <strong>
            Сегодня: {stats.todayWords}{" "}
            {plural(stats.todayWords, ["значение", "значения", "значений"])}
          </strong>
          <p>
            Самостоятельных ответов: {stats.todayAttempts}. Цель:{" "}
            {(store.dailyGoal ?? 10) === 0
              ? "отключена"
              : `${store.dailyGoal ?? 10} разных значений`}
            . Ошибки учитываются как практика, а не как выученные слова.
          </p>
        </div>
      </section>
      <section className="practice-section">
        <div className="section-heading">
          <div>
            <h2>Как будем практиковаться?</h2>
            <p>Разные пути. Одно приятное чувство прогресса.</p>
          </div>
          <span className="section-note">
            ВЫБЕРИТЕ СВОЙ ФОРМАТ
            <ArrowDownRight />
          </span>
        </div>
        <div className="feature-grid">
          {features.map((f) => (
            <button
              key={f.page}
              className={`feature-card ${f.class}`}
              onClick={() => go(f.page)}
            >
              <div className="feature-art">
                <WordArt concept={f.art} />
                <span className="feature-tag">
                  <f.icon size={13} />
                  {f.tag}
                </span>
                <span className="feature-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <div className="feature-copy">
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <span className="feature-count">
                  {f.count}
                  <ArrowRight size={15} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <div className="home-bottom">
        <section className="collection-preview panel">
          <div className="section-heading">
            <div>
              <h2>Слова, которые уже рядом</h2>
              <p>Ваша маленькая коллекция больших открытий.</p>
            </div>
            <button className="text-button" onClick={() => go("words")}>
              Все слова
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="preview-word-list">
            {[...learning, ...learned].slice(0, 3).map((w) => (
              <button
                className="preview-word"
                key={w.id}
                onClick={() => onEdit(w)}
              >
                <div className="preview-word-art">
                  {w.image ? (
                    <img src={w.image} alt="" />
                  ) : (
                    <WordArt concept={w.concept} />
                  )}
                </div>
                <div>
                  <strong>{w.word}</strong>
                  <span>{w.translation}</span>
                </div>
                <span
                  className={`word-status ${learningState(w, now) === "due" ? "due" : w.status === "learned" ? "known" : "learning"}`}
                >
                  <span
                    className={`status-dot ${w.status === "learned" ? "known" : "learning"}`}
                  />
                  {learningState(w, now) === "due"
                    ? "Пора повторить"
                    : w.status === "learned"
                      ? "Выучил"
                      : "Изучаю"}
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
            {!store.words.length && (
              <button className="button secondary" onClick={onAdd}>
                <Plus size={16} />
                Начать коллекцию
              </button>
            )}
          </div>
          {due.length > 0 && (
            <div className="review-reminder">
              <RotateCcw size={15} />
              <span>
                {due.length}{" "}
                {plural(due.length, [
                  "значение ждёт",
                  "значения ждут",
                  "значений ждут",
                ])}{" "}
                повторения
              </span>
              <span>Выберите «Повторяю» сверху</span>
            </div>
          )}
        </section>
        <aside className="discovery-card">
          <div className="discovery-top">
            <span className="eyebrow">
              <Sparkles size={14} />
              {discovery.bankId
                ? "ИЗ СЛОВАРНОЙ БАЗЫ"
                : "ИЗ РЕДАКЦИОННОЙ ПОДБОРКИ"}
            </span>
            <button
              className="icon-button"
              aria-label="Прослушать слово из подборки"
              onClick={() => {
                if (!speak(discovery.word))
                  notify("Озвучка не поддерживается браузером.");
              }}
            >
              <Volume2 size={17} />
            </button>
          </div>
          <h3>{discovery.word}</h3>
          {discovery.phonetic && (
            <span className="phonetic">/{discovery.phonetic}/</span>
          )}
          <p className="discovery-translation">{discovery.translation}</p>
          {discovery.example && (
            <p className="discovery-example">“{discovery.example}”</p>
          )}
          <button
            className="button primary full discovery-button"
            onClick={() => {
              if (existing) {
                onEdit(existing);
                return;
              }
              setStore((s) => ({
                ...s,
                words: mergeWords(s.words, [
                  { ...discovery, addedAt: Date.now() },
                ]).words,
              }));
              notify(`Слово «${discovery.word}» теперь в вашей коллекции`);
            }}
          >
            {existing ? <Check size={16} /> : <Plus size={16} />}
            {existing ? "Уже в коллекции" : "В мою коллекцию"}
            <ArrowRight size={15} />
          </button>
        </aside>
      </div>
    </>
  );
}
function ArrowDownRight() {
  return <ArrowUpRight size={15} style={{ transform: "rotate(90deg)" }} />;
}
