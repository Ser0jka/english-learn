import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PHRASES } from "../../src/data";
import { emptyStore } from "../../src/domain";

const key = "lexi.workspace.v1";
const expression = {
  ...PHRASES[0],
  id: "direct-resilience",
  text: "build resilience",
  translation: "развивать стойкость",
  keywords: ["resilience"],
  generated: true,
  exceptions: "",
};
async function setup(page: Page, aiAvailable = true) {
  await page.addInitScript(
    ({ key, store }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(store));
    },
    { key, store: { ...emptyStore(), words: [] } },
  );
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable } }),
  );
}

test("automatically finds expressions for a word absent from an empty personal dictionary on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await setup(page);
  const bodies: unknown[] = [];
  await page.route("**/api/materials/phrases", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { phrases: [expression] } });
  });
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("  RESILIENCE ");
  await expect(
    page.getByRole("heading", { name: "build resilience" }),
  ).toBeVisible();
  expect(bodies).toEqual([{ word: "resilience" }]);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).words,
      key,
    ),
  ).toEqual([]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const issues = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(issues.violations.map((issue) => issue.id)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Учить: build resilience", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Подробнее: build resilience", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Нюансы и исключения", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Найти выражения по слову").fill("resilience");
  await expect(
    page.getByRole("button", {
      name: "Не изучать: build resilience",
      exact: true,
    }),
  ).toBeVisible();
  expect(bodies).toHaveLength(1);
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await page.getByLabel("Найти выражения по слову").fill("resilience");
  await expect(
    page.getByRole("heading", { name: "build resilience" }),
  ).toBeVisible();
  expect(bodies).toHaveLength(1);
});

test("Enter submits immediately and an obsolete answer cannot save after the search changes", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/materials/phrases", async (route) => {
    await pending;
    await route.fulfill({ json: { phrases: [expression] } });
  });
  await page.goto("/#phrases");
  const search = page.getByLabel("Найти выражения по слову");
  await search.fill("resilience");
  const request = page.waitForRequest("**/api/materials/phrases");
  await search.press("Enter");
  await request;
  await expect(
    page.getByRole("status").filter({ hasText: "Подбираем выражения" }),
  ).toBeVisible();
  await search.fill("book");
  release();
  await expect(
    page.getByRole("heading", { name: "build resilience" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Подбираем выражения" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).customPhrases,
      key,
    ),
  ).toEqual([]);
});

test("uses ready material offline without demanding a translation or a saved word", async ({
  page,
}) => {
  await setup(page, false);
  let requests = 0;
  await page.route("**/api/materials/phrases", (route) => {
    requests++;
    return route.abort();
  });
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("time");
  await page
    .getByRole("button", { name: "Найти выражения", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "take your time" }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await page.getByLabel("Найти выражения по слову").fill("resilience");
  await expect(
    page.getByRole("button", { name: "Найти ещё выражения", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Готовых выражений пока нет", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(0);
});

test("a failed automatic search can be retried explicitly without an automatic request loop", async ({
  page,
}) => {
  await setup(page);
  let requests = 0;
  await page.route("**/api/materials/phrases", (route) => {
    requests++;
    return requests === 1
      ? route.fulfill({
          status: 502,
          json: { error: "Не удалось подобрать выражения." },
        })
      : route.fulfill({ json: { phrases: [expression] } });
  });
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("resilience");
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось подобрать выражения.",
  );
  await page
    .getByRole("button", { name: "Повторить подбор", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "build resilience" }),
  ).toBeVisible();
  expect(requests).toBe(2);
});

test("no-result searches run once and cancellation stops saving the pending result", async ({
  page,
}) => {
  await setup(page);
  let requests = 0;
  await page.route("**/api/materials/phrases", (route) => {
    requests++;
    return route.fulfill({ json: { phrases: [] } });
  });
  await page.goto("/#phrases");
  const search = page.getByLabel("Найти выражения по слову");
  await search.fill("qzxqzxqzx");
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator(".toast")).toContainText(
    "Других выражений пока не нашлось",
  );
  // Change unrelated UI after completion: this must not start another request.
  await page.getByRole("button", { name: "Учу · 0", exact: true }).click();
  await page.getByRole("button", { name: "Учу · 0", exact: true }).click();
  await page.clock.install();
  await page.clock.fastForward(3000);
  expect(requests).toBe(1);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.unroute("**/api/materials/phrases");
  await page.route("**/api/materials/phrases", async (route) => {
    await pending;
    await route.fulfill({ json: { phrases: [expression] } });
  });
  await search.fill("resilience");
  await search.press("Enter");
  await page
    .getByRole("button", { name: "Отменить подбор", exact: true })
    .click();
  release();
  await expect(
    page.getByRole("button", { name: "Найти ещё выражения", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).customPhrases,
      key,
    ),
  ).toEqual([]);
});

test("optional dictionary meanings do not require creating a word", async ({
  page,
}) => {
  await setup(page);
  let body: unknown;
  await page.route("**/api/materials/phrases", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: { phrases: [] } });
  });
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("book");
  await page.getByText("Уточнить значение слова", { exact: true }).click();
  await page
    .locator(".phrase-meanings")
    .getByRole("button", { name: "бронировать", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Найти ещё выражения", exact: true })
    .click();
  await expect
    .poll(() => body)
    .toMatchObject({ word: "book", translation: "бронировать" });
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).words,
      key,
    ),
  ).toEqual([]);
});

test("waits for completed IME input and debounces edits to the final word", async ({
  page,
}) => {
  await setup(page);
  const bodies: unknown[] = [];
  await page.route("**/api/materials/phrases", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { phrases: [expression] } });
  });
  await page.goto("/#phrases");
  const search = page.getByLabel("Найти выражения по слову");
  await search.dispatchEvent("compositionstart");
  await search.fill("resi");
  await expect(
    page.getByRole("button", { name: "Найти ещё выражения", exact: true }),
  ).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.clock.fastForward(3000);
  expect(bodies).toEqual([]);
  await search.dispatchEvent("compositionend");
  await page.clock.fastForward(400);
  await search.fill("resilience");
  await page.clock.fastForward(500);
  expect(bodies).toEqual([]);
  await page.clock.fastForward(500);
  await expect(
    page.getByRole("heading", { name: "build resilience" }),
  ).toBeVisible();
  expect(bodies).toEqual([{ word: "resilience" }]);
});
