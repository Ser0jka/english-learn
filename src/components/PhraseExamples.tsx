import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { Phrase, PhraseExample } from "../data";
import type { StudyProps } from "../types";
import { validPhraseExamples } from "../domain";
import { contextSignature } from "../bookLibrary";
import { materialRequest } from "../useMaterials";

export default function PhraseExamples({
  phrase,
  store,
  setStore,
  available,
}: Pick<StudyProps, "store" | "setStore"> & {
  phrase: Phrase;
  available: boolean;
}) {
  const signature = contextSignature(phrase);
  const saved = store.phraseExamples?.[phrase.id];
  const examples =
    saved?.signature === signature ? saved.examples : phrase.examples || [];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const find = useCallback(async () => {
    if (!available || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    try {
      const result = await materialRequest<{ examples: PhraseExample[] }>(
        "phrase-examples",
        {
          text: phrase.text,
          translation: phrase.translation,
          ...(phrase.definition
            ? { definition: phrase.definition.slice(0, 1500) }
            : {}),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!validPhraseExamples(result.examples))
        throw new Error("Не удалось прочитать примеры. Попробуйте ещё раз.");
      setStore((state) => ({
        ...state,
        words: state.words.map((word) =>
          word.sourcePhraseId === phrase.id &&
          word.translation === phrase.translation &&
          (!word.example || !word.exampleRu)
            ? {
                ...word,
                example: result.examples[0].text,
                exampleRu: result.examples[0].translation,
              }
            : word,
        ),
        phraseExamples: Object.fromEntries([
          ...Object.entries(state.phraseExamples || {})
            .filter(([key]) => key !== phrase.id)
            .slice(-999),
          [phrase.id, { signature, examples: result.examples }],
        ]),
      }));
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Примеры пока недоступны.",
        );
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending(false);
      }
    }
  }, [
    available,
    phrase.text,
    phrase.translation,
    phrase.definition,
    phrase.id,
    signature,
    setStore,
  ]);
  useEffect(() => {
    if (
      !started.current &&
      available &&
      !examples.length &&
      (!phrase.example || !phrase.exampleRu)
    ) {
      started.current = true;
      void find();
    }
  }, [available, examples.length, phrase.example, phrase.exampleRu, find]);
  return (
    <section aria-label="Примеры употребления" className="phrase-examples">
      {examples.length ? (
        examples.map((example, index) => (
          <div className="phrase-example" key={index}>
            <span className="eyebrow">
              {saved?.signature === signature || phrase.generated
                ? "УЧЕБНЫЙ ПРИМЕР ПОМОЩНИКА"
                : "УЧЕБНЫЙ ПРИМЕР"}{" "}
              · {index + 1}
            </span>
            <p lang="en">“{example.text}”</p>
            <span>{example.translation}</span>
          </div>
        ))
      ) : phrase.example ? (
        <div className="phrase-example">
          <span className="eyebrow">
            {phrase.dictionary
              ? "СЛОВАРНЫЙ ПРИМЕР"
              : phrase.generated
                ? "УЧЕБНЫЙ ПРИМЕР ПОМОЩНИКА"
                : "УЧЕБНЫЙ ПРИМЕР"}
          </span>
          <p lang="en">“{phrase.example}”</p>
          {phrase.exampleRu && <span>{phrase.exampleRu}</span>}
        </div>
      ) : null}
      {pending && (
        <p role="status" className="book-search-status">
          <LoaderCircle size={17} className="spinning" /> Готовим примеры с
          переводом…
        </p>
      )}
      {error && (
        <p className="muted small" role="status">
          {error}
        </p>
      )}
      {!pending &&
        available &&
        !examples.length &&
        (!phrase.example || !phrase.exampleRu) && (
          <button className="button secondary" onClick={() => void find()}>
            {error ? "Повторить подбор примеров" : "Подготовить примеры"}
          </button>
        )}
      {!available && !examples.length && !phrase.example && (
        <p className="muted small">
          Учебные примеры можно подготовить, когда помощник снова станет
          доступен.
        </p>
      )}
    </section>
  );
}
