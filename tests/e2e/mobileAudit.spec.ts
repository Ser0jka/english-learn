import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyStore, makeWord } from "../../src/domain";

test.use({ isMobile: true, hasTouch: true });
async function controlsFit(page: Page) {
  const outside = await page
    .locator("main button, .topbar button, .mobile-bottom-nav button")
    .evaluateAll((buttons) =>
      buttons.flatMap((button) => {
        const bounds = button.getBoundingClientRect();
        if (
          !bounds.width ||
          !bounds.height ||
          getComputedStyle(button).visibility === "hidden"
        )
          return [];
        return bounds.left < -1 || bounds.right > innerWidth + 1
          ? [
              {
                name: button.getAttribute("aria-label") || button.textContent,
                left: bounds.left,
                right: bounds.right,
              },
            ]
          : [];
      }),
    );
  expect(outside).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

for (const [width, height] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
  [667, 375],
  [844, 390],
  [768, 1024],
]) {
  test(`all phone and tablet controls fit at ${width}x${height}, including large text`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of ["home", "cards", "words", "phrases", "reading"]) {
      await page.goto("/#" + route);
      await expect(page.locator("#page-title")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const size of ["normal", "large"]) {
        await page.evaluate(
          (value) => (document.documentElement.dataset.textSize = value),
          size,
        );
        await controlsFit(page);
      }
    }
    expect(errors).toEqual([]);
  });
}

for (const [width, height] of [
  [320, 568],
  [667, 375],
  [844, 390],
]) {
  test(`settings and form close controls stay reachable at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/#words");
    const menu = page.getByRole("button", { name: "Открыть меню" });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("button", { name: "Мои предпочтения" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Размер текста").selectOption("large");
    await dialog
      .locator(".modal-content")
      .evaluate((element) => (element.scrollTop = element.scrollHeight));
    await expect(
      dialog.getByRole("button", { name: "Закрыть", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await dialog.getByRole("button", { name: "Всё готово" }).click();

    await page
      .getByRole("button", { name: "Добавить слова", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Загрузить список" }).click();
    await dialog
      .getByLabel("Или вставьте список")
      .fill("forest;лес\ncuriosity;любознательность");
    await dialog.getByRole("button", { name: "Проверить список" }).click();
    await expect(dialog.locator(".import-preview")).toContainText(
      "Готово к импорту: 1",
    );
    await expect(
      dialog.getByRole("button", { name: "Закрыть", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Добавить слова", exact: true }),
    ).toBeFocused();
  });
}

for (const available of [false, true]) {
  test(`phone helper keeps typing and close controls visible with a keyboard, service=${available}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/health", (route) =>
      route.fulfill({
        json: { ok: true, aiAvailable: available, imageAvailable: false },
      }),
    );
    await page.addInitScript(() => {
      const viewport = Object.assign(new EventTarget(), {
        height: 844,
        offsetTop: 0,
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: viewport,
      });
    });
    await page.goto("/#reading");
    await page.getByRole("button", { name: "Открыть помощника" }).click();
    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("textbox", { name: "Ваш вопрос" });
    await expect(input).toBeInViewport({ ratio: 1 });
    await input.fill("Помоги понять это слово");
    await page.evaluate(() => {
      Object.assign(window.visualViewport!, { height: 320, offsetTop: 40 });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator(".modal-backdrop")).toHaveAttribute(
      "data-compact",
      "true",
    );
    await expect(input).toBeInViewport({ ratio: 1 });
    const bounds = await dialog.boundingBox();
    const send = await dialog
      .getByRole("button", { name: "Отправить вопрос" })
      .boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(40);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(360);
    expect(send!.y + send!.height).toBeLessThanOrEqual(
      bounds!.y + bounds!.height,
    );
    expect(
      await dialog
        .locator(".chat-messages")
        .evaluate((element) => element.clientHeight),
    ).toBeGreaterThanOrEqual(40);
    const accessibility = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations.map((violation) => violation.id)).toEqual(
      [],
    );
    await page.evaluate(() => {
      Object.assign(window.visualViewport!, { height: 844, offsetTop: 0 });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator(".modal-backdrop")).toHaveAttribute(
      "data-compact",
      "false",
    );
    await expect(input).toHaveValue("Помоги понять это слово");
    await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  });
}

for (const [width, height] of [
  [320, 568],
  [390, 844],
]) {
  test(`long vocabulary remains editable and reading popovers clear navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const word = makeWord(
      "pneumonoultramicroscopicsilicovolcanoconiosis",
      "Пневмокониоз: заболевание лёгких, связанное с вдыханием мельчайшей пыли. ".repeat(
        3,
      ),
    );
    await page.addInitScript(
      ({ state }) => {
        if (!localStorage.getItem("lexi.workspace.v1"))
          localStorage.setItem("lexi.workspace.v1", JSON.stringify(state));
      },
      { state: { ...emptyStore(), words: [...emptyStore().words, word] } },
    );
    await page.goto("/#words");
    await page.getByLabel("Поиск слова или перевода").fill(word.word);
    const tile = page.locator(".word-tile");
    await expect(tile).toHaveCount(1);
    await controlsFit(page);
    expect(
      await tile
        .locator("h3")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page
      .getByRole("button", { name: `Открыть слово ${word.word}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    expect(
      await dialog
        .locator(".modal-content")
        .evaluate((element) => element.clientHeight),
    ).toBeGreaterThan(120);
    await dialog
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/#reading");
    await page
      .locator(".reading-word")
      .filter({ hasText: /^forest$/ })
      .first()
      .click();
    const definition = page.locator(".reading-definition");
    await expect(definition).toBeInViewport({ ratio: 1 });
    const popup = await definition.boundingBox();
    const navigation = await page
      .getByRole("navigation", { name: "Навигация на телефоне" })
      .boundingBox();
    expect(popup!.y + popup!.height).toBeLessThanOrEqual(navigation!.y);
    await page.getByRole("button", { name: "Закрыть значение" }).click();
    await expect(definition).toHaveCount(0);
  });

  test(`phone cards show correct and incorrect feedback with reachable next action at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.clock.install({ time: Date.now() });
    const forest = emptyStore().words.find((word) => word.word === "forest")!;
    await page.addInitScript(
      ({ state }) => {
        if (!localStorage.getItem("lexi.workspace.v1"))
          localStorage.setItem("lexi.workspace.v1", JSON.stringify(state));
      },
      { state: { ...emptyStore(), words: [{ ...forest, dueAt: 0 }] } },
    );
    await page.goto("/#cards");
    const answers = page.locator(".answer-option");
    await expect(answers).toHaveCount(4);
    const options = await answers.allTextContents();
    const wrong = options.findIndex(
      (text) =>
        !["forest", "woods", "woodland"].some((word) => text.includes(word)),
    );
    await answers.nth(wrong).click();
    await expect(page.getByRole("status")).toContainText("Неверно");
    await expect(page.locator(".feedback-title")).toBeInViewport();
    await expect(page.getByRole("status")).toContainText("лес");
    await controlsFit(page);
    await page
      .getByRole("button", { name: /Следующая карточка|Завершить/ })
      .click();
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("lexi.workspace.v1")!).words[0] as {
          dueAt: number;
          lapses: number;
        },
    );
    expect(saved.lapses).toBe(1);
    await page.clock.setSystemTime(saved.dueAt + 1);
    await page.reload();
    await expect(page.locator(".answer-option")).toHaveCount(4);
    const correct = page
      .locator(".answer-option")
      .filter({ hasText: /forest|woodland|woods/ })
      .first();
    await correct.click();
    await expect(page.getByRole("status")).toContainText("Верно");
    await controlsFit(page);
    const next = page.getByRole("button", {
      name: /Следующая карточка|Завершить/,
    });
    await next.scrollIntoViewIfNeeded();
    const box = await next.boundingBox();
    const navigation = await page
      .getByRole("navigation", { name: "Навигация на телефоне" })
      .boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(navigation!.y);
  });
}
