export type Mode = "learn" | "review" | "new";
export type Status = "learning" | "learned";
export type Page = "home" | "cards" | "phrases" | "reading" | "words";
export type PartOfSpeech =
  "noun" | "verb" | "adjective" | "adverb" | "phrase" | "unknown";
export type LearningState = Status | "due";
export type Topic = "everyday" | "travel" | "ideas";
export interface Word {
  id: string;
  word: string;
  translation: string;
  phonetic: string;
  definition: string;
  example: string;
  exampleRu: string;
  synonyms: string[];
  concept: string;
  level: string;
  topic: Topic;
  status: Status;
  successes: number;
  dueAt: number;
  addedAt: number;
  image?: string;
  partOfSpeech?: PartOfSpeech;
  lastReviewedAt?: number;
  lapses?: number;
  mastery?: "manual" | "scheduled";
  bankId?: string;
}
export interface Phrase {
  generated?: boolean;
  id: string;
  text: string;
  translation: string;
  keywords: string[];
  frequency: number;
  frequencyLabel: string;
  usage: string;
  exceptions: string;
  origin: string;
  example: string;
  exampleRu: string;
  source: { label: string; url: string };
  quote?: { text: string; translation: string; author: string; url: string };
}
const entries: Array<
  [
    string,
    string,
    string,
    string,
    string,
    string,
    string[],
    string,
    string,
    Topic,
  ]
> = [
  [
    "forest",
    "лес",
    "ˈfɒrɪst",
    "A large area covered with trees.",
    "We followed a quiet path through the forest.",
    "Мы шли по тихой тропинке через лес.",
    ["woods", "woodland"],
    "forest",
    "A2",
    "travel",
  ],
  [
    "journey",
    "путешествие",
    "ˈdʒɜːni",
    "The act of travelling from one place to another.",
    "Every journey begins with a single step.",
    "Каждое путешествие начинается с одного шага.",
    ["trip"],
    "journey",
    "A2",
    "travel",
  ],
  [
    "book",
    "книга",
    "bʊk",
    "A set of pages with a story or information.",
    "This book opened a whole new world to me.",
    "Эта книга открыла для меня целый новый мир.",
    [],
    "book",
    "A1",
    "everyday",
  ],
  [
    "bridge",
    "мост",
    "brɪdʒ",
    "A structure built over a river, road, or gap.",
    "An old bridge connects the two villages.",
    "Старый мост соединяет две деревни.",
    [],
    "bridge",
    "A2",
    "travel",
  ],
  [
    "ocean",
    "океан",
    "ˈəʊʃən",
    "A very large area of salt water.",
    "We could hear the ocean from our window.",
    "Из нашего окна было слышно океан.",
    [],
    "ocean",
    "A2",
    "travel",
  ],
  [
    "coffee",
    "кофе",
    "ˈkɒfi",
    "A drink made from roasted coffee beans.",
    "Would you like a cup of coffee?",
    "Хочешь чашку кофе?",
    [],
    "coffee",
    "A1",
    "everyday",
  ],
  [
    "window",
    "окно",
    "ˈwɪndəʊ",
    "An opening in a wall that lets in light.",
    "She opened the window to let in some air.",
    "Она открыла окно, чтобы впустить немного воздуха.",
    [],
    "window",
    "A1",
    "everyday",
  ],
  [
    "mountain",
    "гора",
    "ˈmaʊntɪn",
    "A very high natural area of land.",
    "The mountain was covered in snow.",
    "Гора была покрыта снегом.",
    [],
    "mountain",
    "A1",
    "travel",
  ],
  [
    "time",
    "время",
    "taɪm",
    "What we measure in seconds, minutes, and hours.",
    "Take your time; there is no need to hurry.",
    "Не торопись: спешить некуда.",
    [],
    "time",
    "A1",
    "everyday",
  ],
  [
    "light",
    "свет",
    "laɪt",
    "The brightness that makes things visible.",
    "Soft light filled the room.",
    "Мягкий свет наполнил комнату.",
    [],
    "light",
    "A1",
    "everyday",
  ],
  [
    "rain",
    "дождь",
    "reɪn",
    "Drops of water falling from clouds.",
    "The rain stopped just before we left.",
    "Дождь прекратился как раз перед нашим уходом.",
    [],
    "rain",
    "A1",
    "everyday",
  ],
  [
    "key",
    "ключ",
    "kiː",
    "An object used to open or lock something.",
    "I left my key on the table.",
    "Я оставил ключ на столе.",
    [],
    "key",
    "A1",
    "everyday",
  ],
  [
    "heart",
    "сердце",
    "hɑːt",
    "The organ that pumps blood around the body.",
    "Her heart beats faster when she runs.",
    "Когда она бежит, её сердце бьётся быстрее.",
    [],
    "heart",
    "A1",
    "ideas",
  ],
  [
    "dream",
    "мечта",
    "driːm",
    "Something you hope to achieve in the future.",
    "Her dream is to travel around the world.",
    "Её мечта — путешествовать по миру.",
    [],
    "dream",
    "A2",
    "ideas",
  ],
  [
    "courage",
    "смелость",
    "ˈkʌrɪdʒ",
    "The ability to do something even when you are afraid.",
    "It takes courage to try something new.",
    "Чтобы попробовать что-то новое, нужна смелость.",
    ["bravery"],
    "courage",
    "B1",
    "ideas",
  ],
  [
    "bloom",
    "цвести",
    "bluːm",
    "To produce flowers.",
    "The garden begins to bloom in spring.",
    "Весной сад начинает цвести.",
    ["blossom"],
    "bloom",
    "B1",
    "ideas",
  ],
  [
    "home",
    "дом",
    "həʊm",
    "The place where you live and feel you belong.",
    "It feels good to be home.",
    "Как хорошо быть дома.",
    [],
    "home",
    "A1",
    "everyday",
  ],
  [
    "sunrise",
    "рассвет",
    "ˈsʌnraɪz",
    "The time when the sun appears in the morning.",
    "We watched the sunrise over the hills.",
    "Мы наблюдали рассвет над холмами.",
    ["dawn"],
    "sunrise",
    "A2",
    "travel",
  ],
  [
    "ice",
    "лёд",
    "aɪs",
    "Water that has frozen and become solid.",
    "The lake was covered with ice.",
    "Озеро было покрыто льдом.",
    [],
    "ice",
    "A1",
    "everyday",
  ],
  [
    "gold",
    "золото",
    "ɡəʊld",
    "A valuable yellow metal.",
    "The ring is made of gold.",
    "Кольцо сделано из золота.",
    [],
    "gold",
    "A2",
    "everyday",
  ],
  [
    "road",
    "дорога",
    "rəʊd",
    "A route for vehicles or people to travel along.",
    "The road led us to a small village.",
    "Дорога привела нас в небольшую деревню.",
    [],
    "journey",
    "A1",
    "travel",
  ],
  [
    "leaf",
    "лист дерева",
    "liːf",
    "A flat, usually green part of a plant.",
    "A golden leaf fell from the tree.",
    "Золотой лист упал с дерева.",
    [],
    "bloom",
    "A1",
    "travel",
  ],
  [
    "peace",
    "покой",
    "piːs",
    "A state of calm and quiet.",
    "I found a moment of peace by the lake.",
    "У озера я нашёл минуту покоя.",
    [],
    "ocean",
    "A2",
    "ideas",
  ],
  [
    "opportunity",
    "возможность",
    "ˌɒpəˈtjuːnəti",
    "A situation that makes it possible to do something.",
    "This is a great opportunity to learn.",
    "Это прекрасная возможность учиться.",
    [],
    "window",
    "B1",
    "ideas",
  ],
];
export const CATALOG: Word[] = entries.map((v, i) => ({
  id: v[0],
  word: v[0],
  translation: v[1],
  phonetic: v[2],
  definition: v[3],
  example: v[4],
  exampleRu: v[5],
  synonyms: v[6],
  concept: v[7],
  level: v[8],
  topic: v[9],
  partOfSpeech: v[0] === "bloom" ? "verb" : "noun",
  status: "learning",
  successes: 0,
  dueAt: 0,
  addedAt: i,
}));
// Separate entries deliberately represent separate senses, with independent schedules.
CATALOG.push(
  {
    ...CATALOG[2],
    id: "book-reserve",
    translation: "бронировать",
    partOfSpeech: "verb",
    concept: "",
    definition: "To arrange to have a room, ticket or table at a future time.",
    example: "We need to book a table for Friday.",
    exampleRu: "Нам нужно забронировать столик на пятницу.",
    synonyms: ["reserve"],
  },
  {
    ...CATALOG[9],
    id: "light-weight",
    translation: "лёгкий по весу",
    partOfSpeech: "adjective",
    concept: "",
    definition: "Not heavy.",
    example: "This bag is light enough to carry all day.",
    exampleRu: "Эта сумка достаточно лёгкая, чтобы носить её весь день.",
    synonyms: ["lightweight"],
  },
  {
    ...CATALOG[11],
    id: "key-keyboard",
    translation: "клавиша",
    concept: "",
    definition: "A button on a computer keyboard.",
    example: "Press any key to continue.",
    exampleRu: "Нажмите любую клавишу, чтобы продолжить.",
    synonyms: [],
  },
  {
    ...CATALOG[13],
    id: "dream-sleep",
    translation: "сон во время сна",
    concept: "",
    definition: "Images and events experienced while sleeping.",
    example: "I had a strange dream last night.",
    exampleRu: "Прошлой ночью мне приснился странный сон.",
    synonyms: [],
  },
);
export const INITIAL_WORDS: Word[] = CATALOG.slice(0, 12).map((w, i) => ({
  ...w,
  status: i >= 8 ? "learned" : "learning",
  successes: 0,
  ...(i >= 8 ? { mastery: "manual" as const } : {}),
}));
export const TOPICS: Record<Topic, string> = {
  everyday: "Повседневная жизнь",
  travel: "Мир и путешествия",
  ideas: "Чувства и идеи",
};
export const PHRASES: Phrase[] = [
  {
    id: "take-time",
    text: "take your time",
    translation: "не торопиться",
    keywords: ["time"],
    frequency: 1,
    frequencyLabel: "Очень распространённое",
    usage:
      "Дружелюбная просьба или разрешение делать что-то без спешки. Уместно в бытовом и рабочем общении.",
    exceptions:
      "Take your time — «не торопись», а take time — «требовать времени». Не путайте с waste time — «тратить время впустую».",
    origin:
      "Выражение использует обычное значение take — «затрачивать, использовать». Достоверная история об одном событии, породившем фразу, не установлена.",
    example: "Take your time. I can wait a little longer.",
    exampleRu: "Не торопись. Я могу подождать ещё немного.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/take-your-time",
    },
  },
  {
    id: "break-ice",
    text: "break the ice",
    translation: "растопить лёд в общении",
    keywords: ["ice", "break", "conversation"],
    frequency: 2,
    frequencyLabel: "Очень распространённое",
    usage:
      "Сделать первый шаг, чтобы незнакомые люди почувствовали себя свободнее: пошутить, представиться, задать простой вопрос.",
    exceptions:
      "В переносном значении обычно используют the: break the ice. Это начало общения, а не разрешение серьёзного конфликта.",
    origin:
      "Образ связан с преодолением ледяной преграды. Выражение встречается в «Укрощении строптивой» Шекспира (акт I, сцена 2), но это не доказывает, что именно он его придумал.",
    example: "She told a funny story to break the ice.",
    exampleRu: "Она рассказала смешную историю, чтобы разрядить обстановку.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/break-the-ice",
    },
    quote: {
      text: "And if you break the ice, and do this feat…",
      translation: "И если ты растопишь лёд и совершишь этот подвиг…",
      author: "Уильям Шекспир, «Укрощение строптивой», I.2",
      url: "https://www.folger.edu/explore/shakespeares-works/the-taming-of-the-shrew/read/1/2/",
    },
  },
  {
    id: "by-heart",
    text: "learn by heart",
    translation: "выучить наизусть",
    keywords: ["heart", "learn", "book"],
    frequency: 3,
    frequencyLabel: "Распространённое",
    usage:
      "О стихах, песнях, правилах и других вещах, которые запоминают дословно. Know something by heart — уже знать наизусть.",
    exceptions:
      "Learn — процесс запоминания, know — результат. By heart не означает «понимать сердцем».",
    origin:
      "Оборот отражает старое представление о сердце как о вместилище памяти и мысли. Точную дату появления современного английского выражения здесь не утверждаем.",
    example: "We learned the poem by heart at school.",
    exampleRu: "В школе мы выучили это стихотворение наизусть.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/by-heart",
    },
  },
  {
    id: "time-flies",
    text: "time flies",
    translation: "время летит",
    keywords: ["time"],
    frequency: 4,
    frequencyLabel: "Распространённое",
    usage:
      "Когда замечают, что время прошло незаметно, особенно за приятным или увлекательным занятием.",
    exceptions:
      "Time — неисчисляемое существительное, поэтому flies, а не fly. Оборот описывает ощущение, а не буквально скорость времени.",
    origin:
      "Образ «летящего времени» известен ещё по латинскому fugit irreparabile tempus у Вергилия в «Георгиках» (книга III). Это историческая параллель, а не доказанная прямая цепочка заимствования.",
    example: "Time flies when you are reading a good book.",
    exampleRu: "Время летит, когда читаешь хорошую книгу.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/time-flies",
    },
  },
  {
    id: "cup-tea",
    text: "not my cup of tea",
    translation: "не моё; не по вкусу",
    keywords: ["tea", "coffee", "like"],
    frequency: 5,
    frequencyLabel: "Распространённое",
    usage:
      "Мягкий способ сказать, что занятие, музыка или что-то другое вам не нравится. Особенно характерно для британского английского.",
    exceptions:
      "Обычно используют в отрицании. О человеке может звучать неодобрительно: учитывайте контекст.",
    origin:
      "Метафора опирается на личные предпочтения в чае. Достоверных сведений об одном авторе или событии происхождения в этой подборке нет.",
    example: "Horror films are not really my cup of tea.",
    exampleRu: "Фильмы ужасов — не совсем моё.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/cup-of-tea",
    },
  },
  {
    id: "silver-lining",
    text: "every cloud has a silver lining",
    translation: "нет худа без добра",
    keywords: ["cloud", "silver", "rain", "light"],
    frequency: 6,
    frequencyLabel: "Известная поговорка",
    usage:
      "Чтобы поддержать человека: даже у неприятной ситуации может быть положительная сторона.",
    exceptions:
      "В тяжёлой ситуации может прозвучать как обесценивание переживаний. Сначала проявите сочувствие.",
    origin:
      "Образ серебряного края облака встречается в «Комусе» Джона Мильтона (1634). Нынешняя форма поговорки закрепилась позднее; Мильтон не использовал её дословно в современном виде.",
    example:
      "The trip was cancelled, but every cloud has a silver lining: we saved some money.",
    exampleRu:
      "Поездку отменили, но нет худа без добра: мы сэкономили немного денег.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/every-cloud-has-a-silver-lining",
    },
  },
  {
    id: "bridge-cross",
    text: "cross that bridge when we come to it",
    translation: "решать проблемы по мере поступления",
    keywords: ["bridge", "problem", "journey"],
    frequency: 7,
    frequencyLabel: "Распространённое",
    usage:
      "Когда проблему ещё рано решать и нет смысла беспокоиться о ней заранее.",
    exceptions:
      "Не подходит, если бездействие уже создаёт риск: фраза может прозвучать как уход от ответственности.",
    origin:
      "Метафора путешествия: переправу преодолевают, когда до неё доходят. Точное происхождение в этой подборке не установлено.",
    example:
      "What if it rains? — We will cross that bridge when we come to it.",
    exampleRu: "А если пойдёт дождь? — Будем решать по обстоятельствам.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/cross-that-bridge-when-you-come-get-to-it",
    },
  },
  {
    id: "same-page",
    text: "be on the same page",
    translation: "одинаково понимать ситуацию",
    keywords: ["page", "book", "work"],
    frequency: 8,
    frequencyLabel: "Распространённое",
    usage:
      "Особенно удобно на работе: проверить, что участники одинаково понимают план, задачу или договорённость.",
    exceptions:
      "Совпадение понимания не всегда означает согласие по всем вопросам.",
    origin:
      "Наглядный образ людей, читающих одну страницу. Надёжной истории о единственном создателе выражения нет.",
    example: "Let us make sure we are on the same page before we start.",
    exampleRu:
      "Давайте убедимся, что мы одинаково понимаем задачу, прежде чем начнём.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/on-the-same-page",
    },
  },
  {
    id: "ocean-drop",
    text: "a drop in the ocean",
    translation: "капля в море",
    keywords: ["ocean", "water", "small"],
    frequency: 9,
    frequencyLabel: "Распространённое",
    usage:
      "О количестве или усилии, которое слишком мало по сравнению с масштабом задачи. Характерно для британского английского.",
    exceptions:
      "Американский вариант — a drop in the bucket. Оба выражения понятны, но региональное предпочтение различается.",
    origin:
      "Образ подчёркивает контраст между каплей и огромным объёмом воды. Похожие образы есть в старых религиозных текстах; точную линию происхождения здесь не утверждаем.",
    example: "Our donation is a drop in the ocean, but it is a start.",
    exampleRu: "Наше пожертвование — капля в море, но это начало.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/a-drop-in-the-ocean",
    },
  },
  {
    id: "forest-trees",
    text: "cannot see the forest for the trees",
    translation: "за деревьями не видеть леса",
    keywords: ["forest", "tree", "woods"],
    frequency: 10,
    frequencyLabel: "Устойчивое выражение",
    usage: "Когда внимание к деталям мешает понять общую картину.",
    exceptions:
      "В британском английском часто говорят cannot see the wood for the trees. Не используйте выражение как грубую оценку человека.",
    origin:
      "Метафора противопоставляет отдельные деревья и лес в целом. Точное первое употребление в этой подборке не установлено.",
    example:
      "We focused on tiny details and could not see the forest for the trees.",
    exampleRu: "Мы сосредоточились на мелочах и упустили общую картину.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/can-t-see-the-wood-for-the-trees",
    },
  },
  {
    id: "gold-glisters",
    text: "all that glitters is not gold",
    translation: "не всё то золото, что блестит",
    keywords: ["gold", "light"],
    frequency: 11,
    frequencyLabel: "Известная поговорка",
    usage:
      "Предупреждение: привлекательная внешность или обещание не гарантируют ценности и качества.",
    exceptions:
      "В современном английском glitters; у Шекспира — glisters. Не переводите буквально как утверждение, что всё блестящее не является золотом.",
    origin:
      "Шекспир использовал форму «All that glisters is not gold» в «Венецианском купце» (II.7). Сама мысль существовала и до него.",
    example: "The offer looked perfect, but all that glitters is not gold.",
    exampleRu:
      "Предложение выглядело идеальным, но не всё то золото, что блестит.",
    source: {
      label: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/all-that-glitters-is-not-gold",
    },
    quote: {
      text: "All that glisters is not gold.",
      translation: "Не всё то золото, что блестит.",
      author: "Уильям Шекспир, «Венецианский купец», II.7",
      url: "https://www.folger.edu/explore/shakespeares-works/the-merchant-of-venice/read/2/7/",
    },
  },
  {
    id: "home-sweet",
    text: "home sweet home",
    translation: "дом, милый дом",
    keywords: ["home", "journey"],
    frequency: 12,
    frequencyLabel: "Известное выражение",
    usage:
      "Тёплое восклицание при возвращении домой или подпись к изображению своего дома.",
    exceptions:
      "Возможна ирония, если дома беспорядок или неприятности. Это восклицание, а не обычное полное предложение.",
    origin:
      "Выражение широко популяризировала песня «Home! Sweet Home!» (1823), слова Джона Говарда Пейна, музыка Генри Бишопа.",
    example: "After two weeks on the road: home sweet home!",
    exampleRu: "После двух недель в дороге: дом, милый дом!",
    source: {
      label: "Library of Congress — поиск нот Home, Sweet Home",
      url: "https://www.loc.gov/notated-music/?q=home+sweet+home",
    },
  },
];
export interface Passage {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  text: string;
  translation: string;
  type: string;
}
export const PASSAGES: Passage[] = [
  {
    id: "quiet-morning",
    title: "A little room for wonder",
    subtitle: "Маленькая история о больших открытиях",
    level: "A2",
    type: "Авторский учебный рассказ",
    text: "The morning began with rain. Anna made a cup of coffee and sat by the window with a book. Outside, the forest was still and quiet. A little light came through the clouds.\n\nShe had planned a long journey to the ocean, but today she decided to stay at home. There was no need to hurry. She had time to notice the small things: a leaf on the window, the sound of water, a bird in the garden.\n\nLater, she walked across the old bridge. In the distance, a mountain rose above the trees. She smiled. Sometimes a new journey begins right where you are.",
    translation:
      "Утро началось с дождя. Анна приготовила чашку кофе и села у окна с книгой. За окном лес был тих и неподвижен. Сквозь облака пробивалось немного света.\n\nОна планировала долгое путешествие к океану, но сегодня решила остаться дома. Спешить было некуда. У неё было время заметить мелочи: лист на окне, шум воды, птицу в саду.\n\nПозже она перешла старый мост. Вдали над деревьями возвышалась гора. Анна улыбнулась. Иногда новое путешествие начинается прямо там, где ты находишься.",
  },
  {
    id: "road",
    title: "The road to something new",
    subtitle: "Немного смелости — и первый шаг",
    level: "A2–B1",
    type: "Авторский учебный рассказ",
    text: "Tom had a dream: he wanted to see the ocean. One day he picked up his key, closed the door, and started his journey. The road took him through a forest and over a mountain.\n\nAt sunrise, he stopped by a small bridge. He felt afraid, but he knew that courage did not mean having no fear. It meant going on.\n\nWhen he finally saw the water, his heart felt light. He opened his book and wrote: “Every day is an opportunity to begin again.”",
    translation:
      "У Тома была мечта: увидеть океан. Однажды он взял ключ, закрыл дверь и отправился в путешествие. Дорога вела его через лес и через гору.\n\nНа рассвете он остановился у небольшого моста. Ему было страшно, но он знал, что смелость не означает отсутствие страха. Она означает продолжать путь.\n\nКогда он наконец увидел воду, на сердце стало легко. Он открыл свою книгу и написал: «Каждый день — возможность начать заново».",
  },
  {
    id: "reading",
    title: "Why a few pages matter",
    subtitle: "Как чтение помогает замечать язык",
    level: "B1",
    type: "Авторская учебная статья",
    text: "Learning a language takes time. A book can be a bridge between the words you know and the ideas you want to share. You do not need to understand every word. Start with a short story about a journey, a forest, or a place you call home.\n\nRead slowly. Look for a familiar word in a new context. The word light, for example, can describe the sun or something that is not heavy. Context is the key.\n\nA little practice every day can bloom into a lasting habit. Give yourself the opportunity to enjoy the process.",
    translation:
      "Изучение языка требует времени. Книга может стать мостом между словами, которые вы знаете, и идеями, которыми хотите поделиться. Не нужно понимать каждое слово. Начните с короткой истории о путешествии, лесе или месте, которое вы называете домом.\n\nЧитайте медленно. Ищите знакомое слово в новом контексте. Например, light может описывать солнечный свет или что-то нетяжёлое. Контекст — ключ к пониманию.\n\nНебольшая ежедневная практика может перерасти в устойчивую привычку. Дайте себе возможность наслаждаться процессом.",
  },
];
