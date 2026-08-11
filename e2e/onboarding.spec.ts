import { expect, test } from "@playwright/test";
import {
  answerTrial,
  completeCalibrationAndValidation,
  completeDisplaySetup,
} from "./helpers";

test("first run reaches the gallery through calibration and blind validation", async ({
  page,
}) => {
  await page.goto("/");
  await completeDisplaySetup(page);
  await completeCalibrationAndValidation(page);
  await page.getByRole("button", { name: "保存配置，开始欣赏名画" }).click();
  await expect(
    page.getByRole("heading", { name: "画家眼中，是什么颜色？" }),
  ).toBeVisible();
});

test("keyboard-only users can set up, calibrate, and compare", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("显示器名称")).toBeFocused();
  await page.keyboard.type("键盘测试显示器");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("亮度记录")).toBeFocused();
  await page.keyboard.type("系统亮度 50%");
  for (const label of [
    "Night Shift 或夜览已关闭",
    "True Tone 或原彩已关闭",
    "护眼或色彩滤镜已关闭",
  ]) {
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(label)).toBeFocused();
    await page.keyboard.press("Space");
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "开始测试" })).toBeFocused();
  await page.keyboard.press("Enter");

  await completeCalibrationAndValidation(page);
  await page.keyboard.press("Tab");
  const saveButton = page.getByRole("button", { name: "保存配置，开始欣赏名画" });
  await expect(saveButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "画家眼中，是什么颜色？" }),
  ).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "配置与备份" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("选择图片")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("图片链接")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "查看夜间咖啡馆" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "返回画廊" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "全屏" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "下一张" })).toBeFocused();
  await page.keyboard.press("Tab");
  const stage = page.getByTestId("artwork-stage");
  await expect(stage).toBeFocused();
  await page.keyboard.press("Tab");
  const enhanceButton = page.getByRole("button", {
    name: "看到画家眼中的颜色",
  });
  await expect(enhanceButton).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+Tab");
  await expect(stage).toBeFocused();
  await page.keyboard.down("Space");
  await expect(page.locator(".viewer-source")).toHaveClass(/active/);
  await page.keyboard.up("Space");
});

test("an interrupted calibration resumes at the saved trial", async ({
  page,
}) => {
  await page.goto("/");
  await completeDisplaySetup(page);
  await answerTrial(page, true);
  await answerTrial(page, true);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "2",
  );

  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "2",
  );
  await answerTrial(page, true);
  await answerTrial(page, true);
  await expect(page.getByText("效果验证 · 条件已隐藏")).toBeVisible();
});
