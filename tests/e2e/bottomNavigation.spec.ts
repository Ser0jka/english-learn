import { test, expect, type Page } from "@playwright/test";

test.use({ isMobile: true, hasTouch: true });

const navigation = (page: Page) => page.locator(".mobile-bottom-nav");
async function expectBottom(page: Page, bottom: number) {
  // Let viewport/scroll handlers and their scheduled layout update finish.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect
    .poll(async () => {
      const box = await navigation(page).boundingBox();
      return box ? Math.abs(box.y + box.height - bottom) : Infinity;
    })
    .toBeLessThan(1);
}

for (const size of [
  { width: 320, height: 568 },
  { width: 393, height: 852 },
  { width: 667, height: 375 },
]) {
  test(`navigation stays at the screen edge across routes and scrolls: ${size.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/#home");
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--safe-area-bottom", "34px"),
    );
    for (const label of [
      "Мои слова",
      "Слова в выражениях",
      "Чтение",
      "Карточки",
      "Обзор",
    ]) {
      await navigation(page)
        .getByRole("button", { name: label, exact: true })
        .click();
      await expect(
        navigation(page).getByRole("button", { name: label, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      // Finish route scrolling before measuring deliberate document scrolls.
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      for (const fraction of [0.5, 1, 0.25, 0]) {
        await page.evaluate((value) => {
          window.scrollTo({
            top: (document.documentElement.scrollHeight - innerHeight) * value,
            behavior: "instant",
          });
        }, fraction);
        await expectBottom(page, size.height);
        const bounds = await navigation(page)
          .getByRole("button")
          .first()
          .boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
          size.height - 34,
        );
      }
    }
    await page.setViewportSize({ width: size.height, height: size.width });
    if (size.height <= 760) await expectBottom(page, size.width);
    else await expect(navigation(page)).toBeHidden();
    await page.setViewportSize(size);
    await expectBottom(page, size.height);
  });
}

test("visible viewport changes do not accumulate scroll drift or rubber-band offsets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        height: 852,
        width: 393,
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
        pageTop: 0,
      }),
    });
  });
  await page.goto("/#home");
  const changeViewport = async (height: number, offsetTop = 0, scale = 1) => {
    await page.evaluate(
      (value) => {
        Object.assign(window.visualViewport!, value);
        window.visualViewport!.dispatchEvent(new Event("resize"));
      },
      { height, offsetTop, scale },
    );
  };
  await expectBottom(page, 852);
  // Model the address bar collapsing without a layout viewport resize.
  await changeViewport(908);
  await expectBottom(page, 908);
  for (const fraction of [1, 0.5, 0, 1, 0, 1, 0]) {
    await page.evaluate((value) => {
      window.scrollTo({
        top: (document.documentElement.scrollHeight - innerHeight) * value,
        behavior: "instant",
      });
      Object.assign(window.visualViewport!, { pageTop: window.scrollY });
      window.visualViewport!.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    }, fraction);
    await expectBottom(page, 908);
  }
  await changeViewport(780, 20);
  await expectBottom(page, 800);
  await changeViewport(852, -30);
  await expectBottom(page, 852);
  await changeViewport(852, 30);
  await expectBottom(page, 852);
  await changeViewport(908, 0, 2);
  await expectBottom(page, 852);
  await changeViewport(852);
  await expectBottom(page, 852);
  await navigation(page)
    .getByRole("button", { name: "Мои слова", exact: true })
    .click();
  await expect(page).toHaveURL(/#words$/);
});

test("navigation returns after text entry and menu and remains inert behind dialogs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/#words");
  const search = page.getByPlaceholder("Найти слово или перевод…");
  await search.focus();
  await expect(navigation(page)).toBeHidden();
  await search.blur();
  await expectBottom(page, 852);
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await expect(navigation(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Закрыть меню" }).click();
  await expectBottom(page, 852);
  const help = page.getByRole("button", { name: "Открыть помощника" });
  await help.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(
    await navigation(page).evaluate((element) => !!element.closest("[inert]")),
  ).toBe(true);
  await navigation(page)
    .locator("button")
    .first()
    .evaluate((element) => element.focus());
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(help).toBeFocused();
  await expectBottom(page, 852);
});
