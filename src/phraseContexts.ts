import type { PhraseQuote } from "./data";

// Curated against complete public-domain texts, not generated quotations.
// Dictionary keys include the WordNet sense so homonyms do not share evidence.
export const SOURCED_PHRASE_EXAMPLES: Record<string, PhraseQuote> = {
  "learn-by-heart": {
    text: "Mr. Darcy's letter she was in a fair way of soon knowing by heart. She studied every sentence; and her feelings towards its writer were at times widely different.",
    translation:
      "Письмо мистера Дарси она вскоре могла бы знать наизусть. Она изучала каждое предложение, и её чувства к автору порой были совершенно разными.",
    author: "Джейн Остин",
    title: "Гордость и предубеждение / Pride and Prejudice",
    kind: "book",
    location: "Глава 37 · 1813",
    note: "Элизабет перечитывает письмо Дарси. Knowing by heart описывает результат запоминания; learning by heart — сам процесс.",
    url: "https://www.gutenberg.org/ebooks/1342.html.images",
  },
  "00613393-v:give up": {
    text: "Not yet, however, in spite of her disappointment in her husband, did Mrs. Bennet give up the point. She talked to Elizabeth again and again; coaxed and threatened her by turns.",
    translation:
      "И всё же, несмотря на разочарование в муже, миссис Беннет пока не отступилась от своего намерения. Она снова и снова говорила с Элизабет, попеременно уговаривая и угрожая.",
    author: "Джейн Остин",
    title: "Гордость и предубеждение / Pride and Prejudice",
    kind: "book",
    location: "Глава 20 · 1813",
    note: "Миссис Беннет настаивает на браке Элизабет. Give up the point здесь означает перестать настаивать на своём.",
    url: "https://www.gutenberg.org/ebooks/1342.html.images",
  },
  "00048739-r:at once": {
    text: "Just then her head struck against the roof of the hall: in fact she was now more than nine feet high, and she at once took up the little golden key and hurried off to the garden door.",
    translation:
      "В этот момент её голова ударилась о потолок зала: она выросла уже больше чем до девяти футов и тут же схватила маленький золотой ключик и поспешила к двери в сад.",
    author: "Льюис Кэрролл",
    title: "Алиса в Стране чудес / Alice’s Adventures in Wonderland",
    kind: "book",
    location: "Глава II, The Pool of Tears · 1865",
    note: "Алиса выросла и снова пытается попасть в сад. At once означает «немедленно», а не другое возможное значение — «одновременно».",
    url: "https://www.gutenberg.org/ebooks/11.html.images",
  },
  "02167435-v:look after": {
    text: "I had no difficulty in getting leave to come into Winchester this morning, but I must be back before three o'clock, for Mr. and Mrs. Rucastle are going on a visit, and will be away all the evening, so that I must look after the child.",
    translation:
      "Сегодня утром мне без труда разрешили съездить в Винчестер, но я должна вернуться до трёх: мистер и миссис Рукаслы едут в гости и будут отсутствовать весь вечер, так что мне нужно присматривать за ребёнком.",
    author: "Артур Конан Дойл",
    title: "Приключения Шерлока Холмса / The Adventures of Sherlock Holmes",
    kind: "book",
    location: "The Adventure of the Copper Beeches · 1892",
    note: "Гувернантка объясняет Холмсу свои обязанности. Look after the child — присматривать за ребёнком, заботиться о нём.",
    url: "https://www.gutenberg.org/ebooks/1661.html.images",
  },
};
