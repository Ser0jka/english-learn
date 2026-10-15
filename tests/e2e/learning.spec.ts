import { test, expect, type Page } from "@playwright/test";
const KEY = "lexi.workspace.v1";
const DAY = 86400000;
async function state(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function singleWord(page: Page) {
  await page.goto("/");
  await expect(page.locator("#page-title")).toBeVisible();
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    s.words = s.words.slice(0, 1);
    s.logs = [];
    localStorage.setItem(key, JSON.stringify(s));
  }, KEY);
  await page.goto("/#cards");
  await page.reload();
}
async function correct(page: Page) {
  await page.getByRole("button", { name: "forest", exact: true }).click();
}
test("three spaced answers graduate; replay cannot farm progress; an error returns to learning", async ({
  page,
}) => {
  const start = Date.now();
  await page.clock.install({ time: start });
  await singleWord(page);
  await correct(page);
  let s = await state(page);
  expect(s.words[0].successes).toBe(1);
  expect(s.words[0].status).toBe("learning");
  expect(s.words[0].dueAt).toBe(s.words[0].lastReviewedAt + DAY);
  await page.reload();
  await expect(page.locator(".answer-option")).toHaveCount(0);
  await expect(page.locator(".next-review")).toBeVisible();
  // Advancing wall time simulates returning on the scheduled day, without executing days of timers.
  await page.clock.setSystemTime(s.words[0].dueAt);
  await page.reload();
  await correct(page);
  s = await state(page);
  expect(s.words[0].successes).toBe(2);
  await page.clock.setSystemTime(s.words[0].dueAt);
  await page.reload();
  await correct(page);
  s = await state(page);
  expect(s.words[0]).toMatchObject({
    status: "learned",
    successes: 3,
    mastery: "scheduled",
  });
  await page.goto("/#words");
  await expect(page.locator(".word-status")).toContainText("Выучил");
  await page.clock.setSystemTime(s.words[0].dueAt);
  await page.reload();
  await expect(page.locator(".word-status")).toContainText("Пора повторить");
  await page.goto("/#cards");
  await page.getByRole("button", { name: /Повторяю/ }).click();
  await page
    .locator(".answer-option")
    .filter({ hasNotText: /forest|woods|woodland/ })
    .first()
    .click();
  s = await state(page);
  expect(s.words[0]).toMatchObject({
    status: "learning",
    successes: 0,
    lapses: 1,
  });
  expect(s.words[0].dueAt - s.words[0].lastReviewedAt).toBe(300000);
  await page.reload();
  await expect(page.locator(".answer-option")).toHaveCount(0);
  expect((await state(page)).logs).toHaveLength(4);
});
test("global and card help do not expose spelling, translation, synonyms or pronunciation before answering", async ({
  page,
}) => {
  await singleWord(page);
  const before = await page.locator(".flash-content").innerText();
  expect(before).not.toContain("лес");
  expect(before).not.toContain("We followed a quiet path through the forest.");
  await expect(
    page.getByRole("button", { name: "Прослушать слово", exact: true }),
  ).toHaveCount(0);
  for (const name of ["Справка о слове", "Открыть помощника"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const d = page.getByRole("dialog");
    await expect(d).toContainText("Сначала вспомните сами");
    await expect(d).not.toContainText(/forest|woods|woodland|лес/);
    await expect(d.getByRole("textbox")).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await correct(page);
  await page.getByRole("button", { name: "Справка о слове" }).click();
  await page.getByRole("button", { name: "Что это значит?" }).click();
  await expect(page.getByRole("log")).toContainText("forest — лес");
});
test("different meanings have different material and progress and reading asks which sense is intended", async ({
  page,
}) => {
  await page.goto("/");
  for (const translation of ["книга", "бронировать"]) {
    if (translation === "книга") continue; // The demonstration collection already contains this sense.
    await page
      .getByRole("button", { name: "Добавить слова", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Слово или выражение").fill("book");
    await d.getByLabel("Перевод", { exact: true }).fill(translation);
    await d.getByRole("button", { name: "Добавить в словарь" }).click();
  }
  let s = await state(page);
  const books = s.words.filter((w: { word: string }) => w.word === "book");
  expect(books).toHaveLength(2);
  expect(
    books.find((w: { translation: string }) => w.translation === "бронировать"),
  ).toMatchObject({ concept: "", partOfSpeech: "verb", successes: 0 });
  await page.goto("/#reading");
  await page
    .locator(".reading-word")
    .filter({ hasText: /^book$/i })
    .first()
    .click();
  await expect(page.locator(".sense-picker")).toContainText(
    "автоматически значение не определяется",
  );
  await page
    .locator(".sense-picker")
    .getByRole("button", { name: "книга", exact: true })
    .click();
  await expect(
    page.locator(".reading-definition .word-translation"),
  ).toHaveText("книга");
  await page.goto("/#words");
  await page
    .getByRole("textbox", { name: "Поиск слова или перевода" })
    .fill("бронировать");
  await page
    .getByRole("button", { name: "Открыть слово book — бронировать" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Статус", exact: true })
    .selectOption("learned");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  s = await state(page);
  expect(
    s.words.find(
      (w: { translation: string }) => w.translation === "бронировать",
    ),
  ).toMatchObject({ status: "learned", successes: 0, mastery: "manual" });
  expect(
    s.words.find((w: { translation: string }) => w.translation === "книга")
      .status,
  ).toBe("learning");
});
test("daily goal is configurable, counts unique attempted meanings and persists when disabled", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Мои предпочтения" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Ежедневная цель (разных значений)").selectOption("5");
  await d.getByRole("button", { name: "Всё готово" }).click();
  await page.goto("/#cards");
  await correct(page);
  await page.goto("/#home");
  await expect(page.locator(".learning-summary")).toContainText(
    "Сегодня: 1 значение",
  );
  await expect(page.locator(".daily-label")).toContainText("1 / 5");
  await expect(page.locator(".learning-summary")).toContainText(
    "Подтверждено по расписанию: 0",
  );
  await page.getByRole("button", { name: "Мои предпочтения" }).click();
  await page.getByLabel("Ежедневная цель (разных значений)").selectOption("0");
  await page.getByRole("button", { name: "Всё готово" }).click();
  await page.reload();
  expect((await state(page)).dailyGoal).toBe(0);
  await expect(page.locator(".daily-track")).toHaveCount(0);
  await expect(page.locator(".learning-summary")).toContainText(
    "Цель: отключена",
  );
});
test("due states and an empty queue refresh automatically at the deadline", async ({
  page,
}) => {
  const start = Date.now();
  await page.clock.install({ time: start });
  await singleWord(page);
  await correct(page);
  await page.reload();
  await expect(page.locator(".answer-option")).toHaveCount(0);
  await page.clock.setSystemTime(start + DAY - 1000);
  await page.reload();
  await expect(page.locator(".answer-option")).toHaveCount(0);
  await page.clock.runFor(1100);
  await expect(page.locator(".answer-option")).toHaveCount(4);
  await page.goto("/#words");
  await expect(page.locator(".word-status")).toContainText("Пора повторить");
});
test("changing a meaning resets its evidence and clears unrelated automatic material", async ({
  page,
}) => {
  await singleWord(page);
  await correct(page);
  await page.goto("/#words");
  await page.getByRole("button", { name: "Открыть слово forest" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Перевод", { exact: true }).fill("роща");
  await d.getByRole("button", { name: "Сохранить", exact: true }).click();
  const s = await state(page);
  expect(s.words[0]).toMatchObject({
    translation: "роща",
    successes: 0,
    dueAt: 0,
    example: "",
    concept: "",
    synonyms: [],
  });
  expect(s.words[0].mastery).toBeUndefined();
});
test("an unfamiliar meaning needs explicit grammar and context before it can be graded", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#page-title")).toBeVisible();
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    s.words = [];
    s.logs = [];
    localStorage.setItem(key, JSON.stringify(s));
  }, KEY);
  await page.reload();
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Слово или выражение").fill("fascinate");
  await d.getByLabel("Перевод", { exact: true }).fill("очаровывать");
  await d.getByRole("button", { name: "Добавить в словарь" }).click();
  await page.goto("/#cards");
  await expect(page.locator(".answer-option")).toHaveCount(0);
  await page.getByRole("button", { name: "Дополнить карточки" }).click();
  await page.getByRole("button", { name: "Открыть слово fascinate" }).click();
  d = page.getByRole("dialog");
  await d
    .getByRole("combobox", { name: "Часть речи", exact: true })
    .selectOption("verb");
  await d
    .getByLabel("Пример на английском", { exact: true })
    .fill("These stories fascinate children.");
  await d.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.goto("/#cards");
  await expect(page.locator(".answer-option")).toHaveCount(4);
  await expect(page.locator(".card-context")).toHaveText(
    "These stories _____ children.",
  );
  await page.getByRole("button", { name: "fascinate", exact: true }).click();
  expect((await state(page)).words[0].successes).toBe(1);
});
