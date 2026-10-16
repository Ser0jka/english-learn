import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [width, accent] of [
  [320, "brass"],
  [393, "amber"],
  [1440, "silver"],
] as const) {
  test(`collection action uses the shared button style and adds a meaning at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto("/#home");
    await page.evaluate(
      (value) => (document.documentElement.dataset.accent = value),
      accent,
    );
    const card = page.locator(".discovery-card");
    const button = card.getByRole("button", {
      name: "В мою коллекцию",
      exact: true,
    });
    await button.scrollIntoViewIfNeeded();
    const style = await button.evaluate((element) => {
      const css = getComputedStyle(element);
      return {
        radius: parseFloat(css.borderTopLeftRadius),
        left: parseFloat(css.paddingLeft),
        bottom: parseFloat(css.paddingBottom),
        border: parseFloat(css.borderLeftWidth),
        height: element.getBoundingClientRect().height,
      };
    });
    expect(style.radius).toBeGreaterThanOrEqual(8);
    expect(style.left).toBeGreaterThanOrEqual(12);
    expect(style.bottom).toBeGreaterThanOrEqual(10);
    expect(style.border).toBe(1);
    expect(style.height).toBeGreaterThanOrEqual(44);
    const suggested = await card.locator("h3").innerText();
    const meaning = await card.locator(".discovery-translation").innerText();
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem("lexi.workspace.v1")!).words.length,
    );
    await button.click();
    const after = await page.evaluate(
      () => JSON.parse(localStorage.getItem("lexi.workspace.v1")!).words.length,
    );
    expect(after).toBe(before + 1);
    const accessibility = await new AxeBuilder({ page })
      .include(".discovery-card")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations.map((issue) => issue.id)).toEqual([]);
    const words = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("lexi.workspace.v1")!).words as Array<{
          word: string;
          translation: string;
        }>,
    );
    expect(
      words.some(
        (word) => word.word === suggested && word.translation === meaning,
      ),
    ).toBe(true);
    await page.reload();
    await expect(page.locator(".discovery-button")).toHaveClass(
      /button primary/,
    );
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("lexi.workspace.v1")!).words.length,
      ),
    ).toBe(after);
  });
}
