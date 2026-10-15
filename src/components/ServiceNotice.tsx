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
          ? "Создание иллюстраций доступно. Перед сохранением проверьте результат."
          : "Помощник подключён. Можно задавать свободные вопросы и создавать новые материалы."
        : status === "offline"
          ? "Нет связи с помощником. Ваш словарь и встроенные материалы по-прежнему доступны."
          : kind === "image"
            ? "Автосоздание иллюстраций пока не подключено. Можно загрузить свою картинку."
            : "Свободный ИИ-диалог пока не подключён. Справки по словам, выражениям и готовые истории доступны сразу.";
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
        {status === "offline" && (
          <button className="text-button" onClick={retry}>
            <RefreshCw size={15} />
            Повторить подключение
          </button>
        )}
      </div>
    </div>
  );
}
