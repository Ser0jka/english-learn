/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["tabpanel", "log"] }] -- A scrollable conversation log needs keyboard access. */
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, BookOpen, ArrowUpRight } from "lucide-react";
import type { HelpContext } from "../types";
import Modal from "./Modal";
import { useServiceStatus, serializeHelpContext } from "../useMaterials";

import ServiceNotice from "./ServiceNotice";

export function referenceAnswer(
  context: HelpContext,
  question: string,
  preferAi = false,
): string | null {
  const q = question.toLowerCase();
  const { word, phrase } = context;
  if (phrase) {
    const quote = phrase.quote || phrase.bookQuotes?.[0];
    if (/пример|контекст|предложен/.test(q) && quote)
      return `“${quote.text}”\n${quote.translationKind === "summary" ? "Коротко по-русски: " : ""}${quote.translation}\n\n${[quote.title, quote.author, quote.location].filter(Boolean).join(" · ")}${quote.note ? `\n\n${quote.note}` : ""}\n\nПолный текст можно открыть по ссылке в справке выражения.`;
    if (
      preferAi &&
      phrase.dictionary &&
      /употреб|примен|исключ|нюанс|огранич|истор|происх|пример|контекст|предложен|когда|где/.test(
        q,
      )
    )
      return null;
    if (/исключ|нюанс|огранич|путать/.test(q)) return phrase.exceptions;
    if (/истор|происх|появ|возник|откуда/.test(q))
      return `${phrase.origin}\n\nИсточник значения: ${phrase.source.label}. Ссылка доступна в раскрывающейся справке выражения.`;
    if (/пример|контекст|предложен/.test(q))
      return phrase.example
        ? `${phrase.example}\n${phrase.exampleRu}\n\n${phrase.dictionary ? "Это пример из WordNet." : "Это учебный пример, не цитата."}`
        : null;
    if (
      /знач|перев|употреб|примен|объясн|использ|когда .*говор|где .*говор/.test(
        q,
      )
    )
      return `${phrase.text} — ${phrase.translation}.\n\n${phrase.usage}${phrase.definition ? `\n\n${phrase.definition}` : ""}\n\n${phrase.exceptions}`;
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
  const connection = useServiceStatus();
  const { available } = connection;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [failedQuestion, setFailedQuestion] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    scroll.current?.scrollTo({
      top: scroll.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);
  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setInput("");
    setFailedQuestion("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    const local = referenceAnswer(context, question, available);
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
          context: serializeHelpContext(context, question),
        }),
        signal: AbortSignal.any([
          abort.current.signal,
          AbortSignal.timeout(60000),
        ]),
      });
      const data: unknown = await result.json();
      if (
        !data ||
        typeof data !== "object" ||
        (result.ok &&
          (!("answer" in data) ||
            typeof data.answer !== "string" ||
            !data.answer.trim()))
      )
        throw new Error("Некорректный ответ помощника");
      const answer =
        result.ok && "answer" in data && typeof data.answer === "string"
          ? data.answer
          : "error" in data && typeof data.error === "string"
            ? data.error
            : "Не удалось получить ответ.";
      if (!result.ok) setFailedQuestion(question);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: answer,
        },
      ]);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setFailedQuestion(question);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "Связь прервалась. Попробуйте ещё раз или выберите вопрос из справочника.",
          },
        ]);
      }
    } finally {
      setBusy(false);
    }
  }
  if (context.assessmentLocked)
    return (
      <Modal
        title="Сначала вспомните сами"
        subtitle="Ответ и справка откроются после выбора."
        onClose={onClose}
      >
        <div className="form-body">
          <p>
            Выберите слово, которое соответствует образу и контексту. Можно
            использовать клавиши 1–4.
          </p>
          <p>
            Не уверены — попробуйте ответить. Ошибка не штрафуется: вы увидите
            перевод и получите короткое повторение через 5 минут. Справка,
            озвучка и ИИ до ответа скрыты, чтобы проверка оставалась
            самостоятельной.
          </p>
          <button className="button primary" onClick={onClose}>
            Вернуться к заданию
          </button>
        </div>
      </Modal>
    );
  const material = context.phrase?.text || context.word?.word || "ваши слова";
  return (
    <Modal
      title="Разберёмся вместе"
      className="modal-chat"
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
      <div className="assistant-availability">
        <ServiceNotice connection={connection} />
      </div>
      <div
        className="chat-messages"
        ref={scroll}
        role="log"
        tabIndex={0}
        aria-label="Переписка с помощником"
        aria-live="polite"
        aria-relevant="additions text"
      >
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
      {failedQuestion && (
        <div className="helper-retry">
          <button
            className="button secondary"
            onClick={() => void ask(failedQuestion)}
            disabled={busy}
          >
            Повторить вопрос
          </button>
        </div>
      )}
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
        aria-busy={busy}
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
    </Modal>
  );
}
