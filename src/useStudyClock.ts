import { useEffect, useState } from "react";
import type { Word } from "./data";
// Update derived due states at the deadline and when returning to the tab.
export function useStudyClock(words: Word[]) {
  const [now, setNow] = useState(Date.now);
  // An answer's timestamp must be visible immediately, not filtered out as
  // "future" until the next periodic tick.
  useEffect(() => setNow(Date.now()), [words]);
  useEffect(() => {
    const current = Date.now();
    const next = words.reduce(
      (earliest, w) =>
        w.dueAt > current ? Math.min(earliest, w.dueAt) : earliest,
      Infinity,
    );
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(25, Math.min(next - current, 60000)),
    );
    const refresh = () => setNow(Date.now());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [words, now]);
  return now;
}
