import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const key = "lexi.workspace.v1";
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const width of [320, 390, 768, 1440]) {
  test(`all screens have accessible contrast and reflow at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["home", "words", "cards", "phrases", "reading"]) {
      await page.goto("/#" + route);
      await expect(page.locator("#page-title")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await noOverflow(page);
      await accessible(page);
      if (route === "phrases") {
        expect(
          await page
            .locator(".phrase-title")
            .first()
            .evaluate((el) => el.getBoundingClientRect().width),
        ).toBeGreaterThan(width <= 390 ? 180 : 240);
      }
    }
  });
}
test("first visit explains demo words and dismisses permanently", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Как начать" })).toContainText(
    "12 учебных примеров",
  );
  await page
    .getByRole("button", { name: "Скрыть подсказку первого запуска" })
    .click();
  await page.reload();
  await expect(page.locator(".welcome-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Начать практику" }).click();
  await expect(page).toHaveTitle("Карточки · Lexi");
  await expect(page.locator("#page-title")).toBeFocused();
});
test("keyboard tabs, preview duplicates, errors and image completion are actionable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("tab", { name: "Одно слово" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(d.getByRole("tab", { name: "Загрузить список" })).toBeFocused();
  await expect(
    d.getByRole("tab", { name: "Загрузить список" }),
  ).toHaveAttribute("aria-selected", "true");
  await d
    .getByLabel("Или вставьте список")
    .fill("forest;лес\nserendipity;счастливая случайность");
  await d.getByRole("button", { name: "Проверить список" }).click();
  await expect(d.locator(".import-preview")).toContainText(
    "Готово к импорту: 1",
  );
  await expect(d.locator(".import-preview")).toContainText(
    "повторяются в файле: 1",
  );
  await expect(d.locator(".import-preview")).toContainText(
    "Без иллюстрации: 1",
  );
  await accessible(page);
  await d.getByRole("button", { name: "Добавить слова", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить иллюстрацию", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("serendipity");
  await expect(page.getByRole("dialog")).toContainText(
    "Можно загрузить свою картинку",
  );
});
test("autofill never leaves a translation for the previous word", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Слово или выражение").fill("forest");
  await expect(d.getByLabel("Перевод", { exact: true })).toHaveValue("лес");
  await d.getByLabel("Слово или выражение").fill("unusualword");
  await expect(d.getByLabel("Перевод", { exact: true })).toHaveValue("");
  await d.getByLabel("Перевод", { exact: true }).fill("мой перевод");
  await d.getByLabel("Слово или выражение").fill("book");
  await expect(d.getByLabel("Перевод", { exact: true })).toHaveValue(
    "мой перевод",
  );
  await accessible(page);
});
test("missing illustrations and future review queues provide useful next actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    s.words = s.words.slice(0, 1).map((w: Record<string, unknown>) => ({
      ...w,
      concept: "",
      image: undefined,
      example: "",
      definition: "",
      dueAt: Date.now() + 86400000,
    }));
    localStorage.setItem(key, JSON.stringify(s));
  }, key);
  await page.goto("/#cards");
  await page.reload();
  await page.getByRole("button", { name: "Дополнить карточки" }).click();
  await expect(page).toHaveURL(/#words$/);
  await page.getByRole("button", { name: "Без карточки · 1" }).click();
  await expect(
    page.getByRole("button", { name: "Открыть слово forest" }),
  ).toBeVisible();
  await page.goto("/#cards");
  await page.getByRole("button", { name: "Повторяю", exact: true }).click();
  await expect(page.locator(".next-review")).toContainText(
    "Ближайшее повторение",
  );
  await page.getByRole("button", { name: "Изучать слова" }).click();
  await expect(
    page.getByRole("button", { name: "Учу сейчас", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await accessible(page);
});
test("helper distinguishes loading, offline and unconfigured and retries connection", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let online = false;
  await page.route("**/api/health", async (route) => {
    await gate;
    if (!online) {
      await route.abort();
    } else
      await route.fulfill({
        json: { ok: true, aiAvailable: false, imageAvailable: false },
      });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть помощника" }).click();
  await expect(page.locator(".service-notice")).toHaveAttribute(
    "data-status",
    "loading",
  );
  await expect(page.locator(".service-notice")).toContainText(
    "Проверяем доступность",
  );
  release();
  await expect(page.locator(".service-notice")).toHaveAttribute(
    "data-status",
    "offline",
  );
  online = true;
  await page.getByRole("button", { name: "Повторить подключение" }).click();
  await expect(page.locator(".service-notice")).toHaveAttribute(
    "data-status",
    "unconfigured",
  );
  await page.getByRole("button", { name: "Что это значит?" }).click();
  await expect(page.getByRole("log")).toContainText("forest — лес");
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Открыть помощника" }),
  ).toBeFocused();
});
test("feedback is accessible, translated and does not intercept navigation with Enter", async ({
  page,
}) => {
  await page.goto("/#cards");
  await page
    .locator(".answer-option")
    .filter({ hasNotText: /forest|woods|woodland/ })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Неверно");
  await expect(page.locator(".feedback-translation")).toContainText("Мы шли");
  await accessible(page);
  const nav = page
    .getByRole("navigation")
    .getByRole("button", { name: "Мои слова", exact: true });
  await nav.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#words$/);
});
test("correct feedback exposes accessible progress and moves focus to the next question", async ({
  page,
}) => {
  await page.goto("/#cards");
  await page.getByRole("button", { name: "forest", exact: true }).click();
  await accessible(page);
  await expect(
    page.getByRole("progressbar", { name: "Пройдено карточек" }),
  ).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Следующая карточка" }).click();
  await expect(
    page.getByRole("heading", { name: "Какое слово здесь спрятано?" }),
  ).toBeFocused();
});
test("mobile reading definition is visible at selection and idioms expand accessibly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#reading");
  await page.locator(".reading-word").first().click();
  await expect(page.locator(".reading-definition")).toBeInViewport();
  await accessible(page);
  await noOverflow(page);
  await page.getByRole("button", { name: "Закрыть значение" }).click();
  await expect(page.locator(".reading-definition")).toHaveCount(0);
  await page.goto("/#phrases");
  await page.getByRole("button", { name: "Подробнее: break the ice" }).click();
  await expect(
    page.getByRole("button", { name: "Подробнее: break the ice" }),
  ).toHaveAttribute("aria-controls", "details-break-ice");
  await accessible(page);
  await noOverflow(page);
});
test("empty saved expressions and dictionary search explain recovery", async ({
  page,
}) => {
  await page.goto("/#phrases");
  await page.getByRole("button", { name: "Учу · 0", exact: true }).click();
  await expect(page.locator(".empty-state")).toContainText("Нажмите «Учить»");
  await page.getByRole("button", { name: "Показать подборку" }).click();
  await expect(page.locator(".phrase-item")).toHaveCount(12);
  await page.goto("/#words");
  await page
    .getByRole("textbox", { name: "Поиск слова или перевода" })
    .fill("noresult");
  await expect(page.locator(".empty-state")).toContainText(
    "Не нашли такого слова",
  );
  await accessible(page);
  await page.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(page.locator(".word-tile")).toHaveCount(12);
});
test("empty collection opens adding words from cards and dictionary", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    s.words = [];
    s.logs = [];
    localStorage.setItem(key, JSON.stringify(s));
  }, key);
  await page.goto("/#cards");
  await page.reload();
  await expect(page.locator(".empty-state")).toContainText(
    "Начнём с ваших слов",
  );
  await page
    .getByRole("button", { name: "Добавить слова", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await accessible(page);
  await page.keyboard.press("Escape");
  await page.goto("/#words");
  await expect(page.locator(".empty-state")).toContainText(
    "Здесь будет ваша коллекция",
  );
  await accessible(page);
});
test("assistant displays loading and server error then resends the failed question", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let calls = 0;
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ok: true, aiAvailable: true } }),
  );
  await page.route("**/api/assistant", async (r) => {
    calls++;
    if (calls === 1) {
      await gate;
      await r.fulfill({
        status: 503,
        json: { error: "Сервис временно занят. Попробуйте ещё раз." },
      });
    } else
      await r.fulfill({
        json: { answer: "A forest is a large area covered with trees." },
      });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть помощника" }).click();
  await expect(page.locator(".service-notice")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await page.getByLabel("Ваш вопрос").fill("Explain forest in simple English");
  await page.getByRole("button", { name: "Отправить вопрос" }).click();
  await expect(page.locator(".chat-form")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".chat-thinking")).toBeVisible();
  release();
  await expect(page.getByRole("log")).toContainText("Сервис временно занят");
  await page.getByRole("button", { name: "Повторить вопрос" }).click();
  await expect(page.getByRole("log")).toContainText("A forest is a large area");
  await expect(
    page.getByRole("button", { name: "Повторить вопрос" }),
  ).toHaveCount(0);
  expect(calls).toBe(2);
  await accessible(page);
});
