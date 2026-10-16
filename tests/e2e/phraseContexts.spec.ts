import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 1440]) {
  test(`cited context opens the complete book and reflows at ${width}px`, async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#phrases");
    await page.getByLabel("Найти выражения по слову").fill("learn by heart");
    await page
      .getByRole("button", { name: "Подробнее: learn by heart", exact: true })
      .click();
    const citation = page.locator(".source-quote");
    await expect(citation).toContainText("ИЗ КНИГИ");
    await expect(citation.locator("cite")).toContainText("Pride and Prejudice");
    await expect(citation).toContainText("Джейн Остин");
    await expect(citation).toContainText("Глава 37");
    await expect(citation).toContainText(
      "Knowing by heart описывает результат",
    );
    await expect(page.locator(".phrase-example .eyebrow")).toHaveText(
      "УЧЕБНЫЙ ПРИМЕР",
    );
    const link = citation.getByRole("link", { name: /Читать полный текст:/ });
    const url = "https://www.gutenberg.org/ebooks/1342.html.images";
    await expect(link).toHaveAttribute("href", url);
    await expect(citation.locator(".context-excerpt")).toHaveAttribute(
      "href",
      url,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .include(".source-quote")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    // Verify navigation without relying on the availability of an external site.
    await context.route(url, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Book source</title><p>External navigation test</p>",
      }),
    );
    await link.focus();
    const popupPromise = page.waitForEvent("popup");
    await page.keyboard.press("Enter");
    const popup = await popupPromise;
    await expect(popup).toHaveURL(url);
    await popup.close();
    const excerptPopup = page.waitForEvent("popup");
    await citation.locator(".context-excerpt").click();
    const opened = await excerptPopup;
    await expect(opened).toHaveURL(url);
    await opened.close();
    expect(errors).toEqual([]);
  });
}

test("dictionary contexts remain tied to one meaning and survive saving an expression", async ({
  page,
}) => {
  await page.goto("/#phrases");
  await page.getByLabel("Найти выражения по слову").fill("give up");
  const row = page
    .locator(".phrase-item")
    .filter({
      has: page.getByText("отказываться от; оставлять; бросать", {
        exact: true,
      }),
    });
  await row
    .getByRole("button", { name: "Подробнее: give up", exact: true })
    .click();
  await expect(row.locator(".source-quote")).toContainText("give up the point");
  await expect(row.locator(".source-quote")).toContainText("Глава 20");
  await row
    .getByRole("button", { name: "Учить: give up", exact: true })
    .click();
  await page.reload();
  await page.getByLabel("Найти выражения по слову").fill("give up");
  await row
    .getByRole("button", { name: "Подробнее: give up", exact: true })
    .click();
  await expect(
    row.getByRole("button", { name: "Не изучать: give up", exact: true }),
  ).toBeVisible();
  await expect(row.locator(".source-quote")).toContainText("Джейн Остин");
  const other = page
    .locator(".phrase-item")
    .filter({
      has: page.getByText("сдаваться; сдаться; капитулировать", {
        exact: true,
      }),
    });
  await other
    .getByRole("button", { name: "Подробнее: give up", exact: true })
    .click();
  await expect(other.locator(".source-quote")).toHaveCount(0);
});
