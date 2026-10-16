import { LoaderCircle, RefreshCw, WifiOff } from "lucide-react";
import type { useServiceStatus } from "../useMaterials";
export default function ServiceNotice({
  connection,
  kind = "text",
}: {
  connection: ReturnType<typeof useServiceStatus>;
  kind?: "text" | "image";
}) {
  const { status, retry } = connection;
  if (status === "ready") return null;
  const loading = status === "loading";
  const Icon = loading ? LoaderCircle : WifiOff;
  return (
    <div className="service-notice" data-status={status} aria-live="polite">
      <Icon size={17} className={loading ? "spinning" : ""} />
      <div>
        {loading
          ? "Подключаемся…"
          : kind === "image"
            ? "Создание иллюстраций сейчас недоступно."
            : "Помощник сейчас недоступен."}
        {!loading && (
          <button className="text-button" onClick={retry}>
            <RefreshCw size={15} />
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
}
