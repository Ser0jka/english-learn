import { test, expect } from "@playwright/test";

test.use({ isMobile: true, hasTouch: true });
for (const profile of [
  { width: 375, height: 667, top: 20, bottom: 0, left: 0, right: 0 },
  { width: 390, height: 844, top: 47, bottom: 34, left: 0, right: 0 },
  { width: 393, height: 852, top: 59, bottom: 34, left: 0, right: 0 },
  { width: 667, height: 375, top: 0, bottom: 21, left: 44, right: 44 },
  { width: 844, height: 390, top: 0, bottom: 21, left: 59, right: 59 },
]) {
  test(`system areas do not cover controls: ${profile.width}x${profile.height}, top=${profile.top}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: profile.width,
      height: profile.height,
    });
    await page.addInitScript((insets) => {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          for (const edge of ["top", "bottom", "left", "right"] as const)
            document.documentElement.style.setProperty(
              `--safe-area-${edge}`,
              `${insets[edge]}px`,
            );
          // This intercepts taps in the simulated system status bar.
          const statusBar = document.createElement("div");
          statusBar.dataset.testSystemBar = "true";
          statusBar.style.cssText = `position:fixed;inset:0 0 auto;height:${insets.top}px;z-index:99999;background:#09090c;color:white;pointer-events:auto`;
          document.body.append(statusBar);
        },
        { once: true },
      );
    }, profile);
    await page.goto("/#home");
    const help = page.getByRole("button", { name: "Открыть помощника" });
    const helpBounds = await help.boundingBox();
    expect(helpBounds!.y).toBeGreaterThanOrEqual(profile.top);
    expect(helpBounds!.x + helpBounds!.width).toBeLessThanOrEqual(
      profile.width - profile.right,
    );
    const menu = page.getByRole("button", { name: "Открыть меню" });
    if (await menu.isVisible()) {
      const bounds = await menu.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(profile.top);
      expect(bounds!.x).toBeGreaterThanOrEqual(profile.left);
      await menu.click();
      await page
        .locator(".sidebar")
        .evaluate((element) => (element.scrollTop = element.scrollHeight));
      const closeMenu = page.getByRole("button", { name: "Закрыть меню" });
      await expect(closeMenu).toBeInViewport({ ratio: 1 });
      expect((await closeMenu.boundingBox())!.y).toBeGreaterThanOrEqual(
        profile.top,
      );
    }
    await page.getByRole("button", { name: "Мои предпочтения" }).click();
    let dialog = page.getByRole("dialog");
    const close = dialog.getByRole("button", { name: "Закрыть", exact: true });
    expect((await close.boundingBox())!.y).toBeGreaterThanOrEqual(profile.top);
    await close.click();
    await help.click();
    dialog = page.getByRole("dialog");
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(profile.left);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      profile.width - profile.right,
    );
    expect(bounds!.y).toBeGreaterThanOrEqual(profile.top);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      profile.height - profile.bottom,
    );
    await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
    const navigation = page.getByRole("navigation", {
      name: "Навигация на телефоне",
    });
    if (await navigation.isVisible()) {
      for (const button of await navigation.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(profile.left);
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          profile.width - profile.right,
        );
        expect(box!.y + box!.height).toBeLessThanOrEqual(
          profile.height - profile.bottom,
        );
      }
      await navigation
        .getByRole("button", { name: "Чтение", exact: true })
        .click();
      await page.locator(".reading-word").first().click();
      const definition = await page
        .locator(".reading-definition")
        .boundingBox();
      expect(definition!.x).toBeGreaterThanOrEqual(profile.left);
      expect(definition!.x + definition!.width).toBeLessThanOrEqual(
        profile.width - profile.right,
      );
      await page.getByRole("button", { name: "Закрыть значение" }).click();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
