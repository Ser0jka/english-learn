import { useEffect, useState } from "react";
export function useCapabilities(kind: "text" | "image" = "text") {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/health", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Health check failed");
        return r.json();
      })
      .then((data) =>
        setAvailable(
          Boolean(
            kind === "image"
              ? (data.imageAvailable ?? data.aiAvailable)
              : data.aiAvailable,
          ),
        ),
      )
      .catch(() => {
        if (!c.signal.aborted) setAvailable(false);
      });
    return () => c.abort();
  }, [kind]);
  return available;
}
export async function materialRequest<T>(
  kind: "phrases" | "reading" | "image",
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  try {
    const timeout = AbortSignal.timeout(kind === "image" ? 125000 : 55000);
    const response = await fetch(`/api/materials/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error("Сервер вернул некорректный ответ. Попробуйте позже.");
    }
    if (!response.ok)
      throw new Error(
        data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
          ? data.error
          : "Не удалось получить материал.",
      );
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Сервер вернул неполный материал. Попробуйте ещё раз.");
    return data as T;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "Не удалось связаться с сервером. Проверьте соединение и повторите запрос.",
      );
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new Error("Помощник не ответил вовремя. Попробуйте позже.");
    throw error;
  }
}

export async function compactImage(src: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось прочитать иллюстрацию."));
    img.src = src;
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 768 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не поддерживает обработку изображений.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = canvas.toDataURL("image/webp", 0.75);
  if (result.length > 850000)
    throw new Error(
      "Изображение слишком большое. Загрузите уменьшенную копию.",
    );
  return result;
}
