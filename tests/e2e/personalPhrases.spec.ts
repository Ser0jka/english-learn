import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyStore, makeWord } from "../../src/domain";
import { PHRASES } from "../../src/data";

const key = "lexi.workspace.v1";
const phrase = {
  ...PHRASES[0],
  id: "personal-resilience",
  text: "build resilience",
  translation: "развивать стойкость",
  keywords: ["resilience"],
  generated: true,
};
async function available(page: import("@playwright/test").Page) {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
}

test("adds a personal word from expressions, generates material, learns it and preserves both", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await available(page);
  let body: unknown;
  await page.route("**/api/materials/phrases", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: { phrases: [phrase] } });
  });
  await page.goto("/#phrases");
  await page
    .getByRole("button", { name: "Добавить слово", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Слово или выражение").fill("resilience");
  await dialog.getByLabel("Перевод", { exact: true }).fill("стойкость");
  await dialog
    .getByRole("button", { name: "Добавить в словарь", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const toast = page.locator(".toast");
  for (const time of [0, 100, 200]) {
    await toast.evaluate((element, position) => {
      for (const animation of element.getAnimations()) {
        animation.pause();
        animation.currentTime = position;
      }
    }, time);
    const box = await toast.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  await toast.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  );
  await expect(page.getByLabel("Найти выражения по слову")).toHaveValue(
    "resilience",
  );
  await expect(page.locator(".phrase-target")).toContainText("стойкость");
  await expect(
    page
      .locator(".filter-chips")
      .getByRole("button", { name: "resilience", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Найти ещё выражения", exact: true })
    .click();
  expect(body).toEqual({ word: "resilience", translation: "стойкость" });
  await page
    .getByRole("button", { name: "Учить: build resilience", exact: true })
    .click();
  await page.reload();
  await page.getByLabel("Найти выражения по слову").fill("resilience");
  await expect(
    page.getByRole("button", {
      name: "Не изучать: build resilience",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
    key,
  );
  expect(
    saved.words.some((word: { word: string }) => word.word === "resilience"),
  ).toBe(true);
  expect(
    saved.words.some(
      (word: { word: string }) => word.word === "build resilience",
    ),
  ).toBe(true);
  expect(saved.customPhrases).toHaveLength(1);
});

test("repeated selection does not duplicate a phrase but preserves a different meaning", async ({
  page,
}) => {
  const existing = {
    ...phrase,
    id: "book-old",
    text: "book in",
    translation: "регистрироваться",
    keywords: ["book"],
  };
  const another = {
    ...existing,
    id: "book-new",
    translation: "бронировать номер",
  };
  await page.addInitScript(
    ({ storageKey, state }) =>
      localStorage.setItem(storageKey, JSON.stringify(state)),
    { storageKey: key, state: { ...emptyStore(), customPhrases: [existing] } },
  );
  await available(page);
  await page.route("**/api/materials/phrases", (route) =>
    route.fulfill({ json: { phrases: [another] } }),
  );
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("book");
  const action = page.getByRole("button", {
    name: "Найти ещё выражения",
    exact: true,
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = page.waitForResponse("**/api/materials/phrases");
    await action.click();
    await response;
    await expect(action).toBeEnabled();
    await expect
      .poll(() =>
        page.evaluate(
          (storageKey) =>
            JSON.parse(localStorage.getItem(storageKey)!).customPhrases.length,
          key,
        ),
      )
      .toBe(2);
  }
  await expect(
    page.locator(".phrase-title").filter({ hasText: "book in" }),
  ).toHaveCount(2);
});

for (const width of [320, 1440]) {
  test(`personal picker searches all words and selects a specific meaning regardless of review mode at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 852 });
    const words = [
      makeWord("book", "книга"),
      makeWord("book", "бронировать"),
      ...Array.from({ length: 40 }, (_, index) =>
        makeWord(
          `custom word ${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
          `значение ${index}`,
        ),
      ),
    ];
    await page.addInitScript(
      ({ storageKey, state }) =>
        localStorage.setItem(storageKey, JSON.stringify(state)),
      { storageKey: key, state: { ...emptyStore(), words } },
    );
    await available(page);
    let body: unknown;
    await page.route("**/api/materials/phrases", (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { phrases: [] } });
    });
    await page.goto("/#phrases");
    await page.getByRole("button", { name: /Повторяю/ }).click();
    await page
      .getByRole("button", { name: "Выбрать своё слово", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".word-picker-option")).toHaveCount(30);
    await dialog
      .getByRole("button", { name: "Показать ещё слова", exact: true })
      .click();
    await expect(dialog.locator(".word-picker-option")).toHaveCount(42);
    await dialog.getByLabel("Найти своё слово или перевод").fill("бронировать");
    await expect(dialog.locator(".word-picker-option")).toHaveCount(1);
    const accessibility = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations.map((issue) => issue.id)).toEqual([]);
    await dialog.locator(".word-picker-option").click();
    await expect(page.locator(".phrase-target")).toContainText("бронировать");
    await page
      .getByRole("button", { name: "Найти ещё выражения", exact: true })
      .click();
    await expect
      .poll(() => body)
      .toMatchObject({ word: "book", translation: "бронировать" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await page.locator(".phrase-search > button").all()) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  });
}

test("dictionary word action opens expressions for that personal meaning", async ({
  page,
}) => {
  await page.addInitScript(
    ({ storageKey, state }) =>
      localStorage.setItem(storageKey, JSON.stringify(state)),
    {
      storageKey: key,
      state: { ...emptyStore(), words: [makeWord("book", "бронировать")] },
    },
  );
  await page.goto("/#words");
  await page
    .getByRole("button", {
      name: "Выражения со словом book — бронировать",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#phrases$/);
  await expect(page.getByLabel("Найти выражения по слову")).toHaveValue("book");
  await expect(page.locator(".phrase-target")).toContainText("бронировать");
});

test("imports a list directly from expressions and makes every imported word selectable offline", async ({
  page,
}) => {
  await page.addInitScript(
    ({ storageKey, state }) =>
      localStorage.setItem(storageKey, JSON.stringify(state)),
    { storageKey: key, state: { ...emptyStore(), words: [] } },
  );
  await page.goto("/#phrases");
  await page
    .getByRole("button", { name: "Выбрать своё слово", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Добавьте одно или загрузите список");
  await dialog
    .getByRole("button", { name: "Добавить слово", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Загрузить список" }).click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "personal.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "word;translation\nresilience;стойкость\nharbor;гавань",
    ),
  });
  await expect(dialog.locator(".import-preview")).toContainText(
    "Готово к импорту: 2",
  );
  await dialog
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  await expect(page.getByLabel("Найти выражения по слову")).toHaveValue(
    "resilience",
  );
  await page
    .getByRole("button", { name: "Выбрать своё слово", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Найти своё слово или перевод").fill("гавань");
  await dialog.locator(".word-picker-option").click();
  await expect(page.getByLabel("Найти выражения по слову")).toHaveValue(
    "harbor",
  );
  await expect(
    page.getByRole("button", { name: "Найти ещё выражения", exact: true }),
  ).toBeDisabled();
});

test("changing the target cancels a late response and clears errors for the next word", async ({
  page,
}) => {
  await available(page);
  let finish: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/materials/phrases", async (route) => {
    if (route.request().postDataJSON().word === "resilience") {
      await pending;
      await route.fulfill({ json: { phrases: [phrase] } });
    } else
      await route.fulfill({
        status: 502,
        json: { error: "Не удалось подобрать выражения." },
      });
  });
  await page.goto("/#phrases");
  const search = page.getByLabel("Найти выражения по слову");
  await search.fill("resilience");
  const requested = page.waitForRequest("**/api/materials/phrases");
  await page
    .getByRole("button", { name: "Найти ещё выражения", exact: true })
    .click();
  await requested;
  await search.fill("book");
  finish!();
  await page
    .getByRole("button", { name: "Найти ещё выражения", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось подобрать выражения.",
  );
  expect(
    await page.evaluate(
      (storageKey) =>
        JSON.parse(localStorage.getItem(storageKey)!).customPhrases.length,
      key,
    ),
  ).toBe(0);
  await search.fill("harbor");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
