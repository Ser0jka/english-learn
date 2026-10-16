import { useCallback, useEffect, useState } from "react";
import { loadWordBank } from "./wordBank";
import { loadPhraseBank } from "./phraseBank";
export function useWordLibrary(
  kind: "words" | "phrases" = "words",
  enabled = true,
) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    setStatus("loading");
    setRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    let active = true;
    if (!enabled) return;
    (kind === "words" ? loadWordBank() : loadPhraseBank())
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [revision, kind, enabled]);
  return { status, retry };
}
