import { CheckCircle2, XCircle } from "lucide-react";
import { DEFAULT_APPEARANCE, type Appearance } from "../appearance";
export default function AppearanceSettings({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (value: Appearance) => void;
}) {
  return (
    <section className="appearance-settings" aria-label="Оформление">
      <h3>Оформление</h3>
      <p className="muted small">
        Тёмная основа и спокойные металлические акценты. Изменения видны сразу и
        сохраняются вместе с прогрессом.
      </p>
      <fieldset className="accent-options">
        <legend>Акцент интерфейса</legend>
        {(
          [
            ["brass", "Латунь"],
            ["silver", "Серебро"],
            ["amber", "Золотисто-оранжевый"],
          ] as const
        ).map(([id, label]) => (
          <label key={id} className={`accent-choice accent-${id}`}>
            <input
              type="radio"
              name="accent"
              value={id}
              checked={value.accent === id}
              onChange={() => onChange({ ...value, accent: id })}
            />
            <span className="accent-swatch" />
            {label}
          </label>
        ))}
      </fieldset>
      <label>
        Тёмный фон
        <select
          value={value.background}
          onChange={(e) =>
            onChange({
              ...value,
              background: e.target.value as Appearance["background"],
            })
          }
        >
          <option value="black">Глубокий чёрный</option>
          <option value="graphite">Чёрный графит</option>
        </select>
      </label>
      <label>
        Размер текста
        <select
          value={value.textSize}
          onChange={(e) =>
            onChange({
              ...value,
              textSize: e.target.value as Appearance["textSize"],
            })
          }
        >
          <option value="normal">Обычный</option>
          <option value="large">Крупнее</option>
        </select>
      </label>
      <label className="feedback-toggle">
        <input
          type="checkbox"
          checked={value.feedbackGlow}
          onChange={(e) =>
            onChange({ ...value, feedbackGlow: e.target.checked })
          }
        />
        Перелив зелёного и малинового в ответах
      </label>
      <div className="feedback-preview">
        <div className="answer-feedback success">
          <CheckCircle2 size={18} />
          Верно
        </div>
        <div className="answer-feedback error">
          <XCircle size={18} />
          Неверно
        </div>
      </div>
      <button
        className="button secondary full"
        onClick={() => onChange({ ...DEFAULT_APPEARANCE })}
      >
        Сбросить оформление
      </button>
    </section>
  );
}
