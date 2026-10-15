import { useEffect, useState } from "react";
export function useCapabilities() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/health", { signal: c.signal })
      .then((r) => r.json())
      .then((data) => setAvailable(Boolean(data.aiAvailable)))
      .catch(() => {});
    return () => c.abort();
  }, []);
  return available;
}
export async function materialRequest<T>(
  kind: "phrases" | "reading" | "image",
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/materials/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Не удалось получить материал.",
    );
  return data as T;
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
