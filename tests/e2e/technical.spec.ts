import { test, expect } from "@playwright/test";
const key = "lexi.workspace.v1";
test("core desktop and mobile flows have no unexpected console or runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["home", "cards", "words", "phrases", "reading"]) {
      await page.goto("/#" + route);
      await expect(page.locator("#page-title")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.getByRole("button", { name: "Открыть помощника" }).click();
  await page.getByRole("button", { name: "Пример в контексте" }).click();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
test("untrusted imports render as text and never execute markup", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("tab", { name: "Загрузить список" }).click();
  const payload = '<img src=x onerror="window.__xss=true">';
  await d
    .getByLabel("Или вставьте список")
    .fill(JSON.stringify([{ word: "xss-test", translation: payload }]));
  await d.getByRole("button", { name: "Добавить слова", exact: true }).click();
  await page.goto("/#words");
  await page.getByLabel("Поиск слова или перевода").fill("xss-test");
  await expect(page.locator(".word-tile-copy")).toContainText(payload);
  expect(
    await page.evaluate(() => Reflect.get(window, "__xss")),
  ).toBeUndefined();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});
test("a second tab cannot silently overwrite the first tab's progress", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator("#page-title")).toBeVisible();
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator("#page-title")).toBeVisible();
  await page.getByRole("button", { name: "Начать практику" }).click();
  await page.getByRole("button", { name: "forest", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText("другой вкладке");
  const saved = await page.evaluate((key) => localStorage.getItem(key), key);
  await other.getByRole("button", { name: "Мои предпочтения" }).click();
  await other.getByLabel("Ежедневная цель (разных значений)").selectOption("5");
  await other.getByRole("button", { name: "Всё готово" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    saved,
  );
  const download = other.waitForEvent("download");
  await other
    .getByRole("button", { name: "Экспортировать", exact: true })
    .click();
  await download;
  await other.reload();
  await expect(other.getByRole("alert")).toHaveCount(0);
  await other.close();
});
test("vocabulary still works when randomUUID is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Слово или выражение").fill("resilient");
  await d.getByLabel("Перевод", { exact: true }).fill("устойчивый");
  await d.getByRole("button", { name: "Добавить в словарь" }).click();
  await expect(d).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)!).words.some(
          (w: { word: string }) => w.word === "resilient",
        ),
      key,
    ),
  ).toBe(true);
});
test("opening help cannot discard unsaved word edits", async ({ page }) => {
  await page.goto("/#words");
  await page.getByRole("button", { name: "Открыть слово forest" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Перевод", { exact: true }).fill("роща");
  await d.getByRole("button", { name: "Спросить об этом слове" }).click();
  await expect(d.getByRole("alert")).toContainText("Сохраните изменения");
  await expect(d.getByLabel("Перевод", { exact: true })).toHaveValue("роща");
});
