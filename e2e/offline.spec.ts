import { expect, test } from "@playwright/test";
import { completeFirstRun } from "./helpers";

test("the saved gallery and selected viewer reload while offline", async ({
  context,
  page,
}) => {
  await completeFirstRun(page);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return "unsupported";
        const registration = await navigator.serviceWorker.ready;
        return registration.active?.state ?? "waiting";
      }),
    )
    .toBe("activated");

  await page.getByRole("button", { name: "查看夜间咖啡馆" }).click();
  await expect(page.getByRole("heading", { name: "夜间咖啡馆" })).toBeVisible();

  await context.setOffline(true);
  try {
    await expect(page.getByText("离线模式")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("离线模式")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "夜间咖啡馆" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "返回画廊" }).click();
    await expect(
      page.getByRole("heading", { name: "画家眼中，是什么颜色？" }),
    ).toBeVisible();
    await expect(page.locator(".gallery-grid img")).toHaveCount(12);
  } finally {
    await context.setOffline(false);
  }
});
