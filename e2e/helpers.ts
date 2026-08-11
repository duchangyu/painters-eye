import { expect, type Page } from "@playwright/test";

const KEY_BY_DIRECTION = {
  up: "ArrowUp",
  right: "ArrowRight",
  down: "ArrowDown",
  left: "ArrowLeft",
} as const;

function wrongDirection(direction: keyof typeof KEY_BY_DIRECTION) {
  return direction === "up" ? "right" : "up";
}

export async function answerTrial(page: Page, chooseCorrect: boolean) {
  const stage = page.locator(".instrument-stage");
  const trialId = await stage.getAttribute("data-e2e-trial-id");
  const direction = (await stage.getAttribute("data-e2e-direction")) as
    keyof typeof KEY_BY_DIRECTION | null;
  expect(trialId).toBeTruthy();
  expect(direction).toBeTruthy();
  await page.keyboard.press(
    KEY_BY_DIRECTION[chooseCorrect ? direction! : wrongDirection(direction!)],
  );
  await expect
    .poll(async () =>
      (await stage.count()) === 0
        ? "screen-complete"
        : stage.getAttribute("data-e2e-trial-id"),
    )
    .not.toBe(trialId);
}

export async function completeDisplaySetup(page: Page) {
  await page.getByLabel("显示器名称").fill("书房显示器");
  await page.getByLabel("亮度记录").fill("系统亮度 50%");
  await page.getByLabel("Night Shift 或夜览已关闭").check();
  await page.getByLabel("True Tone 或原彩已关闭").check();
  await page.getByLabel("护眼或色彩滤镜已关闭").check();
  await page.getByRole("button", { name: "开始测试" }).click();
}

export async function completeCalibrationAndValidation(page: Page) {
  for (let index = 0; index < 4; index += 1) {
    await answerTrial(page, true);
  }
  await expect(page.getByText("效果验证 · 条件已隐藏")).toBeVisible();

  const stage = page.locator(".instrument-stage");
  for (let index = 0; index < 12; index += 1) {
    const condition = await stage.getAttribute("data-e2e-condition");
    await answerTrial(page, condition === "personalized");
  }
  await expect(
    page.getByRole("heading", { name: "测试通过" }),
  ).toBeVisible();
}

export async function completeFirstRun(page: Page) {
  await page.goto("/");
  await completeDisplaySetup(page);
  await completeCalibrationAndValidation(page);
  await page.getByRole("button", { name: "保存配置，开始欣赏名画" }).click();
  await expect(
    page.getByRole("heading", { name: "画家眼中，是什么颜色？" }),
  ).toBeVisible();
}
