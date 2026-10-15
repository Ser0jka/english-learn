import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  CloudDownload,
  Flame,
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
  TrendingUp,
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
  createBackup,
  plural,
  localDay,
  mergeWords,
  normalize,
  queueFor,
  speak,
  STORAGE_KEY,
  streak,
  type Store,
} from "./domain";
import type { HelpContext } from "./types";
import WordArt from "./components/WordArt";
import { AddWords, WordEditor } from "./components/WordForms";
import { Flashcards, Phrases, Reading } from "./components/Study";
import Help from "./components/Help";
import Modal from "./components/Modal";
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
  const [initial] = useState(loadStore);
  const [store, setStore] = useState<Store>(initial.state);
  const [page, setPage] = useState<Page>(getPage);
  const [mode, setMode] = useState<Mode>("learn");
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Word | null>(null);
  const [help, setHelp] = useState<HelpContext | null>(null);
  const [currentHelp, setCurrentHelp] = useState<HelpContext>({
    word: initial.state.words[0] || CATALOG[0],
  });
  const [settings, setSettings] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(initial.error);
  const [query, setQuery] = useState("");
  const [wordFilter, setWordFilter] = useState("all");
  const recovery = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (initial.error && store === initial.state) return;
    try {
      if (initial.error && !recovery.current) {
        const old = localStorage.getItem(STORAGE_KEY);
        if (old) localStorage.setItem(`${STORAGE_KEY}.recovery`, old);
        recovery.current = true;
      }
      saveStore(store);
      setStorageError("");
    } catch {
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
    setPage(next);
    window.location.hash = next;
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function notify(message: string) {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
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
  const learning = store.words.filter((w) => w.status === "learning").length;
  const learned = store.words.length - learning;
  const today = store.logs.filter(
    (l) => localDay(l.at) === localDay(Date.now()),
  );
  const daily = Math.min(today.length, 10);
  const activeNav = NAV.find((n) => n.id === page)!;
  const shownWords = store.words
    .filter(
      (w) =>
        (wordFilter === "all" || w.status === wordFilter) &&
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
    notify,
    onHelp: setHelp,
    onContext: setCurrentHelp,
  };
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
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
            Маленькие шаги,
            <br />
            большие перемены.
          </div>
          <div className="daily-label">
            <span>Практика сегодня</span>
            <b>
              {daily}
              <span> / 10</span>
            </b>
          </div>
          <div className="daily-track">
            <span style={{ width: `${daily * 10}%` }} />
          </div>
          <p>
            {daily === 10
              ? "Вы нашли время для себя. Так держать!"
              : "Всего 10 карточек. Вы справитесь."}
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
              onClick={() => setHelp(currentHelp)}
              aria-label="Открыть помощника"
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main>
          <div className="mode-bar">
            <div className="mode-switch" aria-label="Режим обучения">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  aria-pressed={mode === m.id}
                  className={mode === m.id ? "active" : ""}
                  onClick={() => setMode(m.id)}
                >
                  <m.icon size={16} />
                  {m.label}
                  {m.id === "review" &&
                    queueFor(store.words, "review").length > 0 && (
                      <span className="mode-count">
                        {queueFor(store.words, "review").length}
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
              <h1>{PAGE_COPY[page][0]}</h1>
              <p>{PAGE_COPY[page][1]}</p>
            </div>
            {page === "words" ? (
              <div className="row-buttons">
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
                <Flame size={16} />
                <strong>{streak(store.logs)}</strong>
                <span>
                  {plural(streak(store.logs), ["день", "дня", "дней"])} практики
                </span>
              </div>
            ) : null}
          </div>
          {page === "home" && (
            <Home
              store={store}
              mode={mode}
              go={go}
              onAdd={() => setAddOpen(true)}
              onEdit={setEdit}
              setStore={setStore}
              notify={notify}
            />
          )}
          {page === "cards" && <Flashcards key={mode} {...studyProps} />}
          {page === "phrases" && <Phrases {...studyProps} />}
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
                  ].map((f) => (
                    <button
                      key={f.id}
                      className={wordFilter === f.id ? "active" : ""}
                      onClick={() => setWordFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="word-grid">
                {shownWords.map((w) => (
                  <article key={w.id} className="word-tile panel">
                    <button
                      className="word-tile-main"
                      onClick={() => setEdit(w)}
                      aria-label={`Открыть слово ${w.word}`}
                    >
                      <div className="word-tile-art">
                        {w.image ? (
                          <img src={w.image} alt={w.word} />
                        ) : (
                          <WordArt concept={w.concept} />
                        )}
                        <span
                          className={`word-status ${w.status === "learned" ? "known" : "learning"}`}
                        >
                          {w.status === "learned" ? (
                            <Check size={12} />
                          ) : (
                            <span className="status-dot learning" />
                          )}
                          {w.status === "learned" ? "Выучил" : "Учу"}
                        </span>
                      </div>
                      <div className="word-tile-copy">
                        <h3>{w.word}</h3>
                        <p>{w.translation || "Добавьте перевод"}</p>
                        <span className="phonetic">
                          {w.phonetic
                            ? `/${w.phonetic}/`
                            : w.concept
                              ? "Личная коллекция"
                              : "Добавьте иллюстрацию"}
                        </span>
                      </div>
                    </button>
                    <div className="word-tile-footer">
                      <span className="level-badge">{w.level}</span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setStore((s) => ({
                            ...s,
                            words: s.words.map((v) =>
                              v.id === w.id
                                ? {
                                    ...v,
                                    status:
                                      v.status === "learning"
                                        ? "learned"
                                        : "learning",
                                    successes: v.status === "learning" ? 3 : 0,
                                    dueAt: 0,
                                  }
                                : v,
                            ),
                          }));
                          notify(
                            w.status === "learning"
                              ? "Слово отмечено как выученное"
                              : "Слово возвращено в изучение",
                          );
                        }}
                      >
                        {w.status === "learning" ? (
                          <CheckCheck size={15} />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                        {w.status === "learning" ? "Уже знаю" : "Повторить"}
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
              {!shownWords.length && (
                <div className="empty-state panel">
                  <Library size={30} />
                  <h2>
                    {query
                      ? "Не нашли такого слова"
                      : "Здесь будет ваша коллекция"}
                  </h2>
                  <p>
                    {query
                      ? "Попробуйте другой запрос или добавьте слово в словарь."
                      : "Добавляйте слова и отмечайте, какие уже знаете."}
                  </p>
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
        />
      )}
      {edit && (
        <WordEditor
          word={edit}
          setStore={setStore}
          notify={notify}
          onClose={() => setEdit(null)}
          onHelp={() => {
            setHelp({ word: edit });
            setEdit(null);
          }}
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
            <p className="muted">
              Выбранные темы будут первыми в режиме «Новые слова».
            </p>
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
          {toast}
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
}
function Home({
  store,
  mode,
  go,
  onAdd,
  onEdit,
  setStore,
  notify,
}: {
  store: Store;
  mode: Mode;
  go: (page: Page) => void;
  onAdd: () => void;
  onEdit: (w: Word) => void;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  notify: (s: string) => void;
}) {
  const learning = store.words.filter((w) => w.status === "learning");
  const learned = store.words.filter((w) => w.status === "learned");
  const due = queueFor(store.words, "review");
  const today = store.logs.filter(
    (l) => localDay(l.at) === localDay(Date.now()),
  );
  const accuracy = store.logs.length
    ? Math.round(
        (store.logs.filter((l) => l.correct).length / store.logs.length) * 100,
      )
    : null;
  const discovery =
    queueFor(store.words, "new", store.interests)[0] || CATALOG[14];
  const existing = store.words.find((w) => w.word === discovery.word);
  const features = [
    {
      page: "cards" as Page,
      icon: Layers3,
      title: "Узнавайте через образы",
      text: "Одна картинка. Несколько слов. Новая связь в памяти.",
      tag: "КАРТОЧКИ",
      class: "visual",
      art: "forest",
      count: `${queueFor(store.words, mode, store.interests).filter((w) => w.concept || w.image).length} в очереди`,
    },
    {
      page: "phrases" as Page,
      icon: Quote,
      title: "Находите больше смысла",
      text: "Живые выражения и истории, которые за ними стоят.",
      tag: "СЛОВА В ВЫРАЖЕНИЯХ",
      class: "phrases",
      art: "book",
      count: `${PHRASES.length} выражений`,
    },
    {
      page: "reading" as Page,
      icon: BookOpen,
      title: "Читайте между строк",
      text: "Маленькие истории с вашими знакомыми словами.",
      tag: "ЧТЕНИЕ",
      class: "reading",
      art: "window",
      count: "3 истории",
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
            <span className="stat-label">Слов в коллекции</span>
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
            <span className="stat-label">Уже с вами</span>
            <div className="stat-value">
              {learned.length}
              <span>{learning.length} ещё изучаете</span>
            </div>
          </div>
          <div className="mini-bars" aria-hidden="true">
            {[24, 36, 31, 44, 51, 65, 76].map((h, i) => (
              <i key={i} style={{ height: `${h}%`, opacity: 0.3 + i * 0.1 }} />
            ))}
          </div>
        </div>
        <div className="stat-card panel">
          <span className="stat-icon silver">
            <Target size={22} strokeWidth={1.5} />
          </span>
          <div>
            <span className="stat-label">Точность ответов</span>
            <div className="stat-value">
              {accuracy === null ? "—" : `${accuracy}%`}
              <span>
                {accuracy === null
                  ? "начните первую практику"
                  : `${today.length} ответов сегодня`}
              </span>
            </div>
          </div>
          <TrendingUp className="stat-trend" size={29} strokeWidth={1} />
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
                  className={`word-status ${w.status === "learned" ? "known" : "learning"}`}
                >
                  <span
                    className={`status-dot ${w.status === "learned" ? "known" : "learning"}`}
                  />
                  {w.status === "learned" ? "Выучил" : "Изучаю"}
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
              <span>{due.length} знакомых слова ждут повторения</span>
              <span>Выберите «Повторяю» сверху</span>
            </div>
          )}
        </section>
        <aside className="discovery-card">
          <div className="discovery-top">
            <span className="eyebrow">
              <Sparkles size={14} />
              МАЛЕНЬКОЕ ОТКРЫТИЕ
            </span>
            <button
              className="icon-button"
              aria-label="Прослушать слово дня"
              onClick={() => {
                if (!speak(discovery.word))
                  notify("Озвучка не поддерживается браузером.");
              }}
            >
              <Volume2 size={17} />
            </button>
          </div>
          <h3>{discovery.word}</h3>
          <span className="phonetic">/{discovery.phonetic}/</span>
          <p className="discovery-translation">{discovery.translation}</p>
          <p className="discovery-example">“{discovery.example}”</p>
          <button
            className="discovery-button"
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
