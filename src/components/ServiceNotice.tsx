import {
  BookOpen,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  WifiOff,
} from "lucide-react";
import type { useServiceStatus } from "../useMaterials";
export default function ServiceNotice({
  connection,
  kind = "text",
}: {
  connection: ReturnType<typeof useServiceStatus>;
  kind?: "text" | "image";
}) {
  const { status, retry } = connection;
  const copy =
    status === "loading"
      ? "Проверяем доступность помощника…"
      : status === "ready"
        ? kind === "image"
          ? "Сервис иллюстраций настроен. Перед сохранением проверьте результат."
          : "ИИ настроен на сервере. Можно задавать свободные вопросы и создавать новые материалы."
        : status === "offline"
          ? "Нет связи с помощником. Ваш словарь и встроенные материалы по-прежнему доступны."
          : kind === "image"
            ? "Автосоздание иллюстраций пока не подключено. Можно загрузить свою картинку."
            : "ИИ не настроен на этом сервере: отсутствует API-ключ. Генерация слов, выражений и текстов пока недоступна. Ваш словарь и готовые материалы работают.";
  const Icon =
    status === "loading"
      ? LoaderCircle
      : status === "offline"
        ? WifiOff
        : status === "ready"
          ? Sparkles
          : BookOpen;
  return (
    <div className="service-notice" data-status={status} aria-live="polite">
      <Icon size={17} className={status === "loading" ? "spinning" : ""} />
      <div>
        {copy}
        {status === "unconfigured" && kind === "text" && (
          <details className="service-setup">
            <summary>Как подключить ИИ</summary>
            <p>
              При скачивании приложения из GitHub или ZIP секретный ключ не
              переносится. Если вы запускаете приложение сами, создайте файл
              <code> .env.local </code> в папке с <code>package.json</code> и
              укажите настройки Groq:
            </p>
            <pre>
              <code>{`LEXI_API_KEY=ваш_ключ_Groq
LEXI_API_BASE=https://api.groq.com/openai/v1
LEXI_MODEL=openai/gpt-oss-120b`}</code>
            </pre>
            <p>
              Подставьте свой ключ и перезапустите сервер приложения. На
              хостинге задайте эти переменные в настройках серверного
              приложения. Ключ должен оставаться на сервере; не добавляйте его в
              GitHub или файлы сайта.
            </p>
            <p>После перезапуска нажмите «Проверить подключение».</p>
          </details>
        )}
        {(status === "offline" || status === "unconfigured") && (
          <button className="text-button" onClick={retry}>
            <RefreshCw size={15} />
            {status === "offline"
              ? "Повторить подключение"
              : "Проверить подключение"}
          </button>
        )}
      </div>
    </div>
  );
}
