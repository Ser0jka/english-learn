import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Plus,
  FileText,
  Check,
  Volume2,
  ImagePlus,
  Trash2,
  Sparkles,
  LoaderCircle,
  CircleHelp,
} from "lucide-react";
import { CATALOG, type Word, type Status } from "../data";
import {
  makeWord,
  mergeWords,
  normalize,
  meaningKey,
  setWordStatus,
  validWord,
  parseImport,
  parseBackup,
  removeWord,
  speak,
} from "../domain";
import type { StudyProps } from "../types";
import { PARTS_OF_SPEECH } from "../learning";
import type { PartOfSpeech } from "../data";
import Modal from "./Modal";
import {
  compactImage,
  materialRequest,
  useServiceStatus,
} from "../useMaterials";
import WordArt from "./WordArt";
import ServiceNotice from "./ServiceNotice";

export function AddWords({
  store,
  setStore,
  notify,
  onClose,
  onOpenWord,
}: {
  store: StudyProps["store"];
  setStore: StudyProps["setStore"];
  notify: StudyProps["notify"];
  onClose: () => void;
  onOpenWord: (word: Word) => void;
}) {
  const [tab, setTab] = useState<"manual" | "import">("manual");
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [status, setStatus] = useState<Status>("learning");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<Word[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [restore, setRestore] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const importSummary = preview ? mergeWords(store.words, preview) : null;
  const missingImages =
    preview?.filter((w) => !(w.concept || w.image)).length || 0;
  function inspect() {
    try {
      setPreview(parseBackup(text)?.words || parseImport(text));
      setError("");
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Проверьте формат списка.");
    }
  }
  const backup = useMemo(() => {
    try {
      return parseBackup(text);
    } catch {
      return null;
    }
  }, [text]);
  function add(words: Word[]) {
    const result = mergeWords(store.words, words);
    if (!result.added) {
      setError("Эти слова уже есть в вашем словаре.");
      return;
    }
    setStore((s) => ({ ...s, words: mergeWords(s.words, words).words }));
    const created = words.find(
      (w) => !store.words.some((v) => meaningKey(v) === meaningKey(w)),
    );
    notify(
      `Добавлено слов: ${result.added}${result.duplicates ? ` · Уже были в словаре: ${result.duplicates}` : ""}`,
      result.added === 1 && created && !(created.concept || created.image)
        ? { label: "Добавить иллюстрацию", onClick: () => onOpenWord(created) }
        : undefined,
    );
    onClose();
  }
  async function readFile(file?: File) {
    if (!file) return;
    setError("");
    setPreview(null);
    setText("");
    setRestore(false);
    if (file.size > 20 * 1024 * 1024) {
      setError("Максимальный размер файла — 20 МБ.");
      return;
    }
    setFileName(file.name);
    setPending(true);
    try {
      const content = await file.text();
      setText(content);
      setPreview(parseBackup(content)?.words || parseImport(content));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось прочитать файл.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title="Больше слов. Больше возможностей."
      subtitle="Пополните свою коллекцию английского."
      onClose={onClose}
      wide
    >
      <div
        className="form-tabs"
        role="tablist"
        aria-label="Способ добавления слов"
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            const next =
              e.key === "Home"
                ? "manual"
                : e.key === "End"
                  ? "import"
                  : tab === "manual"
                    ? "import"
                    : "manual";
            setTab(next);
            e.currentTarget
              .querySelector<HTMLElement>(`[id="add-tab-${next}"]`)
              ?.focus();
          }
        }}
      >
        <button
          className={tab === "manual" ? "active" : ""}
          role="tab"
          id="add-tab-manual"
          aria-controls="add-panel-manual"
          aria-selected={tab === "manual"}
          tabIndex={tab === "manual" ? 0 : -1}
          onClick={() => {
            setTab("manual");
            setError("");
          }}
        >
          <Plus size={16} />
          Одно слово
        </button>
        <button
          className={tab === "import" ? "active" : ""}
          role="tab"
          id="add-tab-import"
          aria-controls="add-panel-import"
          aria-selected={tab === "import"}
          tabIndex={tab === "import" ? 0 : -1}
          onClick={() => {
            setTab("import");
            setError("");
          }}
        >
          <Upload size={16} />
          Загрузить список
        </button>
      </div>
      {tab === "manual" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (!/[a-z]/i.test(word) || !translation.trim()) {
              setError("Введите английское слово и перевод.");
              return;
            }
            add([makeWord(word, translation, status)]);
          }}
          className="form-body"
          role="tabpanel"
          id="add-panel-manual"
          aria-labelledby="add-tab-manual"
        >
          <label>
            Слово или выражение
            <input
              data-autofocus
              required
              maxLength={100}
              value={word}
              onChange={(e) => {
                const previous = CATALOG.find(
                  (w) => w.word === normalize(word),
                );
                setWord(e.target.value);
                const known = CATALOG.find(
                  (w) => w.word === normalize(e.target.value),
                );
                if (
                  !translation.trim() ||
                  translation === previous?.translation
                )
                  setTranslation(known?.translation || "");
              }}
              placeholder="Например, serendipity"
              autoComplete="off"
            />
          </label>
          <label>
            Перевод
            <input
              required
              maxLength={300}
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="Счастливая случайность"
            />
          </label>
          <fieldset>
            <legend>На каком вы этапе?</legend>
            <div className="status-choice">
              <button
                type="button"
                className={status === "learning" ? "active" : ""}
                aria-pressed={status === "learning"}
                onClick={() => setStatus("learning")}
              >
                <span className="status-dot learning" />
                Учу сейчас
              </button>
              <button
                type="button"
                className={status === "learned" ? "active" : ""}
                aria-pressed={status === "learned"}
                onClick={() => setStatus("learned")}
              >
                <Check size={16} />
                Уже выучил
              </button>
            </div>
          </fieldset>
          <p className="muted small">
            Одна запись — одно значение. Например, book — «книга» и book —
            «бронировать» можно добавить отдельно. Материалы подставляются
            только при совпадении значения; для остальных добавьте свой контекст
            или картинку.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" type="submit">
            <Plus size={17} />
            Добавить в словарь
          </button>
        </form>
      ) : (
        <div
          className="form-body"
          role="tabpanel"
          id="add-panel-import"
          aria-labelledby="add-tab-import"
          aria-busy={pending}
        >
          <button
            className={`upload-zone ${dragging ? "is-dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!pending) void readFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            <Upload size={27} />
            <strong>
              {pending
                ? "Читаем файл…"
                : fileName
                  ? fileName
                  : "Выберите файл или перетащите сюда"}
            </strong>
            <span>TXT, CSV или JSON · до 20 МБ</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.json,text/plain,text/csv,application/json"
            hidden
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <label>
            Или вставьте список
            <textarea
              rows={5}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPreview(null);
                setRestore(false);
              }}
              placeholder={
                "forest; лес; learning\njourney; путешествие; learned"
              }
            />
          </label>
          <p className="muted small">
            <FileText size={14} /> По одному слову на строку. Можно указать
            перевод и статус через точку с запятой. learning — учу, learned —
            выучил. Дубликаты пропустим.
          </p>
          <div className="import-inspect">
            <button
              className="button secondary"
              disabled={pending || !text.trim()}
              onClick={inspect}
            >
              Проверить список
            </button>
            <p>Покажем новые слова, дубликаты и недостающие картинки.</p>
          </div>
          {backup && (
            <div className="backup-preview">
              <strong>Полная резервная копия</strong>
              <p>
                {backup.words.length} слов · {backup.logs.length} ответов ·{" "}
                {backup.customPassages.length} дополнительных текстов
              </p>
              <label className="restore-choice">
                <input
                  type="checkbox"
                  checked={restore}
                  onChange={(e) => setRestore(e.target.checked)}
                />
                Восстановить весь прогресс и заменить текущую коллекцию
              </label>
              <small>
                Без этой отметки добавятся только новые слова. Текущие данные
                сохранятся.
              </small>
            </div>
          )}
          {preview && (
            <div className="import-preview">
              <strong>Готово к импорту: {importSummary?.added || 0}</strong>
              <ul>
                <li>
                  Уже в словаре или повторяются в файле:{" "}
                  {importSummary?.duplicates || 0}
                </li>
                {missingImages > 0 && (
                  <li>
                    Без иллюстрации: {missingImages}. Эти слова сохранятся в
                    словаре; картинку можно добавить позже.
                  </li>
                )}
              </ul>
              <p>
                {preview
                  .slice(0, 5)
                  .map((w) => w.word)
                  .join(" · ")}
                {preview.length > 5 ? " …" : ""}
              </p>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary full"
            disabled={pending || !text.trim()}
            onClick={() => {
              try {
                const saved = parseBackup(text);
                if (restore && saved) {
                  setStore(saved);
                  notify("Резервная копия восстановлена вместе с прогрессом");
                  onClose();
                  return;
                }
                add(preview || parseImport(text));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Проверьте формат.");
              }
            }}
          >
            <Upload size={17} />
            {restore && backup ? "Восстановить копию" : "Добавить слова"}
          </button>
        </div>
      )}
    </Modal>
  );
}
export function WordEditor({
  word,
  words,
  setStore,
  notify,
  onClose,
  onHelp,
}: {
  word: Word;
  words: Word[];
  setStore: StudyProps["setStore"];
  notify: StudyProps["notify"];
  onClose: () => void;
  onHelp: () => void;
}) {
  const [edit, setEdit] = useState({ ...word });
  const [synonymText, setSynonymText] = useState(word.synonyms.join(", "));
  const connection = useServiceStatus("image");
  const { available } = connection;
  const [generating, setGenerating] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function generateImage() {
    if (generating || !available) return;
    request.current = new AbortController();
    setGenerating(true);
    setError("");
    try {
      const data = await materialRequest<{ image: string }>(
        "image",
        { word: edit.word, translation: edit.translation },
        request.current.signal,
      );
      const image = await compactImage(data.image);
      setEdit((s) => ({ ...s, image }));
      notify("Иллюстрация готова. Сохраните карточку, если она подходит.");
    } catch (e) {
      if (!request.current?.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Не удалось создать изображение.",
        );
    } finally {
      setGenerating(false);
    }
  }

  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reading, setReading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  async function imageUpload(image?: File) {
    if (!image) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(image.type) ||
      image.size > 650 * 1024
    ) {
      setError("Нужна картинка JPG, PNG или WebP до 650 КБ.");
      return;
    }
    setReading(true);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(image);
      });
      const verifiedImage = await compactImage(url);
      setEdit((s) => ({ ...s, image: verifiedImage }));
      setError("");
    } catch {
      setError("Не удалось прочитать изображение.");
    } finally {
      setReading(false);
    }
  }
  return (
    <Modal
      title={word.word}
      subtitle={`${word.phonetic ? `/${word.phonetic}/ · ` : ""}${word.translation}`}
      onClose={onClose}
    >
      <div className="form-body">
        <div className="editor-image" aria-busy={reading || generating}>
          {edit.image ? (
            <img src={edit.image} alt={edit.word} />
          ) : (
            <WordArt concept={edit.concept} />
          )}
          <button
            className="image-upload"
            onClick={() => file.current?.click()}
            disabled={reading || generating}
          >
            <ImagePlus size={16} />
            {reading ? "Загрузка…" : "Своя картинка"}
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            void imageUpload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p className="muted small">
          Для самостоятельной проверки выбирайте иллюстрации без английских
          подписей. Приложение не распознаёт и не удаляет текст на ваших
          изображениях.
        </p>
        <ServiceNotice connection={connection} kind="image" />
        {available && (
          <button
            className="button secondary full"
            disabled={generating || reading || !edit.translation.trim()}
            aria-busy={generating}
            onClick={() => void generateImage()}
          >
            {generating ? (
              <LoaderCircle size={16} className="spinning" />
            ) : (
              <Sparkles size={16} />
            )}
            {generating
              ? "Создаём иллюстрацию…"
              : "Создать иллюстрацию по слову"}
          </button>
        )}
        <label>
          Перевод
          <input
            maxLength={300}
            value={edit.translation}
            onChange={(e) => setEdit({ ...edit, translation: e.target.value })}
          />
        </label>
        <div className="two-fields">
          <label>
            Статус
            <select
              value={edit.status}
              onChange={(e) =>
                setEdit(setWordStatus(edit, e.target.value as Status))
              }
            >
              <option value="learning">Учу сейчас</option>
              <option value="learned">Выучил</option>
            </select>
          </label>
          <label>
            Иллюстрация
            <select
              value={edit.concept}
              onChange={(e) =>
                setEdit({ ...edit, concept: e.target.value, image: undefined })
              }
            >
              <option value="">Без иллюстрации</option>
              {CATALOG.filter(
                (w, i, all) =>
                  all.findIndex((v) => v.concept === w.concept) === i,
              ).map((w) => (
                <option key={w.id} value={w.concept}>
                  {w.translation}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted small">
          Ручная отметка «Выучил» — самооценка, а не результат тестов; проверка
          назначается через день. Изменение перевода создаёт другое значение и
          сбрасывает прежний прогресс при сохранении.
        </p>
        <p className="muted small">
          Для зачётной практики укажите часть речи: это помогает составить
          однородные варианты, по которым нельзя угадать ответ только по
          грамматике. Для неизвестного значения она не определяется
          автоматически.
        </p>
        <label>
          Часть речи
          <select
            value={edit.partOfSpeech || "unknown"}
            onChange={(e) =>
              setEdit({ ...edit, partOfSpeech: e.target.value as PartOfSpeech })
            }
          >
            {(Object.entries(PARTS_OF_SPEECH) as [PartOfSpeech, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Синонимы для этого значения
          <input
            maxLength={2000}
            value={synonymText}
            onChange={(e) => setSynonymText(e.target.value)}
            placeholder="Например, woods, woodland"
          />
        </label>
        <p className="muted small">
          До 20 вариантов через запятую. Укажите только подходящие к этому
          значению слова. Они считаются правильными; все остальные значения
          одного написания учатся отдельно.
        </p>
        <label>
          Пример на английском
          <textarea
            maxLength={4000}
            value={edit.example}
            onChange={(e) => setEdit({ ...edit, example: e.target.value })}
            placeholder="Пример должен содержать изучаемое слово. В задании оно будет скрыто."
            rows={3}
          />
        </label>
        <label>
          Перевод примера
          <textarea
            maxLength={4000}
            value={edit.exampleRu}
            onChange={(e) => setEdit({ ...edit, exampleRu: e.target.value })}
            rows={2}
          />
        </label>
        {word.example && (
          <div className="example-box">
            <button
              className="icon-button"
              aria-label="Прослушать пример"
              onClick={() => {
                if (!speak(word.example))
                  notify("Озвучка не поддерживается этим браузером.");
              }}
            >
              <Volume2 size={18} />
            </button>
            <p>{word.example}</p>
            <span>{word.exampleRu}</span>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="text-button gold" onClick={onHelp}>
          <CircleHelp size={16} />
          Спросить об этом слове
        </button>
        <div className="modal-actions">
          <button
            className="button danger-ghost"
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              setStore((s) => removeWord(s, word.id));
              notify("Слово удалено");
              onClose();
            }}
          >
            <Trash2 size={16} />
            {confirmDelete ? "Подтвердить удаление" : "Удалить"}
          </button>
          <button
            className="button primary"
            disabled={reading || generating}
            onClick={() => {
              if (!edit.translation.trim()) {
                setError("Добавьте перевод.");
                return;
              }
              const changed = meaningKey(edit) !== meaningKey(word);
              const synonyms = [
                ...new Map(
                  synonymText
                    .split(/[,;]/)
                    .map((v) => v.trim())
                    .filter(Boolean)
                    .map((v) => [normalize(v), v]),
                ).values(),
              ];
              const next: Word = {
                ...edit,
                translation: edit.translation.trim(),
                synonyms,
              };
              if (changed) {
                Object.assign(next, {
                  status: "learning",
                  successes: 0,
                  lastReviewedAt: undefined,
                  mastery: undefined,
                  lapses: 0,
                  dueAt: 0,
                });
                // Never silently transfer a different meaning's material to the edited entry.
                if (edit.image === word.image) next.image = undefined;
                if (edit.concept === word.concept) next.concept = "";
                if (edit.example === word.example) next.example = "";
                if (edit.exampleRu === word.exampleRu) next.exampleRu = "";
                if (edit.definition === word.definition) next.definition = "";
                if (synonymText === word.synonyms.join(", "))
                  next.synonyms = [];
                if (edit.partOfSpeech === word.partOfSpeech)
                  next.partOfSpeech = "unknown";
              }
              if (!validWord(next)) {
                setError(
                  "Проверьте синонимы: до 20 разных вариантов, без самого слова, до 100 символов каждый.",
                );
                return;
              }
              if (
                words.some(
                  (w) => w.id !== word.id && meaningKey(w) === meaningKey(next),
                )
              ) {
                setError(
                  "Это значение уже есть в словаре. Откройте существующую запись.",
                );
                return;
              }
              setStore((s) => ({
                ...s,
                words: s.words.map((w) => (w.id === word.id ? next : w)),
              }));
              notify("Слово обновлено");
              onClose();
            }}
          >
            <Check size={17} />
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
