import { expect, test } from "@playwright/test";
import { completeFirstRun } from "./helpers";

test("user images: upload, fullscreen, keyboard navigation, persistence, delete", async ({
  page,
}) => {
  await completeFirstRun(page);

  // Upload a local file into "我的图片".
  await page
    .getByLabel("选择图片")
    .setInputFiles("public/artworks/roses.jpg");
  const uploadedCard = page.getByRole("button", { name: /查看roses\.jpg/ });
  await expect(uploadedCard).toBeVisible();

  // Open it; the viewer shows the file name as the title.
  await uploadedCard.click();
  await expect(
    page.getByRole("heading", { name: "roses.jpg" }),
  ).toBeVisible();

  // Fullscreen toggles on F and back off with Escape (browser-handled).
  await page.keyboard.press("f");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);

  // Enable enhancement on the user image…
  await page.getByRole("button", { name: "看到画家眼中的颜色" }).click();
  await expect(page.getByText("正常视觉模拟")).toBeVisible();

  // …and the display mode carries over when switching artworks.
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "夜间咖啡馆" }),
  ).toBeVisible();
  await expect(page.getByText("正常视觉模拟")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "返回原图" }),
  ).toBeVisible();
  // Back to the original view, then back to the user image.
  await page.getByRole("button", { name: "返回原图" }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("heading", { name: "roses.jpg" }),
  ).toBeVisible();

  // Escape outside fullscreen returns to the gallery.
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "画家眼中，是什么颜色？" }),
  ).toBeVisible();

  // The library survives a reload (IndexedDB persistence).
  await page.reload();
  await expect(
    page.getByRole("button", { name: /查看roses\.jpg/ }),
  ).toBeVisible();

  // Deleting removes it from the gallery.
  await page.getByRole("button", { name: /删除 roses\.jpg/ }).click();
  await expect(
    page.getByRole("button", { name: /查看roses\.jpg/ }),
  ).not.toBeVisible();
});
