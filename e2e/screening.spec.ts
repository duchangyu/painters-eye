import { expect, test } from "@playwright/test";
import { answerTrial } from "./helpers";

async function answerScreeningTrials(
  page: import("@playwright/test").Page,
  answerCorrectly: (axis: string | null) => boolean,
) {
  const stage = page.locator(".instrument-stage");
  for (let index = 0; index < 8; index += 1) {
    const axis = await stage.getAttribute("data-e2e-condition");
    await answerTrial(page, answerCorrectly(axis));
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("painters-eye:e2e-entry", "quick");
  });
});

test("fast track routes a dichromat pattern to a preset and the gallery", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("快速体验 · 8 题")).toBeVisible();

  // Protan trials all wrong, everything else right → protan-severe preset.
  await answerScreeningTrials(page, (axis) => axis !== "protan");

  await expect(
    page.getByRole("heading", { name: /红色盲档/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "去画廊看画" }).click();

  await expect(
    page.getByRole("heading", { name: "画家眼中，是什么颜色？" }),
  ).toBeVisible();
  await expect(page.getByLabel("近似模式提示")).toContainText("红色盲档");

  // The preset survives a reload: no intro, no screening, straight to gallery.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "画家眼中，是什么颜色？" }),
  ).toBeVisible();
  await expect(page.getByLabel("近似模式提示")).toBeVisible();

  // The viewer offers the enhancement with the approximate-mode tag.
  await page.getByRole("button", { name: "查看夜间咖啡馆" }).click();
  await page.getByRole("button", { name: "看到画家眼中的颜色" }).click();
  await expect(page.getByText("近似模式")).toBeVisible();
});

test("fast track upgrade path leads into the full calibration", async ({
  page,
}) => {
  await page.goto("/");
  await answerScreeningTrials(page, (axis) => axis !== "protan");
  await page.getByRole("button", { name: "去画廊看画" }).click();
  await expect(page.getByLabel("近似模式提示")).toBeVisible();

  await page
    .getByRole("button", { name: "开始精准测试" })
    .click();
  await expect(page.getByLabel("显示器名称")).toBeVisible();
});

test("fast track recognizes normal red-green discrimination", async ({
  page,
}) => {
  await page.goto("/");
  await answerScreeningTrials(page, () => true);

  await expect(
    page.getByRole("heading", { name: "你的红绿分辨看起来不错" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "去画廊看画" }).click();
  await expect(
    page.getByRole("heading", { name: "画家眼中，是什么颜色？" }),
  ).toBeVisible();
  // Normal-vision users get the original-only gallery: no preset banner.
  await expect(page.getByLabel("近似模式提示")).toHaveCount(0);
});

test("fast track flags sessions that miss both control trials", async ({
  page,
}) => {
  await page.goto("/");
  // Answer controls wrong, everything else right → unreliable.
  await answerScreeningTrials(
    page,
    (axis) => axis === "protan" || axis === "deutan",
  );

  await expect(
    page.getByRole("heading", { name: "刚才的回答不太稳定" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新测一次" }).click();
  await expect(page.getByText("快速体验 · 8 题")).toBeVisible();
});
