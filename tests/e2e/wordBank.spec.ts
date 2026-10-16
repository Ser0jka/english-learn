import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { CATALOG } from "../../src/data";
import { emptyStore } from "../../src/domain";
import { WORD_BANK } from "../../src/wordBank";
const key = "lexi.workspace.v1";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(state));
    },
    { key, state: { ...emptyStore(), words: CATALOG } },
  );
});
test("dictionary cards work without images or AI, reveal meaning only after an answer and preserve the schedule", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#cards");
  await page.getByRole("button", { name: "Новые слова", exact: true }).click();
  await expect(page.locator(".word-bank-notice")).toContainText("10");
  await expect(page.locator(".study-top")).toContainText("/ 10");
  await expect(page.locator(".answer-option")).toHaveCount(4);
  await expect(page.locator(".context-art")).toContainText(
    "Словарное значение",
  );
  await expect(page.locator(".flash-content")).not.toContainText(
    WORD_BANK[0].translation,
  );
  await page
    .getByRole("button", { name: WORD_BANK[0].word, exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    WORD_BANK[0].translation,
  );
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  );
  expect(saved.words).toHaveLength(CATALOG.length + 1);
  expect(saved.words.at(-1)).toMatchObject({
    bankId: WORD_BANK[0].bankId,
    successes: 1,
    status: "learning",
  });
  expect(saved.words.at(-1).dueAt - saved.words.at(-1).lastReviewedAt).toBe(
    86400000,
  );
  await page.reload();
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  );
  expect(restored).toEqual(saved);
  expect(errors).toEqual([]);
});
test("new dictionary mode is accessible and fits a small phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/#cards");
  await page.getByRole("button", { name: "Новые слова", exact: true }).click();
  await expect(page.locator(".answer-option")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
  const source = await page.request.get("/data/word-bank-credits.txt");
  expect(source.ok()).toBe(true);
  expect(await source.text()).toContain("CC BY-SA");
});
