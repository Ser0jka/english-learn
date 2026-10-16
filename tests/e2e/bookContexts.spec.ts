import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { findBookCandidates } from "../../book-contexts.mjs";
import { PHRASES } from "../../src/data";
import manifest from "../../public/data/books/manifest.json" with { type: "json" };

const key = "lexi.workspace.v1";
async function ready(page: Page) {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
}
async function bookQuote() {
  const [candidate] = await findBookCandidates("fall asleep");
  return {
    ...candidate,
    translation:
      "Он почувствовал, как его охватывает спокойствие, и вскоре заснул.",
    translationKind: "summary" as const,
    note: "Герой отдыхает у озера; fell asleep означает «заснул».",
  };
}
async function openExpression(page: Page) {
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("fall asleep");
  await page
    .getByRole("button", { name: "Подробнее: fall asleep", exact: true })
    .click();
}

for (const width of [320, 1440]) {
  test(`finds real book context for an existing meaning, opens its exact paragraph and keeps it after reload at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 852 });
    await ready(page);
    const quote = await bookQuote();
    let calls = 0;
    await page.route("**/api/materials/contexts", (route) => {
      calls++;
      const input = route.request().postDataJSON().phrases[0];
      expect(input.text).toBe("fall asleep");
      expect(input.definition).toContain("sleep");
      return route.fulfill({
        json: {
          contexts: [{ id: input.id, status: "found", quotes: [quote] }],
        },
      });
    });
    await openExpression(page);
    const citation = page.locator(".source-quote");
    await expect(citation).toContainText(quote.title);
    await expect(citation).toContainText("КОРОТКО ПО-РУССКИ");
    await expect(citation.locator("mark")).toHaveText("fell asleep");
    await citation.locator(".context-excerpt").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".book-selected-passage")).toBeFocused();
    await expect(dialog.locator(".book-selected-passage")).toContainText(
      quote.text,
    );
    await expect(dialog.locator(".book-page-controls").first()).toContainText(
      `Страница ${Math.floor(quote.paragraph / 30) + 1}`,
    );
    await expect(dialog.locator(".book-prose p")).toHaveCount(30);
    const accessibility = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations.map((issue) => issue.id)).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await dialog
      .getByRole("button", { name: "Начало книги", exact: true })
      .click();
    await expect(dialog.locator(".book-page-controls").first()).toContainText(
      "Страница 1 из",
    );
    await dialog.getByRole("button", { name: "Дальше", exact: true }).click();
    await expect(dialog.locator(".book-page-controls").first()).toContainText(
      "Страница 2 из",
    );
    await dialog.getByRole("button", { name: "Назад", exact: true }).click();
    await expect(dialog.locator(".book-page-controls").first()).toContainText(
      "Страница 1 из",
    );
    await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(citation.locator(".context-excerpt")).toBeFocused();
    const saved = await page.evaluate(
      (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
      key,
    );
    expect(Object.values(saved.bookContexts)).toHaveLength(1);
    expect(saved.logs).toEqual([]);
    await page.reload();
    await page.getByLabel("Найти выражения по слову").fill("fall asleep");
    await page
      .getByRole("button", { name: "Подробнее: fall asleep", exact: true })
      .click();
    await expect(citation).toContainText(quote.text);
    expect(calls).toBe(1);
  });
}

test("all ten books can be opened without AI and an opened book works after offline reload", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/#phrases");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page
    .getByRole("button", { name: "Открыть библиотеку", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator(".word-picker-option")).toHaveCount(10);
  await dialog
    .locator(".word-picker-option")
    .filter({ hasText: "Alice" })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.locator(".book-prose p")).toHaveCount(30);
  const downloadPromise = page.waitForEvent("download");
  await dialog
    .getByRole("link", {
      name: "Скачать полный текст с лицензией",
      exact: true,
    })
    .click();
  const download = await downloadPromise;
  const file = await download.path();
  const raw = await readFile(file!);
  expect(createHash("sha256").update(raw).digest("hex")).toBe(
    manifest.books.find((book) => book.id === "11")!.sourceSha256,
  );
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Открыть библиотеку", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .locator(".word-picker-option")
    .filter({ hasText: "Alice" })
    .click();
  await expect(page.getByRole("dialog").locator(".book-prose p")).toHaveCount(
    30,
  );
});

test.describe("book download failures", () => {
  // Request injection must reach fetch rather than the service worker's cache.
  test.use({ serviceWorkers: "block" });
  test("a corrupted book response has a recoverable error and preserves progress", async ({
    page,
  }) => {
    let failed = false;
    await page.route("**/data/books/11.json", (route) => {
      if (!failed) {
        failed = true;
        return route.fulfill({
          json: { title: "Corrupt book", paragraphs: [] },
        });
      }
      return route.continue();
    });
    await page.goto("/#phrases");
    const before = await page.evaluate(
      (storageKey) => localStorage.getItem(storageKey),
      key,
    );
    await page
      .getByRole("button", { name: "Открыть библиотеку", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .locator(".word-picker-option")
      .filter({ hasText: "Alice" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("alert")).toContainText(
      "Не удалось открыть книгу",
    );
    await dialog
      .getByRole("button", { name: "Повторить загрузку", exact: true })
      .click();
    await expect(dialog.locator(".book-prose p")).toHaveCount(30);
    expect(
      await page.evaluate(
        (storageKey) => localStorage.getItem(storageKey),
        key,
      ),
    ).toBe(before);
  });
});

test("generated expressions retain grounded book examples together with the learned phrase", async ({
  page,
}) => {
  await ready(page);
  const quote = await bookQuote();
  const phrase = {
    ...PHRASES[0],
    id: "generated-asleep",
    text: "fall asleep",
    translation: "засыпать",
    keywords: ["sleep"],
    generated: true,
    bookQuotes: [quote],
    contextStatus: "found",
  };
  await page.route("**/api/materials/phrases", (route) =>
    route.fulfill({ json: { phrases: [phrase] } }),
  );
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("sleep");
  await page
    .getByRole("button", { name: "Найти ещё выражения", exact: true })
    .click();
  const row = page
    .locator(".phrase-item")
    .filter({ has: page.getByText("засыпать", { exact: true }) });
  await row
    .getByRole("button", { name: "Подробнее: fall asleep", exact: true })
    .click();
  await expect(row.locator(".source-quote")).toContainText(quote.text);
  await expect(row.locator(".generated-note")).toContainText("Подобрано ИИ");
  await row
    .getByRole("button", { name: "Учить: fall asleep", exact: true })
    .click();
  await page.reload();
  await page.getByLabel("Найти выражения по слову").fill("sleep");
  await row
    .getByRole("button", { name: "Подробнее: fall asleep", exact: true })
    .click();
  await expect(
    row.getByRole("button", { name: "Не изучать: fall asleep", exact: true }),
  ).toBeVisible();
  await expect(row.locator(".source-quote")).toContainText(quote.title);
  const saved = await page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
    key,
  );
  expect(saved.customPhrases[0].bookQuotes[0].bookId).toBe(quote.bookId);
});

for (const status of ["not-found", "unavailable"]) {
  test(`a ${status} context can be retried without hiding the expression or fabricating a quote`, async ({
    page,
  }) => {
    await ready(page);
    const quote = await bookQuote();
    let calls = 0;
    await page.route("**/api/materials/contexts", (route) => {
      const id = route.request().postDataJSON().phrases[0].id;
      return route.fulfill({
        json: {
          contexts: [
            {
              id,
              status: calls++ ? "found" : status,
              quotes: calls > 1 ? [quote] : [],
            },
          ],
        },
      });
    });
    await openExpression(page);
    await expect(page.locator(".book-contexts")).toContainText(
      status === "not-found"
        ? "подходящий пример этого значения пока не найден"
        : "Не удалось подобрать книжный пример",
    );
    await expect(page.locator(".source-quote")).toHaveCount(0);
    await page
      .getByRole("button", {
        name:
          status === "unavailable"
            ? "Повторить поиск в книгах"
            : "Искать контекст в книгах",
        exact: true,
      })
      .click();
    await expect(page.locator(".source-quote")).toContainText(quote.text);
    await expect(
      page.getByRole("button", { name: "Учить: fall asleep", exact: true }),
    ).toBeVisible();
  });
}
