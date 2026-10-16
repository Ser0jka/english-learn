import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyStore, makeWord } from "../../src/domain";
import { CATALOG } from "../../src/data";
const key = "lexi.workspace.v1";
test("phone bottom navigation stays inside the SPA and exposes the current section", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let documents = 0;
  const errors: string[] = [];
  page.on("request", (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame())
      documents++;
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Навигация на телефоне" });
  for (const name of [
    "Карточки",
    "Слова в выражениях",
    "Чтение",
    "Мои слова",
    "Обзор",
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(
      nav.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#page-title")).toBeVisible();
    if (name === "Карточки") {
      await expect(page.locator(".answer-option")).toHaveCount(4);
      const answers = await page.locator(".answer-grid").boundingBox();
      const navigation = await nav.boundingBox();
      expect(answers).not.toBeNull();
      expect(navigation).not.toBeNull();
      expect(answers!.y + answers!.height).toBeLessThanOrEqual(navigation!.y);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(documents).toBe(1);
  expect(errors).toEqual([]);
});
test("phone appearance settings preview all accents accessibly and survive reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("button", { name: "Мои предпочтения" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Тёмный фон").selectOption("graphite");
  await dialog.getByLabel("Размер текста").selectOption("large");
  for (const [name, value] of [
    ["Латунь", "brass"],
    ["Золотисто-оранжевый", "amber"],
    ["Серебро", "silver"],
  ]) {
    await dialog.getByRole("radio", { name, exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-accent", value);
    const result = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations.map((v) => v.id)).toEqual([]);
  }
  await dialog.getByLabel("Перелив зелёного и малинового в ответах").uncheck();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Всё готово" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "silver");
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).appearance,
      key,
    ),
  ).toEqual({
    accent: "silver",
    background: "graphite",
    textSize: "large",
    feedbackGlow: false,
  });
});
test("AI vocabulary preview handles failure and saves only selected ready words", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { ok: true, aiAvailable: true, imageAvailable: false },
    }),
  );
  let attempts = 0;
  const words = [
    {
      ...makeWord("adapt", "приспосабливаться"),
      id: "ai-adapt",
      generated: true,
      partOfSpeech: "verb",
      definition: "To change to suit new conditions.",
      example: "We adapt to new conditions.",
      exampleRu: "Мы приспосабливаемся к новым условиям.",
    },
    {
      ...makeWord("harbor", "гавань"),
      id: "ai-harbor",
      generated: true,
      partOfSpeech: "noun",
      definition: "A sheltered place for ships.",
      example: "The ship entered the harbor.",
      exampleRu: "Корабль вошёл в гавань.",
    },
  ];
  await page.route("**/api/materials/words", (route) => {
    attempts++;
    return route.fulfill(
      attempts === 1
        ? { status: 502, json: { error: "Временная ошибка провайдера" } }
        : { json: { words } },
    );
  });
  await page.goto("/#words");
  await page.getByRole("button", { name: "Подобрать слова с ИИ" }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Создать до 10 карточек" }).click();
  await expect(d.getByRole("alert")).toContainText("Временная ошибка");
  await d.getByRole("button", { name: "Создать до 10 карточек" }).click();
  await d.getByLabel("Добавить harbor").uncheck();
  await d.getByRole("button", { name: /Добавить выбранные/ }).click();
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(
    saved.words
      .filter((w: { generated?: boolean }) => w.generated)
      .map((w: { word: string }) => w.word),
  ).toEqual(["adapt"]);
  expect(saved.words.at(-1).successes).toBe(0);
  expect(attempts).toBe(2);
});
test("dictionary expressions paginate, explain their source and become repeatable cards", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
    { key, state: { ...emptyStore(), words: [] } },
  );
  await page.goto("/#phrases");
  await expect(page.locator(".phrase-item")).toHaveCount(24);
  await page.getByRole("button", { name: /Показать ещё/ }).click();
  await expect(page.locator(".phrase-item")).toHaveCount(48);
  await page.getByLabel("Найти выражения по слову").fill("fall asleep");
  await page
    .getByRole("button", { name: "Подробнее: fall asleep", exact: true })
    .click();
  await expect(page.locator(".phrase-details")).toContainText("WordNet");
  await expect(page.locator(".phrase-details")).toContainText(
    "Подтверждённой истории",
  );
  await page
    .getByRole("button", { name: "Учить: fall asleep", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Карточки", exact: true })
    .click();
  await expect(page.locator(".answer-option")).toHaveCount(4);
  await page.getByRole("button", { name: "fall asleep", exact: true }).click();
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(saved.words[0].sourcePhraseId).toMatch(/^wnphrase-/);
  expect(saved.words[0].successes).toBe(1);
});
test("a failed dictionary integrity check is recoverable without touching progress", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(state));
    },
    { key, state: { ...emptyStore(), words: CATALOG } },
  );
  let attempts = 0;
  await page.route("**/data/word-bank.json", (route) => {
    attempts++;
    return attempts === 1
      ? route.fulfill({ contentType: "application/json", body: "[]" })
      : route.continue();
  });
  await page.goto("/#cards");
  await page.getByRole("button", { name: "Новые слова", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Словарь не загрузился");
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.locator(".answer-option")).toHaveCount(4);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).words.length,
      key,
    ),
  ).toBe(CATALOG.length);
});
if (process.env.E2E_PRODUCTION === "1")
  test("installed production shell and opened dictionaries work offline without caching API responses", async ({
    page,
    context,
  }) => {
    await page.addInitScript(
      ({ key, state }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(state));
      },
      { key, state: { ...emptyStore(), words: CATALOG } },
    );
    await page.goto("/");
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const manifest = await page.evaluate(async () =>
      (await fetch("/manifest.webmanifest")).json(),
    );
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toHaveLength(2);
    await page.goto("/#cards");
    await page
      .getByRole("button", { name: "Новые слова", exact: true })
      .click();
    await expect(page.locator(".answer-option")).toHaveCount(4);
    await page.getByRole("button", { name: "know", exact: true }).click();
    await page.goto("/#phrases");
    await expect(page.locator(".phrase-item")).toHaveCount(24);
    const before = await page.evaluate((k) => localStorage.getItem(k), key);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".phrase-item")).toHaveCount(24);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Карточки", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Новые слова", exact: true })
      .click();
    await expect(page.locator(".answer-option")).toHaveCount(4);
    expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
      before,
    );
    const cached = await page.evaluate(async () => {
      const all = await caches.keys();
      return (
        await Promise.all(
          all.map(async (name) =>
            (await (await caches.open(name)).keys()).map(
              (r) => new URL(r.url).pathname,
            ),
          ),
        )
      ).flat();
    });
    expect(cached.some((url) => url.startsWith("/api"))).toBe(false);
    expect(cached).toContain("/data/word-bank.json");
    expect(cached).toContain("/data/phrase-bank.json");
  });
