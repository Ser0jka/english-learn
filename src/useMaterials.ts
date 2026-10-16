import { useCallback, useEffect, useState } from "react";
export type ServiceStatus = "loading" | "ready" | "unconfigured" | "offline";
export function useServiceStatus(kind: "text" | "image" = "text") {
  const [status, setStatus] = useState<ServiceStatus>("loading");
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    setStatus("loading");
    setRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/health", {
      cache: "no-store",
      signal: AbortSignal.any([c.signal, AbortSignal.timeout(8000)]),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Health check failed");
        const data: unknown = await r.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("ok" in data) ||
          data.ok !== true
        )
          throw new Error("Invalid health response");
        const value =
          kind === "image" && "imageAvailable" in data
            ? data.imageAvailable
            : "aiAvailable" in data
              ? data.aiAvailable
              : false;
        return value === true;
      })
      .then((available) => {
        if (!c.signal.aborted) setStatus(available ? "ready" : "unconfigured");
      })
      .catch(() => {
        if (!c.signal.aborted) setStatus("offline");
      });
    return () => c.abort();
  }, [kind, revision]);
  return { status, available: status === "ready", retry };
}
export function useCapabilities(kind: "text" | "image" = "text") {
  return useServiceStatus(kind).available;
}
export async function materialRequest<T>(
  kind: "words" | "phrases" | "reading" | "image",
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

// Respect both the 12,000-character context limit and the 24 KiB HTTP body limit.
export function serializeHelpContext(
  context: import("./types").HelpContext,
  question: string,
): string {
  const omitImage = (key: string, value: unknown) =>
    key === "image" ? undefined : value;
  const full = JSON.stringify(context, omitImage);
  const size = (serialized: string) =>
    new TextEncoder().encode(JSON.stringify({ question, context: serialized }))
      .length;
  const fits = (serialized: string) =>
    serialized.length <= 12000 && size(serialized) <= 23000;
  if (fits(full)) return full;
  let max = 3000;
  while (max >= 1) {
    const bounded = JSON.stringify(
      { ...context, contextTruncated: true },
      (key, value: unknown) =>
        key === "image"
          ? undefined
          : typeof value === "string"
            ? value.slice(0, max)
            : value,
    );
    if (fits(bounded)) return bounded;
    max = Math.floor(max / 2);
  }
  throw new Error("Вопрос слишком большой для отправки. Сократите его.");
}
