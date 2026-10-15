import { test, expect } from "@playwright/test";
const KEY = "lexi.workspace.v1";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Каждое слово — новый мир." }),
  ).toBeVisible();
});
test("dashboard renders and all primary sections navigate", async ({
  page,
}) => {
  for (const [link, title] of [
    ["Карточки", "От образа — к слову."],
    ["Слова в выражениях", "У слов есть своя история."],
    ["Чтение", "Слова оживают в историях."],
    ["Мои слова", "Ваш мир английских слов."],
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: link, exact: true })
      .click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});
test("adds a word, persists after reload, edits its status and exports a backup", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Слово или выражение").fill("serendipity");
  await dialog
    .getByLabel("Перевод", { exact: true })
    .fill("счастливая случайность");
  await dialog.getByRole("button", { name: "Добавить в словарь" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Мои слова/ })
    .click();
  await page
    .getByRole("textbox", { name: "Поиск слова или перевода" })
    .fill("serendipity");
  await expect(
    page.getByRole("heading", { name: "serendipity", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Открыть слово serendipity" }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Статус", exact: true })
    .selectOption("learned");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(
    state.words.find((w: { word: string }) => w.word === "serendipity").status,
  ).toBe("learned");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /^lexi-words-.*\.json$/,
  );
});
test("imports lists and skips duplicates", async ({ page }) => {
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Загрузить список" }).click();
  await d
    .getByLabel("Или вставьте список")
    .fill(
      "word;translation;status\nforest;лес;learning\ncourage;смелость;learned\nephemeral;мимолётный;learning",
    );
  await d.getByRole("button", { name: "Добавить слова", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Добавлено слов: 2");
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(state.words).toHaveLength(14);
  expect(
    state.words.find((w: { word: string }) => w.word === "courage").status,
  ).toBe("learned");
});
test("answers a visual card, reveals all synonyms and updates progress", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Начать практику" }).click();
  await expect(
    page.getByRole("heading", { name: "Какое слово здесь спрятано?" }),
  ).toBeVisible();
  await page
    .locator(".answer-option")
    .filter({ hasText: /forest$/ })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Верно. Отличная работа!",
  );
  await expect(page.getByRole("status")).toContainText("woods");
  await expect(page.getByRole("status")).toContainText("woodland");
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(state.logs).toHaveLength(1);
  expect(state.logs[0].correct).toBe(true);
  await page.getByRole("button", { name: "Следующая карточка" }).click();
  await expect(page.locator(".study-top")).toContainText("2");
});
test("incorrect answers reveal translations and cannot be submitted twice", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Начать практику" }).click();
  const wrong = page
    .locator(".answer-option")
    .filter({ hasNotText: /forest|woods|woodland/ })
    .first();
  await wrong.click();
  await expect(page.getByRole("status")).toContainText("Неверно");
  await expect(page.getByRole("status")).toContainText("лес");
  await expect(page.locator(".answer-option").first()).toBeDisabled();
});
test("opens expression history, follows source links and adds expression to learning", async ({
  page,
}) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Слова в выражениях", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Найти выражения по слову" })
    .fill("ice");
  await page.getByRole("button", { name: "Подробнее: break the ice" }).click();
  await expect(
    page.getByRole("heading", { name: "История выражения" }),
  ).toBeVisible();
  await expect(
    page.getByText("Нюансы и исключения", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Уильям Шекспир/ }),
  ).toHaveAttribute("href", /folger.edu/);
  await page.getByRole("button", { name: "Учить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Изучаю", exact: true }),
  ).toBeVisible();
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(state.phraseIds).toContain("break-ice");
  expect(
    state.words.some((w: { word: string }) => w.word === "break the ice"),
  ).toBe(true);
});
test("reading highlights personal words and shows definitions and translation", async ({
  page,
}) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Чтение", exact: true })
    .click();
  await page
    .locator(".reading-word")
    .filter({ hasText: /^forest$/ })
    .first()
    .click();
  await expect(page.locator(".reading-definition")).toContainText("лес");
  await page.getByRole("button", { name: "Показать перевод" }).click();
  await expect(page.locator(".reading-translation")).toContainText("Анна");
  await page.getByRole("button", { name: "Другая история" }).click();
  await expect(
    page.getByRole("heading", { name: "The road to something new" }),
  ).toBeVisible();
});
test("contextual reference answers without an API key", async ({ page }) => {
  await page.getByRole("button", { name: "Открыть помощника" }).click();
  await page.getByRole("button", { name: "Что это значит?" }).click();
  await expect(page.locator(".chat-messages")).toContainText("forest — лес");
  await page
    .getByRole("textbox", { name: "Ваш вопрос" })
    .fill("Какой сегодня курс валют?");
  await page.getByRole("button", { name: "Отправить вопрос" }).click();
  await expect(page.locator(".chat-messages")).toContainText(
    "Свободный диалог сейчас недоступен",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("new mode uses topic preferences and review mode selects learned words", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Мои предпочтения" }).click();
  await page.getByRole("button", { name: "Чувства и идеи" }).click();
  await page.getByRole("button", { name: "Всё готово" }).click();
  await page.getByRole("button", { name: "Новые слова", exact: true }).click();
  await page.getByRole("button", { name: "Начать практику" }).click();
  await expect(
    page.locator(".answer-option").filter({ hasText: "heart" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: /Повторяю/ }).click();
  await expect(
    page.locator(".answer-option").filter({ hasText: "time" }),
  ).toHaveCount(1);
});
test("mobile navigation, overflow and accessible modal controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Мои слова/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ваш мир английских слов." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("completes a whole study session and saves every result", async ({
  page,
}) => {
  const words = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key)!).words.filter(
        (w: { status: string }) => w.status === "learning",
      ),
    KEY,
  );
  await page.getByRole("button", { name: "Начать практику" }).click();
  for (let i = 0; i < words.length; i++) {
    const word = words[i].word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await page
      .locator(".answer-option")
      .filter({ hasText: new RegExp(word + "$") })
      .click();
    await page
      .getByRole("button", {
        name: i + 1 === words.length ? "Завершить" : "Следующая карточка",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Слова становятся ближе." }),
  ).toBeVisible();
  await expect(page.locator(".finish-stats")).toContainText("100%");
  const logs = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).logs,
    KEY,
  );
  expect(logs).toHaveLength(words.length);
});

test("uploads an actual CSV file and displays a useful error for invalid data", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Загрузить список" }).click();
  await d.locator("input[type=file]").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("word;translation;status\nhello;привет;broken"),
  });
  await expect(d.getByRole("alert")).toContainText("статус");
  await d.locator("input[type=file]").setInputFiles({
    name: "words.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("word;translation;status\nhello;привет;learning"),
  });
  await expect(d.locator(".import-preview")).toContainText(
    "Готово к импорту: 1",
  );
  await d.getByRole("button", { name: "Добавить слова", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Добавлено слов: 1");
});

test("additional expressions are labelled and saved using the optional service", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
  const { PHRASES } = await import("../../src/data");
  const phrase = {
    ...PHRASES[0],
    id: "test-dream",
    text: "a dream come true",
    translation: "сбывшаяся мечта",
    keywords: ["dream"],
    generated: true,
    source: {
      label: "Найти в Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/search/english/direct/?q=a+dream+come+true",
    },
  };
  await page.route("**/api/materials/phrases", (route) =>
    route.fulfill({ json: { phrases: [phrase] } }),
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Слова в выражениях", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Найти выражения по слову" })
    .fill("dream");
  await page.getByRole("button", { name: "Найти ещё выражения" }).click();
  await expect(
    page.getByRole("heading", { name: "a dream come true" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Подробнее: a dream come true" })
    .click();
  await expect(page.locator(".generated-note")).toContainText(
    "Материал подобран помощником",
  );
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(state.customPhrases).toHaveLength(1);
});

test("creates and preserves a reading from personal words using the optional service", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
  await page.route("**/api/materials/reading", async (route) => {
    const payload = route.request().postDataJSON();
    expect(
      payload.words.some((w: { word: string }) => w.word === "forest"),
    ).toBe(true);
    await route.fulfill({
      json: {
        passage: {
          id: "test-reading",
          title: "A forest of possibilities",
          subtitle: "История",
          text: "A book can be a bridge to the forest.",
          translation: "Книга может стать мостом в лес.",
          level: "A2",
          type: "Учебный текст помощника",
        },
      },
    });
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Чтение", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать текст", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A forest of possibilities" }),
  ).toBeVisible();
  await page
    .locator(".reading-word")
    .filter({ hasText: /^forest$/ })
    .click();
  await expect(page.locator(".reading-definition")).toContainText("лес");
  await page.reload();
  await expect(page.locator(".reading-selector")).toContainText(
    "A forest of possibilities",
  );
});

test("generates an image, previews it, then saves it with the word", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
  await page.route("**/api/materials/image", (route) =>
    route.fulfill({
      json: {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6wAAAABJRU5ErkJggg==",
      },
    }),
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Мои слова", exact: true })
    .click();
  await page.getByRole("button", { name: "Открыть слово forest" }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Создать иллюстрацию по слову" }).click();
  await expect(d.locator(".editor-image img")).toBeVisible();
  await d.getByRole("button", { name: "Сохранить", exact: true }).click();
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(
    state.words.find((w: { word: string }) => w.word === "forest").image,
  ).toMatch(/^data:image\/webp;base64,/);
});

test("service errors leave the existing word and image intact", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
  await page.route("**/api/materials/image", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "Не удалось создать иллюстрацию." },
    }),
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Мои слова", exact: true })
    .click();
  await page.getByRole("button", { name: "Открыть слово forest" }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Создать иллюстрацию по слову" }).click();
  await expect(d.getByRole("alert")).toContainText(
    "Не удалось создать иллюстрацию",
  );
  await expect(d.locator(".editor-image > .word-art")).toBeVisible();
});
