import { LoaderCircle, RotateCcw } from "lucide-react";
export default function LibraryNotice({
  status,
  onRetry,
}: {
  status: "loading" | "error";
  onRetry: () => void;
}) {
  return (
    <div
      className="empty-state panel"
      role={status === "error" ? "alert" : "status"}
      aria-busy={status === "loading"}
    >
      {status === "loading" ? (
        <LoaderCircle className="spinning" size={28} />
      ) : (
        <RotateCcw size={28} />
      )}
      <h2>
        {status === "loading"
          ? "Готовим словарную базу"
          : "Словарь не загрузился"}
      </h2>
      <p>
        {status === "loading"
          ? "Загружаем материалы для карточек. Ваш прогресс остаётся на устройстве."
          : "Проверьте соединение и повторите. Сохранённый прогресс не изменён."}
      </p>
      {status === "error" && (
        <button className="button primary" onClick={onRetry}>
          Повторить загрузку
        </button>
      )}
    </div>
  );
}
