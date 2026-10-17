import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyStore } from "../../src/domain";
import { PHRASES } from "../../src/data";

const key = "lexi.workspace.v1";
for (const width of [320, 393])
  test(`offline complete and easy have many translated examples at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.route("**/api/health", (route) =>
      route.fulfill({ json: { ok: true, aiAvailable: false } }),
    );
    let calls = 0;
    await page.route("**/api/materials/**", (route) => {
      calls++;
      return route.abort();
    });
    await page.goto("/#phrases");
    const search = page.getByLabel("Найти выражения по слову");
    await search.fill("complete");
    await expect(page.locator(".phrase-item")).toHaveCount(12);
    await page
      .getByRole("button", { name: "Подробнее: complete a task", exact: true })
      .click();
    await expect(
      page.locator(".phrase-item.is-open .phrase-example"),
    ).toHaveCount(2);
    await expect(page.locator(".phrase-item.is-open")).toContainText(
      "Нам нужно больше времени",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations.map((issue) => issue.id)).toEqual([]);
    await search.fill("easy");
    await expect
      .poll(() => page.locator(".phrase-item").count())
      .toBeGreaterThanOrEqual(12);
    await page
      .getByRole("button", { name: "Подробнее: easy money", exact: true })
      .first()
      .click();
    await expect(page.locator(".phrase-item.is-open")).toContainText(
      "лёгкие деньги",
    );
    await expect(
      page.locator(".phrase-item.is-open .phrase-example"),
    ).toHaveCount(2);
    expect(calls).toBe(0);
  });

test("automatically tops up a short nonempty collection, excludes it, and remembers the successful search", async ({
  page,
}) => {
  const old = {
    ...PHRASES[0],
    id: "old-adapt",
    text: "adapt to change",
    translation: "приспосабливаться к переменам",
    keywords: ["adapt"],
  };
  const extra = {
    ...old,
    id: "new-adapt",
    text: "adapt to a new environment",
    translation: "приспосабливаться к новой среде",
  };
  await page.addInitScript(
    ({ key, store }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(store));
    },
    { key, store: { ...emptyStore(), customPhrases: [old] } },
  );
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
  const bodies: Array<{ word: string; exclude: string[] }> = [];
  await page.route("**/api/materials/phrases", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { phrases: [extra] } });
  });
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("adapt");
  await expect(
    page.getByRole("heading", { name: "adapt to a new environment" }),
  ).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(bodies[0].exclude).toContain("adapt to change");
  await page.reload();
  await page.getByLabel("Найти выражения по слову").fill("adapt");
  await expect(
    page.getByRole("heading", { name: "adapt to a new environment" }),
  ).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(3000);
  expect(bodies).toHaveLength(1);
});

test("dictionary entries get translated examples, preserve them across reload and update a just-learned phrase", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
  await page.route("**/api/materials/contexts", (route) =>
    route.fulfill({
      json: {
        contexts: route
          .request()
          .postDataJSON()
          .phrases.map((phrase: { id: string }) => ({
            id: phrase.id,
            status: "not-found",
            quotes: [],
          })),
      },
    }),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const examples = [
    {
      text: "She sat in an easy chair by the fire.",
      translation: "Она сидела в мягком кресле у камина.",
    },
    {
      text: "An easy chair stood beside the window.",
      translation: "У окна стояло мягкое кресло.",
    },
    {
      text: "He bought an easy chair for his study.",
      translation: "Он купил мягкое кресло для своего кабинета.",
    },
  ];
  await page.route("**/api/materials/phrase-examples", async (route) => {
    calls++;
    expect(route.request().postDataJSON().text).toBe("easy chair");
    await pending;
    await route.fulfill({ json: { examples } });
  });
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("easy");
  await page
    .getByRole("button", { name: "Подробнее: easy chair", exact: true })
    .click();
  await expect(
    page.getByText("Готовим примеры с переводом…", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Учить: easy chair", exact: true })
    .click();
  release();
  await expect(
    page.locator(".phrase-item.is-open .phrase-example"),
  ).toHaveCount(3);
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).words.find(
            (word: { word: string }) => word.word === "easy chair",
          )?.exampleRu,
        key,
      ),
    )
    .toBe(examples[0].translation);
  await page.reload();
  await page.getByLabel("Найти выражения по слову").fill("easy");
  await page
    .getByRole("button", { name: "Подробнее: easy chair", exact: true })
    .click();
  await expect(
    page.locator(".phrase-item.is-open .phrase-example"),
  ).toHaveCount(3);
  expect(calls).toBe(1);
});

test("a provider outage leaves the starter collection and its examples usable", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
  await page.route("**/api/materials/phrases", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "Помощник временно недоступен." },
    }),
  );
  await page.route("**/api/materials/contexts", (route) => route.abort());
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("complete");
  await page
    .getByRole("button", { name: "Найти ещё выражения", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Найденные выражения и примеры доступны",
  );
  await expect(page.locator(".phrase-item")).toHaveCount(12);
  await page
    .getByRole("button", { name: "Подробнее: complete a course", exact: true })
    .click();
  await expect(
    page.locator(".phrase-item.is-open .phrase-example"),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Учить: complete a course", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Не изучать: complete a course",
      exact: true,
    }),
  ).toBeVisible();
});
