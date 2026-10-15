import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, BookOpen, ArrowUpRight } from "lucide-react";
import type { HelpContext } from "../types";
import Modal from "./Modal";

export function referenceAnswer(
  context: HelpContext,
  question: string,
): string | null {
  const q = question.toLowerCase();
  const { word, phrase } = context;
  if (phrase) {
    if (/исключ|нюанс|огранич|путать/.test(q)) return phrase.exceptions;
    if (/истор|происх|появ|возник|откуда/.test(q))
      return `${phrase.origin}\n\nИсточник значения: ${phrase.source.label}. Ссылка доступна в раскрывающейся справке выражения.`;
    if (/пример|контекст|предложен/.test(q))
      return `${phrase.example}\n${phrase.exampleRu}\n\nЭто учебный пример, не цитата.${phrase.quote ? `\n\nПример из литературы:\n“${phrase.quote.text}”\n${phrase.quote.translation}\n${phrase.quote.author}` : ""}`;
    if (
      /знач|перев|употреб|примен|объясн|использ|когда .*говор|где .*говор/.test(
        q,
      )
    )
      return `${phrase.text} — ${phrase.translation}.\n\n${phrase.usage}\n\n${phrase.exceptions}`;
  }
  if (word) {
    if (/пример|контекст|предложен/.test(q))
      return word.example
        ? `${word.example}\n${word.exampleRu}\n\nЭто учебный пример, не цитата.`
        : "Для этого слова пока нет проверенного примера в справочнике.";
    if (/синоним/.test(q))
      return word.synonyms.length
        ? `Близкие слова: ${word.synonyms.join(", ")}.\n\nОни подходят к образу в карточке, но не обязательно взаимозаменяемы во всех контекстах.`
        : "В справочнике пока нет проверенных синонимов этого слова. Одинаковый перевод не всегда означает одинаковое употребление.";
    if (/истор|происх|исключ/.test(q))
      return "Для этого слова в справочнике пока нет достоверных сведений по этому вопросу. Не будем придумывать: изучите примеры и значение, а происхождение лучше проверить в этимологическом словаре.";
    if (
      /знач|перев|употреб|примен|объясн|использ|когда .*говор|где .*говор/.test(
        q,
      )
    )
      return `${word.word} — ${word.translation || "перевод ещё не добавлен"}.${word.definition ? `\n\n${word.definition}` : ""}${word.example ? `\n\n${word.example}\n${word.exampleRu}` : ""}`;
  }
  return null;
}
export default function Help({
  context,
  onClose,
}: {
  context: HelpContext;
  onClose: () => void;
}) {
  const [available, setAvailable] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/health", { signal: c.signal })
      .then((r) => r.json())
      .then((v) => setAvailable(Boolean(v.aiAvailable)))
      .catch(() => {});
    return () => {
      c.abort();
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({
      top: scroll.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);
  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    const local = referenceAnswer(context, question);
    if (local) {
      setMessages((m) => [...m, { role: "assistant", text: local }]);
      return;
    }
    if (!available) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "В справочнике пока нет ответа на этот вопрос. Я могу объяснить значение, показать учебный пример или рассказать об употреблении выбранного выражения. Свободный диалог сейчас недоступен.",
        },
      ]);
      return;
    }
    setBusy(true);
    abort.current = new AbortController();
    try {
      const result = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context: JSON.stringify({
            ...context,
            word: context.word
              ? { ...context.word, image: undefined }
              : undefined,
          }),
        }),
        signal: abort.current.signal,
      });
      const data = await result.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: result.ok
            ? data.answer
            : data.error || "Не удалось получить ответ.",
        },
      ]);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "Связь прервалась. Попробуйте ещё раз или выберите вопрос из справочника.",
          },
        ]);
    } finally {
      setBusy(false);
    }
  }
  const material = context.phrase?.text || context.word?.word || "ваши слова";
  return (
    <Modal
      title="Разберёмся вместе"
      subtitle={
        available
          ? "Справка по материалу и помощник по английскому"
          : "Справка по текущему материалу"
      }
      onClose={onClose}
    >
      <div className="help-material">
        <BookOpen size={17} />
        <span>Сейчас изучаем</span>
        <strong>{material}</strong>
      </div>
      <div className="chat-messages" ref={scroll}>
        <div className="chat-message assistant">
          <span className="chat-avatar">
            <Sparkles size={16} />
          </span>
          <div>
            Каждое слово — маленькая история. Что хотите узнать о{" "}
            <b>{material}</b>?
          </div>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role}`}>
            {m.role === "assistant" && (
              <span className="chat-avatar">
                <Sparkles size={16} />
              </span>
            )}
            <div>{m.text}</div>
          </div>
        ))}
        {busy && (
          <div className="chat-thinking" role="status">
            Ищу понятное объяснение<span>•••</span>
          </div>
        )}
      </div>
      <div className="quick-questions">
        {[
          "Что это значит?",
          "Пример в контексте",
          context.phrase ? "История выражения" : "Какие есть синонимы?",
        ].map((q) => (
          <button key={q} onClick={() => void ask(q)} disabled={busy}>
            {q}
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label className="sr-only" htmlFor="help-input">
          Ваш вопрос
        </label>
        <input
          id="help-input"
          maxLength={2000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ваш вопрос об английском…"
          autoComplete="off"
        />
        <button
          className="send-button"
          disabled={!input.trim() || busy}
          aria-label="Отправить вопрос"
        >
          <ArrowUp size={20} />
        </button>
      </form>
      <p className="chat-disclaimer">
        {available
          ? "Ответы помощника стоит проверять. Достоверные источники указаны в справках."
          : "Ответы из встроенных материалов. Источники — в справках выражений."}
      </p>
    </Modal>
  );
}
