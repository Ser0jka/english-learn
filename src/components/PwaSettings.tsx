import { Download, RefreshCw, WifiOff } from "lucide-react";
import { usePwa } from "../usePwa";
export default function PwaSettings({
  pwa,
  storageError,
}: {
  pwa: ReturnType<typeof usePwa>;
  storageError: string;
}) {
  return (
    <section
      className="appearance-settings"
      aria-label="Приложение на телефоне"
    >
      <h3>На телефоне</h3>
      <p className="muted">
        {pwa.installed
          ? "Lexi открывается как отдельное приложение."
          : "Добавьте Lexi на главный экран, чтобы открывать его одним касанием."}
      </p>
      {pwa.canInstall ? (
        <button
          className="button primary full"
          onClick={() => void pwa.install()}
        >
          <Download size={17} />
          Установить Lexi
        </button>
      ) : (
        !pwa.installed && (
          <p className="muted small">
            iPhone: Safari → «Поделиться» → «На экран Домой». Android: меню
            браузера → «Установить приложение» или «На главный экран». Установка
            требует защищённого соединения.
          </p>
        )
      )}
      <p className="muted small">
        <WifiOff size={15} />{" "}
        {pwa.ready
          ? "Оболочка готова к работе без сети. Уже открытые словари сохраняются в кеше браузера."
          : "После первого открытия production-версии оболочка подготавливается для работы без сети."}{" "}
        ИИ требует подключения. Очистка данных браузера удаляет прогресс и кеш.
      </p>
      {pwa.error && (
        <p className="form-error" role="alert">
          {pwa.error}
        </p>
      )}
      {pwa.hasUpdate && (
        <>
          <p className="muted small">
            Доступна новая версия. Закончите редактирование перед обновлением.
          </p>
          <button
            className="button secondary full"
            disabled={!!storageError}
            onClick={pwa.applyUpdate}
          >
            <RefreshCw size={17} />
            Обновить приложение
          </button>
          {storageError && (
            <p className="muted small">
              Сначала экспортируйте несохранённый прогресс через предупреждение
              вверху.
            </p>
          )}
        </>
      )}
    </section>
  );
}
